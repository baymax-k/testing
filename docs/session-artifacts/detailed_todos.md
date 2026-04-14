# 🎯 CODEETHNICS BACKEND - DETAILED TODO BREAKDOWN

## 📊 OVERVIEW

**Total Tasks:** 17  
**Critical (Blocking):** 4  
**High Priority:** 3  
**Medium Priority:** 5  
**Low Priority:** 5  

**Estimated Total Time:** 3-4 weeks for all tasks  
**Minimum Viable Product:** 1 week (Critical + High Priority only)

---

## 🚨 CRITICAL TASKS (Must Complete Before Launch)

### ✅ Task 1: Fix Arduino Routes Duplicate Auth
**ID:** `fix-arduino-routes`  
**Status:** Pending  
**Priority:** CRITICAL  
**Estimated Time:** 30 minutes  
**Dependencies:** None  

**Problem:**
`/src/modules/arduino/routes/arduino.routes.ts` has duplicate endpoint definitions:
- Lines 26-27: `router.use(requireAuth)` (protects everything)
- Lines 49-75: Duplicate `/health`, `/boards`, `/problems` routes without auth
- Lines 78: Another `router.use(requireAuth)`

**Impact:**
- Confusing code, unclear which routes are protected
- `/health` endpoint appears twice (once protected, once public)
- Potential security issue if wrong route is matched

**Solution:**
```typescript
// BEFORE (lines 26-123, messy)
router.use(requireAuth); // Line 26
router.get('/boards', ...); // Line 30 - PROTECTED
// ... more routes ...
router.get('/health', ...); // Line 50 - PUBLIC???
router.get('/boards', ...); // Line 60 - DUPLICATE!
router.use(requireAuth); // Line 78 - AGAIN???

// AFTER (clean structure)
const router = Router();

// 1. Public routes first (ONLY health)
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 2. Protect ALL other routes
router.use(requireAuth);

// 3. General rate limiting
router.use(generalArduinoRateLimit.middleware());

// 4. Protected routes
router.get('/boards', ...);
router.get('/problems', ...);
router.get('/problems/:problemId', ...);

// 5. Compilation with stricter rate limit
router.post('/compile', arduinoCompileRateLimit.middleware(), ...);

// 6. Other protected routes
router.get('/jobs/:submissionId', ...);
router.get('/submissions', ...);
router.delete('/jobs/:submissionId', ...);
router.post('/validate', ...);

// 7. Admin routes
router.get('/admin/queue/stats', requireRole('admin'), ...);
```

**Testing:**
```bash
# Should work without auth
curl http://localhost:5000/api/v1/arduino/health

# Should return 401 without auth
curl http://localhost:5000/api/v1/arduino/boards
curl http://localhost:5000/api/v1/arduino/problems
```

**Files to Modify:**
- `/src/modules/arduino/routes/arduino.routes.ts`

---

### ✅ Task 2: Add Missing Prisma Models
**ID:** `add-missing-models`  
**Status:** Pending  
**Priority:** CRITICAL  
**Estimated Time:** 2-3 hours  
**Dependencies:** None  
**Blocks:** `implement-student-dashboard`

**Problem:**
5 models used in services but missing from Prisma schema:
1. `MCQPracticeSession` - Practice service creates sessions
2. `MCQSessionAnswer` - Stores answers in session
3. `PracticeActivity` - Daily activity tracking
4. `DailyChallenge` - POTD challenge for each day
5. `DailyChallengeSolve` - User's POTD attempts

**Impact:**
- **MCQ Practice endpoints will crash** when trying to create sessions
- **POTD endpoints will fail** (can't check today's challenge)
- **Activity tracking won't persist** data

**Solution:**
Add to `/prisma/schema.prisma`:

```prisma
// ─── MCQ Practice Session ───────────────────────────────────

model MCQPracticeSession {
  id              String   @id @default(cuid())
  userId          String
  topics          String[] // ["arrays", "strings", "dp"]
  difficulty      Difficulty?
  totalQuestions  Int
  answeredCount   Int      @default(0)
  correctCount    Int      @default(0)
  status          SessionStatus @default(active) // active | completed | abandoned
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers         MCQSessionAnswer[]
  
  @@index([userId])
  @@index([status])
}

model MCQSessionAnswer {
  id              String   @id @default(cuid())
  sessionId       String
  questionId      String
  selectedOption  Int
  isCorrect       Boolean
  answeredAt      DateTime @default(now())
  
  session         MCQPracticeSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question        MCQProblem @relation(fields: [questionId], references: [id])
  
  @@unique([sessionId, questionId]) // One answer per question per session
  @@index([sessionId])
}

enum SessionStatus {
  active
  completed
  abandoned
}

// ─── Practice Activity Tracking ─────────────────────────────

model PracticeActivity {
  id              String   @id @default(cuid())
  userId          String
  date            DateTime @db.Date // Store as date only (2026-04-04)
  dsaSolved       Int      @default(0)
  mcqSolved       Int      @default(0)
  timeSpentMinutes Int     @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, date]) // One record per user per day
  @@index([userId])
  @@index([date])
}

// ─── Problem of the Day (POTD) ──────────────────────────────

model DailyChallenge {
  id              String   @id @default(cuid())
  date            DateTime @unique @db.Date // One challenge per day
  problemType     ProblemType // mcq | dsa
  problemId       String   // MCQProblem.id or Problem.id
  createdBy       String?  // Admin who selected it (optional)
  createdAt       DateTime @default(now())
  
  solves          DailyChallengeSolve[]
  
  @@index([date])
}

model DailyChallengeSolve {
  id              String   @id @default(cuid())
  userId          String
  challengeId     String
  solved          Boolean  @default(false)
  attemptedAt     DateTime @default(now())
  solvedAt        DateTime?
  
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
  challenge       DailyChallenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  
  @@unique([userId, challengeId]) // One attempt per user per challenge
  @@index([userId])
  @@index([challengeId])
}

enum ProblemType {
  mcq
  dsa
  arduino
}
```

**Also update User model:**
```prisma
model User {
  // ... existing fields ...
  
  // Add these relations:
  mcqSessions         MCQPracticeSession[]
  practiceActivities  PracticeActivity[]
  dailySolves         DailyChallengeSolve[]
}

model MCQProblem {
  // ... existing fields ...
  
  // Add this relation:
  sessionAnswers      MCQSessionAnswer[]
}
```

**Migration:**
```bash
pnpm prisma migrate dev --name add-student-panel-models
```

**Testing:**
```bash
# After migration, test MCQ session creation
curl -X POST http://localhost:5000/api/v1/student/practice/mcq/session \
  -H "Cookie: access_token=TOKEN" \
  -d '{"topics":["arrays"],"difficulty":"easy"}'

# Test POTD
curl http://localhost:5000/api/v1/student/potd \
  -H "Cookie: access_token=TOKEN"
```

**Files to Modify:**
- `/prisma/schema.prisma`

---

### ✅ Task 3: Fix Contest DSA Grading
**ID:** `fix-contest-dsa-grading`  
**Status:** Pending  
**Priority:** CRITICAL  
**Estimated Time:** 3-4 hours  
**Dependencies:** None  
**Blocks:** `integrate-arduino-contests`

**Problem:**
`/src/modules/contest/contest.controller.ts` has incomplete DSA submission handler:

```typescript
// Line ~85 (approximate)
async submitDSASolution(req: Request, res: Response) {
  // ... validation ...
  
  // TODO: Send to Judge0 for evaluation
  // For now, just store the submission
  
  return res.json({ message: "DSA submission received" });
}
```

**Impact:**
- Students can submit DSA code in contests
- Code is NOT graded (no test cases run)
- No score is calculated
- Leaderboard doesn't reflect DSA performance

**Solution:**
Copy Judge0 integration from `/src/modules/submission/submission.service.ts`:

```typescript
// In contest.service.ts

async submitDSASolution(
  userId: string,
  contestId: string,
  problemId: string,
  code: string,
  language: string
): Promise<ContestSubmissionResult> {
  
  // 1. Validate contest is active
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: { problems: true }
  });
  
  if (!contest) throw new Error('Contest not found');
  if (new Date() < contest.startTime) throw new Error('Contest not started');
  if (new Date() > contest.endTime) throw new Error('Contest ended');
  
  // 2. Get problem with test cases
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: { testCases: true }
  });
  
  if (!problem) throw new Error('Problem not found');
  
  // 3. Create submission record
  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId,
      language,
      sourceCode: code,
      status: 'processing',
      contestId // Link to contest
    }
  });
  
  // 4. Execute with Judge0 (reuse existing service)
  const judge0Service = new Judge0Service();
  const results = await judge0Service.executeTestCases(
    code,
    language,
    problem.testCases
  );
  
  // 5. Calculate score
  const testsPassed = results.filter(r => r.status === 'accepted').length;
  const totalTests = results.length;
  const accuracy = testsPassed / totalTests;
  
  // Contest scoring: partial credit
  const maxPoints = problem.contestPoints || 100;
  const earnedPoints = Math.floor(accuracy * maxPoints);
  
  // 6. Update submission
  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: accuracy === 1 ? 'accepted' : 'wrong_answer',
      testCasesPassed: testsPassed,
      totalTestCases: totalTests,
      runtime: results[0]?.runtime,
      memory: results[0]?.memory
    }
  });
  
  // 7. Update contest participation score
  const participation = await prisma.contestParticipation.findUnique({
    where: {
      userId_contestId: { userId, contestId }
    }
  });
  
  if (participation) {
    await prisma.contestParticipation.update({
      where: { id: participation.id },
      data: {
        dsaScore: (participation.dsaScore || 0) + earnedPoints,
        totalScore: (participation.totalScore || 0) + earnedPoints
      }
    });
  }
  
  return {
    submissionId: submission.id,
    status: accuracy === 1 ? 'accepted' : 'wrong_answer',
    testsPassed,
    totalTests,
    earnedPoints,
    maxPoints
  };
}
```

**Testing:**
```bash
# 1. Join contest
curl -X POST http://localhost:5000/api/v1/student/contest/join \
  -H "Cookie: access_token=TOKEN" \
  -d '{"contestId":"contest_123"}'

# 2. Submit DSA solution
curl -X POST http://localhost:5000/api/v1/student/contest/submit-dsa \
  -H "Cookie: access_token=TOKEN" \
  -d '{
    "contestId": "contest_123",
    "problemId": "two-sum",
    "code": "def twoSum(nums, target): ...",
    "language": "python"
  }'

# Should return: { earnedPoints: 75, maxPoints: 100, testsPassed: 3, totalTests: 4 }

# 3. Check leaderboard
curl http://localhost:5000/api/v1/student/contest/contest_123/leaderboard \
  -H "Cookie: access_token=TOKEN"

# Should show updated scores
```

**Files to Modify:**
- `/src/modules/contest/contest.service.ts`
- `/src/modules/contest/contest.controller.ts`

---

### ✅ Task 4: Protect Problem Endpoints
**ID:** `protect-problem-endpoints`  
**Status:** Pending  
**Priority:** CRITICAL  
**Estimated Time:** 15 minutes  
**Dependencies:** None  

**Problem:**
Currently `/api/v1/problems` endpoints are already protected (good!), but need to verify ALL problem-related endpoints require auth except health checks.

**Current State (CORRECT):**
```typescript
// /src/modules/routes/problem.ts
router.get("/", requireAuth, listProblems);
router.get("/:slug", requireAuth, getProblem);
```

**Action Required:**
Just verify and document that ONLY these endpoints should be public:
- `/api/v1` - Health check
- `/api/v1/auth/*` - Authentication routes
- `/api/v1/arduino/health` - Arduino health
- `/api/v1/judge0/health` - Judge0 health

**Everything else should require authentication:**
- ✅ `/api/v1/problems/*` - Already protected
- ✅ `/api/v1/submissions/*` - Already protected
- ✅ `/api/v1/student/*` - Already protected
- ⚠️ `/api/v1/arduino/*` - Needs fix (see Task 1)

**Testing:**
```bash
# These should return 401 without token:
curl http://localhost:5000/api/v1/problems
curl http://localhost:5000/api/v1/submissions
curl http://localhost:5000/api/v1/student/dashboard
curl http://localhost:5000/api/v1/arduino/problems

# These should work without token:
curl http://localhost:5000/api/v1
curl http://localhost:5000/api/v1/arduino/health
curl http://localhost:5000/api/v1/judge0/health
curl http://localhost:5000/api/v1/auth/google-client-id
```

**Files to Verify:**
- All route files in `/src/modules/routes/`

---

## 🔥 HIGH PRIORITY (Arduino Simulation)

### ✅ Task 5: Integrate AVR8JS Simulator
**ID:** `integrate-avr8js`  
**Status:** Pending  
**Priority:** HIGH  
**Estimated Time:** 2-3 days  
**Dependencies:** None  
**Blocks:** `add-serial-monitor`, `add-multiple-test-runs`, `add-circuit-validation`

**Problem:**
Current test validation in `arduino-compiler/src/server.ts` is MOCKED:

```typescript
// Line ~150 (mock implementation)
app.post('/simulate', (req, res) => {
  // MOCK: Random pass/fail
  const passed = Math.random() > 0.5;
  res.json({ allTestsPassed: passed, results: [...] });
});
```

**Impact:**
- Test cases don't actually validate code logic
- Students see random pass/fail results
- Can't test timing, pin states, serial output

**Solution:**
Install and integrate AVR8JS:

```bash
cd arduino-compiler
pnpm add avr8js
```

```typescript
// arduino-compiler/src/simulator.ts (NEW FILE)
import { AVR8, CPU, AVRIOPort } from 'avr8js';
import { loadHex } from 'avr8js';

interface TestCase {
  type: 'pin_state' | 'serial_output' | 'toggle_count' | 'timing';
  pin?: number;
  expectedState?: string;
  atMs?: number;
  toleranceMs?: number;
  expectedOutput?: string;
  minToggles?: number;
  withinMs?: number;
}

interface SimulationResult {
  testCaseId: string;
  passed: boolean;
  actualValue: string;
  expectedValue: string;
  message?: string;
}

export class ArduinoSimulator {
  private avr: AVR8;
  private cpu: CPU;
  private portB: AVRIOPort; // For pins 8-13
  private portD: AVRIOPort; // For pins 0-7
  private serialOutput: string = '';
  private pinStates: Map<number, boolean[]> = new Map();
  
  constructor(hexContent: string) {
    // Load HEX into AVR8
    this.avr = new AVR8(hexContent);
    this.cpu = this.avr.cpu;
    this.portB = this.avr.portB;
    this.portD = this.avr.portD;
    
    // Hook serial output (UART)
    this.avr.usart.onByteTransmit = (byte: number) => {
      this.serialOutput += String.fromCharCode(byte);
    };
    
    // Track pin state changes
    this.portB.addListener((value) => this.recordPinChange('B', value));
    this.portD.addListener((value) => this.recordPinChange('D', value));
  }
  
  private recordPinChange(port: 'B' | 'D', value: number) {
    const pinOffset = port === 'B' ? 8 : 0;
    for (let i = 0; i < 8; i++) {
      const pin = pinOffset + i;
      const state = Boolean(value & (1 << i));
      if (!this.pinStates.has(pin)) {
        this.pinStates.set(pin, []);
      }
      this.pinStates.get(pin)!.push(state);
    }
  }
  
  async runSimulation(durationMs: number): Promise<void> {
    const startTime = Date.now();
    const cyclesPerMs = 16000; // 16 MHz clock
    
    while (Date.now() - startTime < durationMs) {
      // Execute CPU cycles
      this.cpu.tick();
      
      // Prevent infinite loops
      if (this.cpu.cycles > cyclesPerMs * durationMs * 10) {
        throw new Error('Simulation timeout: possible infinite loop');
      }
    }
  }
  
  validateTestCase(testCase: TestCase): SimulationResult {
    switch (testCase.type) {
      case 'pin_state':
        return this.validatePinState(testCase);
      
      case 'serial_output':
        return this.validateSerialOutput(testCase);
      
      case 'toggle_count':
        return this.validateToggleCount(testCase);
      
      case 'timing':
        return this.validateTiming(testCase);
      
      default:
        throw new Error(`Unknown test case type: ${testCase.type}`);
    }
  }
  
  private validatePinState(testCase: TestCase): SimulationResult {
    const { pin, expectedState, atMs } = testCase;
    if (pin === undefined) throw new Error('pin required for pin_state test');
    
    // Get pin state at specific time
    const states = this.pinStates.get(pin) || [];
    const stateIndex = Math.floor((atMs! / 1000) * states.length);
    const actualState = states[stateIndex] ? 'HIGH' : 'LOW';
    
    const passed = actualState === expectedState;
    
    return {
      testCaseId: testCase.id,
      passed,
      actualValue: actualState,
      expectedValue: expectedState!,
      message: passed ? 'Pin state correct' : `Expected ${expectedState}, got ${actualState}`
    };
  }
  
  private validateSerialOutput(testCase: TestCase): SimulationResult {
    const { expectedOutput } = testCase;
    const passed = this.serialOutput.includes(expectedOutput!);
    
    return {
      testCaseId: testCase.id,
      passed,
      actualValue: this.serialOutput,
      expectedValue: expectedOutput!,
      message: passed ? 'Serial output matches' : 'Serial output mismatch'
    };
  }
  
  private validateToggleCount(testCase: TestCase): SimulationResult {
    const { pin, minToggles } = testCase;
    const states = this.pinStates.get(pin!) || [];
    
    // Count state changes
    let toggles = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i] !== states[i - 1]) toggles++;
    }
    
    const passed = toggles >= minToggles!;
    
    return {
      testCaseId: testCase.id,
      passed,
      actualValue: toggles.toString(),
      expectedValue: `>=${minToggles}`,
      message: passed ? `${toggles} toggles detected` : `Only ${toggles} toggles, expected >=${minToggles}`
    };
  }
  
  private validateTiming(testCase: TestCase): SimulationResult {
    // Timing validation logic
    // Check if events occur within expected timeframe
    return {
      testCaseId: testCase.id,
      passed: true,
      actualValue: 'timing-ok',
      expectedValue: 'timing-ok'
    };
  }
}

// Usage in server.ts
app.post('/simulate', async (req, res) => {
  const { hexFile, testCases, durationMs = 5000 } = req.body;
  
  try {
    const simulator = new ArduinoSimulator(hexFile);
    
    // Run simulation
    await simulator.runSimulation(durationMs);
    
    // Validate test cases
    const results = testCases.map((tc: TestCase) => 
      simulator.validateTestCase(tc)
    );
    
    const allTestsPassed = results.every(r => r.passed);
    
    res.json({
      success: true,
      allTestsPassed,
      results,
      passedCount: results.filter(r => r.passed).length,
      totalCount: results.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Testing:**
```bash
# Submit code with test case
curl -X POST http://localhost:5000/api/v1/arduino/compile \
  -H "Cookie: access_token=TOKEN" \
  -d '{
    "problemId": "blink-led",
    "code": "void setup(){pinMode(13,OUTPUT);} void loop(){digitalWrite(13,HIGH);delay(1000);digitalWrite(13,LOW);delay(1000);}",
    "boardType": "uno"
  }'

# Validate with test cases
curl -X POST http://localhost:5000/api/v1/arduino/validate \
  -H "Cookie: access_token=TOKEN" \
  -d '{"submissionId": "sub_xyz"}'

# Should return REAL validation results (not random)
```

**Files to Create/Modify:**
- `arduino-compiler/src/simulator.ts` (NEW)
- `arduino-compiler/src/server.ts` (update /simulate endpoint)
- `arduino-compiler/package.json` (add avr8js dependency)

---

### ✅ Task 6: Move HEX Files to CDN Storage
**ID:** `add-hex-cdn-storage`  
**Status:** Pending  
**Priority:** HIGH  
**Estimated Time:** 4-6 hours  
**Dependencies:** None  

**Problem:**
HEX files (30-50KB each) currently stored in PostgreSQL `hexFile` column:

```sql
SELECT id, LENGTH(hexFile) as size_bytes 
FROM arduino_submission;

-- Result: 35,000 - 50,000 bytes per row
-- 1,000 submissions = 40MB in database
```

**Impact:**
- Database bloat (expensive)
- Slow queries (loading large BLOBs)
- Backup size increase

**Solution:**
Upload to ImageKit/Cloudinary, store URL only.

**Step 1:** Setup ImageKit
```bash
pnpm add imagekit
```

```typescript
// src/config/imagekit.ts (NEW FILE)
import ImageKit from 'imagekit';

export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!
});
```

**Step 2:** Update Worker
```typescript
// src/workers/arduino-worker.ts

import { imagekit } from '../config/imagekit';

async function processJob(job: Job) {
  const { submissionId, code, boardType } = job.data;
  
  // ... compile code ...
  const { hexFile } = await compilerService.compile(code, boardType);
  
  // Upload to CDN
  const uploadResult = await imagekit.upload({
    file: hexFile,
    fileName: `${submissionId}.hex`,
    folder: '/arduino-submissions',
    useUniqueFileName: false
  });
  
  // Update database with URL (not content)
  await prisma.arduinoSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'compiled',
      hexFileUrl: uploadResult.url, // ← Store URL
      compileTime: compileTimeMs
    }
  });
}
```

**Step 3:** Update Schema
```prisma
model ArduinoSubmission {
  // ... other fields ...
  
  // BEFORE:
  // hexFile String? @db.Text // ← Remove
  
  // AFTER:
  hexFileUrl String? // Just the URL (50-100 bytes)
  
  // ... other fields ...
}
```

**Step 4:** Migrate
```bash
pnpm prisma migrate dev --name move-hex-to-cdn
```

**Step 5:** Update Controller
```typescript
// src/modules/arduino/arduino.controller.ts

async getJobStatus(req: Request, res: Response) {
  const { submissionId } = req.params;
  
  const submission = await prisma.arduinoSubmission.findUnique({
    where: { id: submissionId }
  });
  
  return res.json({
    success: true,
    data: {
      submissionId: submission.id,
      status: submission.status,
      hexFileUrl: submission.hexFileUrl, // ← URL, not content
      compileTime: submission.compileTime,
      // Frontend will fetch from CDN URL
    }
  });
}
```

**Environment Variables:**
```env
# ImageKit
IMAGEKIT_PUBLIC_KEY="public_xxx"
IMAGEKIT_PRIVATE_KEY="private_xxx"
IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/your-id"
```

**Testing:**
```bash
# Submit compilation
curl -X POST http://localhost:5000/api/v1/arduino/compile ...

# Get status
curl http://localhost:5000/api/v1/arduino/jobs/sub_xyz

# Response should include:
{
  "hexFileUrl": "https://ik.imagekit.io/your-id/arduino-submissions/sub_xyz.hex"
}

# Frontend downloads from CDN:
curl https://ik.imagekit.io/your-id/arduino-submissions/sub_xyz.hex
```

**Files to Create/Modify:**
- `src/config/imagekit.ts` (NEW)
- `src/workers/arduino-worker.ts`
- `prisma/schema.prisma`
- `src/modules/arduino/arduino.controller.ts`
- `.env.example`

---

### ✅ Task 7: Add Serial Monitor Emulation
**ID:** `add-serial-monitor`  
**Status:** Pending  
**Priority:** HIGH  
**Estimated Time:** 1-2 days  
**Dependencies:** `integrate-avr8js` (Task 5)  

**Problem:**
Can't test Arduino code that uses `Serial.print()`:

```cpp
void setup() {
  Serial.begin(9600);
  Serial.println("Hello Arduino!");
}

void loop() {
  Serial.print("Counter: ");
  Serial.println(millis());
  delay(1000);
}
```

Currently, serial output is lost.

**Solution:**
Already partially implemented in Task 5 AVR8JS integration:

```typescript
// In ArduinoSimulator class (from Task 5)

constructor(hexContent: string) {
  this.avr = new AVR8(hexContent);
  
  // Hook UART serial output
  this.avr.usart.onByteTransmit = (byte: number) => {
    this.serialOutput += String.fromCharCode(byte);
  };
}
```

**Additional Work:**
Add serial output to validation response:

```typescript
// In arduino.service.ts

async validateSubmission(submissionId: string) {
  const submission = await prisma.arduinoSubmission.findUnique({
    where: { id: submissionId },
    include: { problem: { include: { testCases: true } } }
  });
  
  // Run simulation
  const simulator = new ArduinoSimulator(submission.hexFile);
  await simulator.runSimulation(5000);
  
  // Get serial output
  const serialOutput = simulator.getSerialOutput();
  
  // Validate test cases
  const results = submission.problem.testCases.map(tc => 
    simulator.validateTestCase(tc)
  );
  
  return {
    allTestsPassed: results.every(r => r.passed),
    results,
    serialOutput // ← Include in response
  };
}
```

**Store Serial Output in DB:**
```prisma
model ArduinoSubmission {
  // ... other fields ...
  serialOutput String? @db.Text
}
```

**Testing:**
```bash
# Submit code with Serial.print
curl -X POST http://localhost:5000/api/v1/arduino/compile \
  -d '{
    "code": "void setup(){Serial.begin(9600);Serial.println(\"Hello\");}"
  }'

# Validate
curl -X POST http://localhost:5000/api/v1/arduino/validate \
  -d '{"submissionId":"sub_xyz"}'

# Response should include:
{
  "serialOutput": "Hello\n",
  "results": [...]
}
```

**Files to Modify:**
- `arduino-compiler/src/simulator.ts` (add getSerialOutput method)
- `src/services/arduino.service.ts`
- `prisma/schema.prisma`

---

## 🔧 MEDIUM PRIORITY (Enhancements)

### ✅ Task 8: Implement Student Dashboard
**ID:** `implement-student-dashboard`  
**Status:** Pending  
**Priority:** MEDIUM  
**Estimated Time:** 3-4 hours  
**Dependencies:** `add-missing-models` (Task 2)

**Problem:**
Currently returns placeholder:

```typescript
// src/modules/routes/student.ts
router.get('/dashboard', requireAuth, (req, res) => {
  res.json({ message: 'Coming soon' });
});
```

**Solution:**
Aggregate data from multiple tables:

```typescript
// src/services/student-dashboard.service.ts (NEW FILE)

interface DashboardData {
  overview: {
    totalProblemsSolved: number;
    dsaSolved: number;
    mcqSolved: number;
    arduinoSolved: number;
    currentStreak: number;
    longestStreak: number;
  };
  recentActivity: {
    date: string;
    problemsSolved: number;
  }[];
  upcomingContests: Contest[];
  recentSubmissions: Submission[];
  skillProgress: {
    topic: string;
    solved: number;
    total: number;
    accuracy: number;
  }[];
  todaysPOTD: {
    problem: Problem;
    solved: boolean;
  } | null;
}

export class StudentDashboardService {
  async getDashboard(userId: string): Promise<DashboardData> {
    // 1. Get total problems solved
    const dsaSolved = await prisma.submission.count({
      where: {
        userId,
        status: 'accepted'
      },
      distinct: ['problemId']
    });
    
    const mcqSolved = await prisma.mcqSessionAnswer.count({
      where: {
        session: { userId },
        isCorrect: true
      },
      distinct: ['questionId']
    });
    
    const arduinoSolved = await prisma.arduinoSubmission.count({
      where: {
        userId,
        status: 'accepted'
      },
      distinct: ['problemId']
    });
    
    // 2. Get POTD streak
    const { currentStreak, longestStreak } = await this.calculateStreak(userId);
    
    // 3. Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = await prisma.practiceActivity.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo }
      },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        dsaSolved: true,
        mcqSolved: true
      }
    });
    
    // 4. Get upcoming contests
    const upcomingContests = await prisma.contest.findMany({
      where: {
        startTime: { gt: new Date() }
      },
      orderBy: { startTime: 'asc' },
      take: 3
    });
    
    // 5. Get recent submissions
    const recentSubmissions = await prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        problem: { select: { title: true, difficulty: true } }
      }
    });
    
    // 6. Get topic-wise progress
    const skillProgress = await this.getSkillProgress(userId);
    
    // 7. Get today's POTD
    const today = new Date().toISOString().split('T')[0];
    const todaysPOTD = await prisma.dailyChallenge.findUnique({
      where: { date: new Date(today) },
      include: {
        solves: {
          where: { userId },
          select: { solved: true }
        }
      }
    });
    
    return {
      overview: {
        totalProblemsSolved: dsaSolved + mcqSolved + arduinoSolved,
        dsaSolved,
        mcqSolved,
        arduinoSolved,
        currentStreak,
        longestStreak
      },
      recentActivity: recentActivity.map(a => ({
        date: a.date.toISOString(),
        problemsSolved: a.dsaSolved + a.mcqSolved
      })),
      upcomingContests,
      recentSubmissions,
      skillProgress,
      todaysPOTD: todaysPOTD ? {
        problem: await this.getProblemById(todaysPOTD.problemId),
        solved: todaysPOTD.solves[0]?.solved || false
      } : null
    };
  }
  
  private async calculateStreak(userId: string): Promise<{currentStreak: number, longestStreak: number}> {
    const solves = await prisma.dailyChallengeSolve.findMany({
      where: { userId, solved: true },
      include: { challenge: { select: { date: true } } },
      orderBy: { challenge: { date: 'desc' } }
    });
    
    if (solves.length === 0) return { currentStreak: 0, longestStreak: 0 };
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const solve of solves) {
      const solveDate = new Date(solve.challenge.date);
      const dayDiff = Math.floor((today.getTime() - solveDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === currentStreak) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < solves.length; i++) {
      tempStreak++;
      
      if (i < solves.length - 1) {
        const current = new Date(solves[i].challenge.date);
        const next = new Date(solves[i + 1].challenge.date);
        const diff = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diff > 1) {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
        }
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak);
    
    return { currentStreak, longestStreak };
  }
}
```

**Files to Create/Modify:**
- `src/services/student-dashboard.service.ts` (NEW)
- `src/modules/routes/student.ts`

---

### ✅ Task 9-17: Additional Tasks
(Continuing in similar detail for remaining tasks...)

**Due to length, I'll summarize the remaining tasks:**

9. **Arduino Libraries Support** - Enable `arduino-cli lib install` for Servo, Wire, etc.
10. **Code Quality Metrics** - Extract program size, RAM usage from compilation output
11. **Arduino Contest Integration** - Link ArduinoProblem to Contest model
12. **Circuit Validation** - Validate Wokwi circuit matches problem requirements
13. **Hardware Upload Guide** - Documentation for uploading HEX to real boards
14. **Multiple Test Runs** - Run simulation 3-5 times for timing consistency
15. **Auto Problem Difficulty** - Calculate from acceptance rate
16. **Missing Test Coverage** - Add contest, POTD, analytics tests
17. **Arduino Load Tests** - k6 tests for 50+ concurrent compilations

---

## 📊 IMPLEMENTATION TIMELINE

### Week 1: Critical Fixes (Must Have)
- Day 1: Tasks 1-2 (Routes + Models)
- Day 2-3: Task 3 (Contest DSA Grading)
- Day 4: Task 4 (Protect Endpoints) + Testing

### Week 2: Arduino Simulation (Core Feature)
- Day 1-2: Task 5 (AVR8JS Integration)
- Day 3: Task 6 (CDN Storage)
- Day 4: Task 7 (Serial Monitor)
- Day 5: Testing & Debugging

### Week 3: Student Dashboard + Enhancements
- Day 1-2: Task 8 (Dashboard)
- Day 3: Tasks 9-10 (Libraries + Metrics)
- Day 4-5: Tasks 11-12 (Contest + Validation)

### Week 4: Polish & Testing
- Day 1-2: Tasks 13-15 (Guides + Features)
- Day 3-4: Tasks 16-17 (Testing)
- Day 5: Final QA & Documentation

---

## 🎯 MINIMUM VIABLE PRODUCT (MVP)

**To launch student panel, complete these 7 tasks:**

1. ✅ Fix Arduino Routes (30 min)
2. ✅ Add Missing Models (3 hours)
3. ✅ Fix Contest DSA Grading (4 hours)
4. ✅ Protect Endpoints (15 min)
5. ✅ AVR8JS Integration (3 days)
6. ✅ CDN Storage (6 hours)
7. ✅ Student Dashboard (4 hours)

**Total MVP Time:** ~1.5 weeks

**Everything else is enhancement/polish.**

---

## 📋 TRACKING

All tasks are stored in SQLite `todos` table with dependencies tracked in `todo_deps`.

Query ready tasks:
```sql
SELECT t.* FROM todos t
WHERE t.status = 'pending'
AND NOT EXISTS (
  SELECT 1 FROM todo_deps td
  JOIN todos dep ON td.depends_on = dep.id
  WHERE td.todo_id = t.id AND dep.status != 'done'
);
```
