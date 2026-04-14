# Arduino Platform — Project Brief
# Plain English overview to feed to your AI coding assistant before starting work.
# No code. Just context, goals, decisions, and what needs to be built.

---

## WHO WE ARE AND WHAT WE ALREADY HAVE

We run a competitive coding platform for students — similar to Leetcode.
Students log in, pick a problem, write code in a browser editor, submit it,
and get a pass or fail verdict. We have weekly timed contests where students
compete on a leaderboard.

The platform is already built and running. It has:
- A React + Vite frontend (single page app, React Router)
- A Node.js + Express backend (one monolith, not microservices)
- PostgreSQL as the database
- JWT-based user authentication already working
- A contest system with timer, leaderboard, and scoring already working
- Problem listing and submission history already working
- Deployed on Railway for now, moving to AWS later

---

## WHAT WE ARE ADDING

We are extending the platform to support Arduino coding problems.

Instead of writing a JavaScript or Python function, students will write
Arduino C++ code. Instead of returning a value from a function, the code
runs on a simulated Arduino board. Instead of comparing return values,
we check what the Arduino pins did over time.

The student experience should feel identical to Leetcode:
- See a problem statement
- Write code in an editor
- Click Run to preview (see LEDs light up live)
- Click Submit to get graded (pass/fail per test case)
- Submission saved to history
- Problem marked as solved on the leaderboard if all tests pass

---

## THE TWO BOARDS WE SUPPORT

Arduino Uno and Arduino Mega. These cover all the problems we plan to write.
Each problem in the database specifies which board it runs on.

---

## THE TWO BUTTONS — RUN VS SUBMIT

This is the most important UX distinction in the whole system.

RUN:
- Student clicks Run while writing code to see it working
- Code gets compiled and sent to the browser as a .hex file
- The browser runs the simulation live — student sees LEDs blinking, serial output
- This is NOT graded. It does not count as a submission.
- The student can click Run as many times as they want (rate limited to 5 per minute)
- The simulation runs entirely in the student's browser — zero server cost

SUBMIT:
- Student clicks Submit when they think their solution is complete
- Code gets compiled server-side
- The compiled .hex gets run headlessly on the server using the same simulation engine
- The server records what the pins did and what appeared on serial during that simulation
- Those results are checked against the problem's test cases
- Student gets a pass/fail verdict per test case — same as Leetcode
- This IS graded. It creates a submission record. It affects the leaderboard.

---

## HOW "SOLVED CORRECTLY" IS DETERMINED

This is the core of the whole system. We call it the grader.

Every Arduino problem has a set of test cases stored in the database.
A test case is a rule like:
- "Pin 13 must be HIGH at the 500ms mark"
- "Pin 13 must toggle at least 6 times in the first 7 seconds"
- "The serial monitor must contain the text Hello Arduino"

When a student submits, we compile their code and then run the simulation
for a defined amount of time (typically 10 seconds). During that simulation
we record every pin state change and every serial character output.

After simulation we check each test case rule against that recording.
If ALL required test cases pass → the problem is accepted → marked as solved.
If ANY test case fails → wrong answer → not solved.

Some test cases are visible to the student (they can see exactly what is being checked).
Some are hidden (student only sees the count — "2 of 3 hidden tests passed").
This is identical to how Leetcode hides some test cases.

The grader runs entirely on our server inside the background worker process.
It never touches the student's browser. The browser simulation (Run button) is
just for the student to see and debug — it has nothing to do with grading.

---

## THE COMPILE PIPELINE

Compiling Arduino code requires the arduino-cli tool and the AVR toolchain.
This is heavy software — it cannot run inside our main Express app.

We run it as a separate Docker container using Ubuntu 22.04 with arduino-cli
pre-installed. This container has one job: receive code and a board name,
compile it using arduino-cli, return the compiled .hex file.

This container is never exposed to the internet. It sits on an internal
network and only our backend talks to it.

Because compilation takes 4 to 8 seconds and we can have hundreds of students
submitting at the same time during a contest, we use a job queue so requests
do not pile up and time out. We use BullMQ (a Node.js job queue) backed by
Redis. When a student clicks Run or Submit, the backend immediately returns
a job ID. The frontend polls every second to check if the job is done.
This way the HTTP request never hangs waiting for compilation.

A separate worker process (not the Express server) picks jobs from the queue,
calls the compiler container, runs the grader if it is a submit job, and
stores the result back in Redis so the polling endpoint can return it.

---

## WHY REDIS

Redis serves two purposes:
1. BullMQ (the job queue) requires Redis to store and track jobs
2. Per-user rate limiting (how many compiles per minute) is tracked in Redis

We add Redis as a new dependency. One instance covers both use cases.

---

## THE SIMULATION ENGINE

The engine is called avr8js. It is an open source JavaScript library that
emulates an AVR microcontroller (the chip inside Arduino Uno and Mega) in
software. It is the same engine Wokwi uses and the same engine Velxio uses.

Velxio (https://velxio.dev) is an open source Arduino simulator that the
frontend team is studying for reference. It uses avr8js in the browser for
live simulation — that is what handles the Run button experience.

The key insight for our backend: avr8js is a JavaScript library. It can run
in Node.js on the server just as well as it runs in the browser. This means
our grader can run the same simulation engine server-side, headlessly, with
no browser involved, to check whether a student's code behaves correctly.

The simulation is not real-time on the server. We run it as fast as possible,
looping through AVR instructions, and we record what pins do and what gets
written to serial output. 10 seconds of simulated time takes about 1 to 2
seconds of real server time.

---

## WHAT THE BACKEND MUST DELIVER

Everything listed here is backend only. The frontend team builds their side separately.

### 1. Database tables

Four new tables in the existing PostgreSQL database:
- problems gets two new columns: problem_type (arduino or code) and board (uno or mega)
- test_cases: one row per grading rule per problem, with the rule type and its parameters
- submissions: one row per student submit click, with status and verdict stored as JSON
- code_drafts: one row per student per problem, updated as they type (auto-save)

### 2. The compiler Docker container

A separate Docker service running ubuntu with arduino-cli installed.
One HTTP endpoint: POST /compile — takes code and board name, returns the hex file.
One health check endpoint: GET /health.
Never publicly accessible. Internal network only.
Must pre-warm the arduino-cli build cache at Docker image build time so the
first compile after startup is not slow.

### 3. Redis and BullMQ setup

Redis added to the infrastructure (Railway plugin for now, AWS ElastiCache later).
BullMQ queue configured with job retry on failure, and jobs stored for 1 hour
after completion so the frontend can still poll for the result.
Rate limiting: 5 compile jobs per user per minute enforced at queue entry.

### 4. The compile worker

A separate Node.js process (not part of the Express server) that:
- Reads jobs from the BullMQ queue
- Calls the compiler container to get the .hex file
- If the job is a Run job: stores the hex in the job result, done
- If the job is a Submit job: also runs the grader, stores the verdict, updates the submission row in the database
- Runs with up to 8 concurrent jobs at once

The worker must run as a completely separate process from Express. If the Express
server restarts, the worker keeps running and jobs are not lost.

### 5. The grader (most critical piece)

A Node.js module (not a service, not a container — just a function) that:
- Takes a .hex file and a list of test case rules from the database
- Loads the hex into avr8js
- Runs the AVR simulation for 10 seconds of simulated time
- During simulation, records every pin state change with a timestamp
- During simulation, records every character written to the serial port
- After simulation, evaluates each test case rule against the recorded data
- Returns a structured result: which tests passed, which failed, what the detail was

Three test case rule types to support:
- pin_state: at a given millisecond, a given pin must be HIGH or LOW (with tolerance)
- toggle_count: a given pin must change state at least N times within M milliseconds
- serial_output: the serial output must contain a specific string at any point

The verdict stored in the database includes results for all test cases including hidden
ones. The API response to the frontend redacts the detail of hidden test cases — it only
tells the frontend how many hidden tests passed, not which ones or why.

### 6. API endpoints

All endpoints are under /api/arduino and require the existing JWT auth middleware.

GET /api/arduino/problems
Returns a list of all active Arduino problems with difficulty, board, and whether
the authenticated user has ever accepted this problem.

GET /api/arduino/problems/:id
Returns a single problem with its description, starter code, board, and the visible
test cases. Does not include the test case rule parameters — only the labels.
The frontend must never know what the grader is checking, only that there are checks.

POST /api/arduino/compile
Accepts code and board. Validates input. Enqueues a Run job. Returns job ID immediately.
Does not wait for compilation. Rate limited to 5 per user per minute.

GET /api/arduino/compile/:jobId
Returns the current status of a compile or submit job.
If pending: returns pending status.
If done (Run job): returns the hex file.
If done (Submit job): returns the verdict.
If failed: returns the compile error.
Jobs expire after 1 hour. Validates that the requesting user owns the job.

POST /api/arduino/submit
Accepts code, board, and problem ID. Creates a submission row in the database with
pending status. Enqueues a Submit job with the submission ID attached. Returns job ID
and submission ID immediately.

GET /api/arduino/submissions/:problemId
Returns the authenticated user's submission history for a specific problem.
List view — status, timestamp, how many tests passed. No code in list view.

GET /api/arduino/submissions/detail/:submissionId
Returns full detail of one submission including the student's code and full verdict.
Only accessible by the student who made it.

PUT /api/arduino/code/:problemId
Auto-save endpoint. Frontend calls this with 800ms debounce as the student types.
Upserts the code_drafts table. Returns immediately. Silent — student never sees this.

GET /api/arduino/code/:problemId
Returns the student's saved draft for a problem so the editor pre-fills on page load.

---

## CONTEST INTEGRATION

Arduino problems are just another problem type in the existing contest system.
The existing contest infrastructure (timer, leaderboard, scoring) does not change.
The only change needed: when the contest page renders a problem list, if a problem
has problem_type = arduino it routes to the Arduino editor. If it is a regular code
problem it routes to the existing editor. The leaderboard query already reads from
submissions — an accepted Arduino submission scores identically to any other accepted
submission. No new leaderboard logic needed.

---

## SCALING PLAN

The platform runs weekly 90-minute exams with 500 or more students at the same time.
The simulation (avr8js in browser) costs nothing on the server regardless of user count.
The only server cost under load is compilation. One compiler container handles about
8 concurrent compiles. During an exam we scale to 3 to 5 containers.

Because we know when exams are scheduled in advance, we pre-warm the extra compiler
containers 10 minutes before each exam starts using a scheduled task. After the exam
ends the extra containers scale back down. This means we pay for burst capacity for
about 2 hours per week rather than keeping it always running.

On Railway now: second Railway service for the compiler container, Railway Redis plugin.
On AWS later: ECS Fargate tasks for backend, compiler, and worker as three separate
task definitions. ElastiCache for Redis. All in the same VPC so the compiler is never
publicly accessible.

---

## WHAT THE FRONTEND TEAM HANDLES (not your concern)

- The Monaco code editor component in React
- The live LED simulation display using avr8js in the browser
- The serial monitor panel
- Polling the compile/submit status endpoints and updating the UI
- Displaying test case results after submit
- Auto-saving code by calling the PUT /code/:problemId endpoint
- The problem statement and submission history tabs

The frontend team is using Velxio as open source reference for the simulation UI.
Velxio uses the same avr8js and wokwi-elements libraries and is licensed AGPLv3.

---

## KEY DECISIONS ALREADY MADE

- BullMQ over a custom queue or simple async because it survives server restarts,
  supports concurrent workers, and handles retries automatically
- Compiler as a separate Docker container (not embedded in Express) because
  arduino-cli and the AVR toolchain are 800MB and would make the main app image huge
- Polling (not WebSockets) for compile status because compile time is 4 to 8 seconds
  and polling every second is simple, reliable, and requires no persistent connection
- avr8js in Node for grading (not a separate service) because it is a pure JS library
  and running it inside the worker is simpler than building another container
- Same leaderboard for Arduino and code problems because Arduino is just a problem type,
  not a separate contest track — this simplifies everything
- Rate limit of 5 compiles per user per minute to protect the compiler during exams
- 10 seconds of simulated time for grading because it covers the longest problems
  (like SOS morse code) while keeping grading time under 2 real seconds per submission

---

## WHAT SOLVED MEANS — SUMMARY

A student has genuinely solved a problem when:
1. Their code compiles without errors
2. The compiled code, when run in a headless AVR simulation for 10 seconds,
   produces pin behaviour and serial output that matches every required test case
3. The submission status in the database is 'accepted'

A problem is NOT solved if the code compiles but does the wrong thing.
A problem is NOT solved if the student has run the simulation in their browser
and seen it work — the browser Run is just for feedback, not for grading.
Only a Submit that returns 'accepted' counts as solving the problem.

---

## IMPLEMENTATION ORDER

1. Run the four database migrations
2. Deploy Redis (Railway plugin)
3. Build and deploy the compiler Docker container, verify it compiles a hello world sketch
4. Build the BullMQ queue and Redis singleton services
5. Build the compile worker (Run jobs only first, no grading yet)
6. Build the compile and status API routes, verify end to end with curl
7. Build the grader module and write unit tests against known .hex files
8. Add the Submit job path to the worker (compile then grade)
9. Build the submit and submissions API routes
10. Build the problems and code draft API routes
11. Add two lines to server.js to mount the arduino router
12. Wire Arduino as a problem type into the existing contest system
13. Add the exam pre-warm scheduler

Each step is independently testable before moving to the next.
Do not skip to step 8 without verifying step 6 works end to end.
The grader is the riskiest piece — give it unit tests before wiring it into the worker.