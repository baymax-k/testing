Based on my comprehensive analysis of the CodeEthnics backend codebase, here's a complete overview:

---

# **COMPREHENSIVE CODEETHNICS BACKEND ANALYSIS**

## **1. PROJECT STRUCTURE**

### **Directory Layout - `/src`**
```
src/
├── __tests__/                    # Test files (college-admin integration tests)
├── app.ts                        # Express app configuration
├── server.ts                     # Entry point
├── config/                       # Configuration modules
│   ├── index.ts                 # Config exports
│   ├── auth.ts                  # Better Auth configuration
│   ├── cors.ts                  # CORS settings
│   ├── prisma.ts                # Prisma client
│   ├── redis.ts                 # Redis client singleton
│   ├── bullmq.ts                # BullMQ queue configuration
│   ├── rateLimiter.ts           # Express rate limiters
│   └── swagger.ts               # OpenAPI/Swagger docs
├── middleware/
│   ├── auth.ts                  # JWT & Better Auth middleware
│   └── rate-limiter.ts          # Arduino-specific rate limiters
├── modules/
│   ├── auth/                    # Authentication (JWT + Better Auth)
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   └── auth.service.ts
│   ├── controllers/             # Business logic layer
│   │   ├── submission.controller.ts
│   │   ├── practice.controller.ts
│   │   ├── contest.controller.ts
│   │   ├── potd.controller.ts
│   │   ├── problem.controller.ts
│   │   ├── student.controller.ts
│   │   ├── practiceActivity.controller.ts
│   ├── services/                # Services
│   │   ├── judge0.service.ts    # Judge0 integration
│   │   ├── submission.service.ts
│   │   ├── potd.service.ts      # Problem of the Day logic
│   │   ├── student.service.ts
│   │   ├── userService.ts       # User management
│   │   ├── departmentService.ts
│   │   ├── batchService.ts
│   │   ├── testService.ts       # Test management
│   │   ├── reportService.ts     # Analytics/reporting
│   │   ├── practiceRandom.service.ts
│   │   └── practiceActivity.service.ts
│   ├── routes/                  # Route definitions
│   │   ├── admin.ts             # Product admin endpoints
│   │   ├── student.ts           # Student dashboard
│   │   ├── common.ts            # Health/status endpoints
│   │   ├── problem.ts           # Problem listing
│   │   ├── submission.ts        # Code submission
│   │   ├── judge0.ts            # Judge0 health check
│   │   ├── college-admin.ts     # Institution management (4136 lines)
│   │   └── student/
│   │       ├── practice.ts      # Problem practice
│   │       ├── contest.ts       # Contests
│   │       └── potd.ts          # Problem of the Day
│   ├── arduino/                 # Arduino compilation system
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── validators/
│   ├── validators/
│   │   └── submission.validator.ts
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── migrations/          # 14+ schema versions
│   └── data/
│       └── problems/            # Problem definitions (JSON)
│           ├── index.ts         # Problem loader
│           └── types.ts         # Problem type definitions
├── services/                    # Root-level services
│   ├── arduino-compiler.service.ts
│   └── arduino-job.service.ts
├── workers/
│   └── arduino-worker.ts        # BullMQ worker for Arduino compilation
└── scripts/
    ├── seed.ts                  # Database seeding
    └── show-tables.ts           # DB debugging
```

### **Architectural Pattern**
- **MVC-based**: Controllers → Services → Data access (Prisma)
- **Modular Routes**: Separate route files per feature
- **Service-oriented**: Business logic in dedicated service files
- **Middleware-based auth**: Two auth systems (JWT + Better Auth)
- **Worker pattern**: BullMQ for async Arduino compilation jobs
- **Rate limiting**: Per-feature rate limiters

---

## **2. API ENDPOINTS - COMPREHENSIVE LIST**

### **Authentication Routes** (`/api/v1/auth`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/sign-up` | ❌ | Register new user |
| POST | `/sign-in` | ❌ | Login with credentials |
| POST | `/sign-in/google` | ❌ | Google OAuth sign-in |
| GET | `/google-client-id` | ❌ | Retrieve Google OAuth client ID |
| POST | `/sign-out` | ❌ | Logout user |
| POST | `/refresh` | ❌ | Refresh access token |
| GET | `/status` | ❌ | Check auth status |
| POST | `/verify-email` | ❌ | Verify email with OTP |
| POST | `/send-otp` | ❌ | Send OTP for email verification |
| POST | `/forgot-password` | ❌ | Initiate password reset |
| POST | `/reset-password` | ❌ | Complete password reset |
| POST | `/change-password` | ✅ | Change authenticated user's password |

### **Student Routes** (`/api/v1/student`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/dashboard` | ✅ | Student dashboard (coming soon) |
| GET | `/profile` | ✅ | Get student profile |

### **Practice Routes** (`/api/v1/student/practice`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | ✅ | List practice problems with filters |
| GET | `/mcq/topics` | ✅ | List available MCQ topics |
| GET | `/mcq/stats` | ✅ | Get MCQ practice statistics |
| POST | `/mcq/session` | ✅ | Create MCQ practice session by topics |
| POST | `/random` | ✅ | Generate random MCQ set (non-persistent) |
| GET | `/mcq/session/:sessionId` | ✅ | Get/resume MCQ session |
| POST | `/mcq/session/submit` | ✅ | Submit all MCQ answers in session |
| GET | `/mcq/history` | ✅ | Get MCQ practice session history |
| GET | `/mcq/history/:sessionId` | ✅ | Get MCQ session detail |
| POST | `/mcq` | ✅ | Submit single MCQ answer (instant feedback) |
| POST | `/activity` | ✅ | Record practice activity |
| GET | `/activity` | ✅ | Get today's activity or historical range |
| GET | `/:id` | ✅ | Get problem details |

### **Contest Routes** (`/api/v1/student/contest`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | ✅ | List contests with pagination/filters |
| GET | `/:id` | ✅ | Get contest details |
| GET | `/:id/mcq` | ✅ | Get MCQ questions for contest |
| POST | `/join` | ✅ | Join a contest |
| POST | `/submit-dsa` | ✅ | Submit DSA solution in contest |
| POST | `/submit-mcq` | ✅ | Submit MCQ answers in contest |
| GET | `/:id/leaderboard` | ✅ | Get contest leaderboard |

### **Problem of the Day Routes** (`/api/v1/student/potd`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | ✅ | Get today's Problem of the Day |
| POST | `/solve` | ✅ | Submit POTD answer (MCQ or DSA) |
| GET | `/streak` | ✅ | Get user's solving streak |
| GET | `/history` | ✅ | Get POTD history |

### **Code Submission Routes** (`/api/v1/submissions`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/run` | ✅ | Run code with custom stdin (playground) |
| POST | `/test` | ✅ | Test code against sample test cases only |
| POST | `/` | ✅ | Submit code for final evaluation |
| GET | `/` | ✅ | List user's submission history |
| GET | `/:id` | ✅ | Get submission details |

### **Problem Routes** (`/api/v1/problems`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | ✅ | List all problems |
| GET | `/:slug` | ✅ | Get problem by slug with sample test cases |

### **Arduino Routes** (`/api/v1/arduino`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/health` | ❌ | Arduino service health check |
| GET | `/boards` | ✅ | List supported Arduino boards |
| GET | `/problems` | ✅ | List Arduino problems |
| GET | `/problems/:problemId` | ✅ | Get Arduino problem details |
| POST | `/compile` | ✅ | Compile Arduino code (rate-limited) |
| GET | `/jobs/:submissionId` | ✅ | Get compilation job status |
| GET | `/submissions` | ✅ | List user's Arduino submissions |
| DELETE | `/jobs/:submissionId` | ✅ | Cancel compilation job |
| POST | `/validate` | ✅ | Validate submission against test cases |
| GET | `/admin/queue/stats` | ✅ | Get queue statistics (admin) |

### **Admin Routes** (`/api/v1/admin`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/dashboard` | ✅ | Admin dashboard (product_admin) |
| POST | `/create-user` | ✅ | Create staff/admin user |

### **Judge0 Routes** (`/api/v1/judge0`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/health` | ❌ | Judge0 health check with version info |

### **Common Routes** (`/api/v1`)
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | ❌ | API health check |
| GET | `/me` | ✅ | Get current user info & redirect URL |

### **College Admin Routes** (`/api/college-admin`) - **37+ Endpoints**
**Authentication (5 endpoints):**
- `POST /auth/login` - College admin login
- `POST /auth/logout` - Logout
- `POST /auth/refresh-token` - Token refresh
- `POST /auth/forgot-password` - Password reset initiation
- `POST /auth/reset-password` - Complete password reset

**Profile (2 endpoints):**
- `GET /profile` - Get admin profile
- `PUT /profile` - Update admin profile

**User Management (8 endpoints):**
- `GET /users` - List users with pagination
- `POST /users` - Create single user
- `POST /users/bulk` - Bulk create users (max 100)
- `PUT /users/:userId` - Update user
- `DELETE /users/:userId` - Delete user
- `PUT /users/:userId/role` - Assign role
- `PUT /users/:userId/department` - Assign department

**Department Management (6 endpoints):**
- `GET /departments` - List departments
- `POST /departments` - Create department
- `PUT /departments/:deptId` - Update department
- `DELETE /departments/:deptId` - Delete department
- `GET /departments/:deptId/users` - Get department users
- `PUT /departments/:deptId/hod` - Assign HOD

**Batch Management (7 endpoints):**
- `GET /batches` - List batches
- `POST /batches` - Create batch
- `PUT /batches/:batchId` - Update batch
- `DELETE /batches/:batchId` - Delete batch
- `POST /batches/:batchId/students` - Assign students
- `DELETE /batches/:batchId/students` - Remove students
- `PUT /batches/:batchId/mentor` - Assign mentor

**Student Management (3+ endpoints):**
- `POST /students` - Create student
- `POST /students/bulk` - Bulk create students
- `GET /students/:studentId` - Get student details

**Test Management (5+ endpoints):**
- `POST /tests` - Create test
- `GET /tests` - List tests
- `PUT /tests/:testId` - Update test
- `DELETE /tests/:testId` - Delete test
- `POST /tests/:testId/questions` - Add questions to test
- `GET /tests/:testId/questions` - List test questions
- `GET /tests/:testId/status` - Real-time test status

**Reports/Analytics (6+ endpoints):**
- `GET /report/student/:studentId` - Student performance report
- `GET /report/student/:studentId/skillset` - Student skills summary
- `GET /report/batch/:batchId` - Batch performance report
- `GET /report/batch/:batchId/leaderboard` - Batch leaderboard
- `GET /report/test/:testId/analysis` - Test analysis
- `GET /report/department/:deptId` - Department performance

---

## **3. DATABASE SCHEMA**

### **Core Models (Currently Implemented)**

**User Management:**
```typescript
model User {
  id             String           @id @default(cuid())
  email          String           @unique
  username       String           @unique
  name           String
  passwordHash   String
  role           Role             // student | college_admin | product_admin | instructor_staff
  emailVerified  Boolean          @default(false)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  
  refreshTokens       RefreshToken[]
  submissions         Submission[]
  participations      ContestParticipation[]
  arduinoSubmissions  ArduinoSubmission[]
  codeDrafts          CodeDraft[]
}

enum Role {
  student
  college_admin
  product_admin
  instructor_staff
}
```

**Authentication:**
```typescript
model RefreshToken {
  id        String   @id @default(cuid())
  jti       String   @unique  // JWT ID for revocation
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Verification {
  id         String   @id
  identifier String   // "<email>:<type>"
  value      String   // SHA-256 hash of OTP
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Content Models:**
```typescript
model Question {
  id              String       @id @default(cuid())
  type            QuestionType // mcq | dsa | arduino
  title           String
  description     String       // markdown for DSA
  difficulty      String       // easy | medium | hard
  tags            Tag[]
  company         String?
  createdBy       String       // admin user ID
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  // MCQ-specific
  options         Json?        // ["Option A", "Option B", ...]
  correctAnswer   Int?         // 0-3
  
  // DSA-specific
  timeLimit       Int?         // seconds
  memoryLimit     Int?         // KB
  sampleTestCases Json?        // [{input, output, explanation}]
  hiddenTestCases Json?        // [{input, expectedOutput}]
  
  contests          ContestQuestion[]
  arduinoProblem    ArduinoProblem?
}

model Tag {
  id        String     @id @default(cuid())
  name      String     @unique
  type      String     // "topic" or "company"
  questions Question[]
}

enum QuestionType {
  mcq
  dsa
  arduino
}
```

**Contest Models:**
```typescript
model Contest {
  id           String      @id @default(cuid())
  title        String
  description  String
  type         ContestType // contest | practice
  startTime    DateTime?
  endTime      DateTime?
  duration     Int?        // minutes
  createdBy    String      // admin user ID
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  
  questions      ContestQuestion[]
  participations ContestParticipation[]
}

model ContestParticipation {
  id                  String    @id @default(cuid())
  userId              String
  contestId           String
  startedAt           DateTime  @default(now())
  submittedAt         DateTime?
  score               Int       @default(0)
  mcqAnswers          Json?     // {questionId: selectedOptionIndex}
  
  dsaSubmissions      Submission[]
  arduinoSubmissions  ArduinoSubmission[]
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  contest             Contest   @relation(fields: [contestId], references: [id], onDelete: Cascade)
  
  @@unique([userId, contestId])
}

enum ContestType {
  contest
  practice
}
```

**Submission Models:**
```typescript
model Submission {
  id              String           @id @default(cuid())
  userId          String
  problemId       String           // JSON slug reference
  language        String?
  languageId      Int?             // Judge0 language ID
  sourceCode      String?
  status          SubmissionStatus @default(processing)
  testCasesPassed Int              @default(0)
  totalTestCases  Int              @default(0)
  failedAt        Int?             // 1-indexed test case
  runtime         String?
  memory          Int?             // KB
  errorOutput     String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  
  contestParticipationId String?
  contestParticipation   ContestParticipation?
  user                   User       @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum SubmissionStatus {
  processing
  accepted
  wrong_answer
  time_limit_exceeded
  memory_limit_exceeded
  runtime_error
  compilation_error
  internal_error
}
```

**Arduino Models:**
```typescript
model ArduinoProblem {
  id               String   @id @default(cuid())
  questionId       String   @unique
  board            String   // "uno" | "mega"
  fqbn             String   // Fully Qualified Board Name
  libraries        String[] // ["Servo.h", "Wire.h"]
  starterCode      String   @db.Text
  simulationConfig Json     // Wokwi diagram
  timeLimitMs      Int      @default(2000)
  memoryLimitKb    Int      @default(256)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  testCases    ArduinoTestCase[]
  submissions  ArduinoSubmission[]
  question     Question           @relation(fields: [questionId], references: [id], onDelete: Cascade)
}

model ArduinoTestCase {
  id             String  @id @default(cuid())
  problemId      String
  label          String  // "LED blinks every 1 second"
  type           String  // "pin_state" | "toggle_count" | "serial_output"
  isHidden       Boolean @default(false)
  pin            Int?
  expectedState  String? // "HIGH" | "LOW"
  atMs           Int?
  toleranceMs    Int?    @default(100)
  minToggles     Int?
  withinMs       Int?
  expectedOutput String? @db.Text
  order          Int
  
  problem ArduinoProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)
}

model ArduinoSubmission {
  id              String           @id @default(cuid())
  userId          String
  problemId       String
  sourceCode      String           @db.Text
  status          SubmissionStatus @default(processing)
  hexFile         String?
  verdict         Json?            // Detailed test results
  testCasesPassed Int              @default(0)
  totalTestCases  Int              @default(0)
  compileTime     Int?             // milliseconds
  runtime         String?
  errorOutput     String?          @db.Text
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  
  contestParticipationId String?
  contestParticipation   ContestParticipation?
  user                   User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem                ArduinoProblem        @relation(fields: [problemId], references: [id], onDelete: Cascade)
}
```

**Code Draft:**
```typescript
model CodeDraft {
  id        String   @id @default(cuid())
  userId    String
  problemId String
  code      String   @db.Text
  language  String?  // "cpp" for Arduino, or Judge0 language
  updatedAt DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, problemId])
}
```

### **Missing College Admin Models**
The Prisma schema is **incomplete** - the college-admin routes reference models that don't exist in the schema:
- ❌ `Department` - Referenced in routes but not in schema
- ❌ `Batch` - Referenced in routes but not in schema
- ❌ `DailyChallenge` / `DailyChallengeSolve` - Referenced in POTD service
- ❌ `MCQPracticeSession` - Referenced in practice routes
- ❌ `PracticeActivity` - Referenced in services
- ❌ `Test` / `TestQuestion` - Referenced in college-admin routes
- ❌ Reports/Analytics tables - Referenced in reportService.ts

**Schema Status**: The database schema file only has **18 models/enums** but the application code assumes 25+. This is a **critical gap**.

---

## **4. AUTHENTICATION & AUTHORIZATION**

### **Auth System Architecture**

**Dual Auth Implementation:**
1. **JWT-based (Legacy)**: Used for student/regular users
   - Access token: Stored in `access_token` cookie, expires in 15m
   - Refresh token: Stored in `refresh_token` cookie, expires in 7d
   - Secrets: `JWT_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars)

2. **Better Auth (OAuth)**: Used for college-admin portal
   - Prisma adapter for PostgreSQL
   - Email verification required
   - Session-based (7 day expiration)

### **Middleware**

```typescript
// JWT auth for standard endpoints
export const requireAuth = (req: Request, res: Response, next: NextFunction): void
// Reads access_token cookie, verifies JWT, attaches payload to req.user

// Better Auth session for college admin
export const requireCollegeAdminAuth = async (req: Request, res: Response, next: NextFunction): Promise<void>
// Uses Better Auth, loads full user from database

// Role-based access control
export const requireRole = (...roles: string[]) => ...
// Checks req.user.role against allowed roles
```

### **Roles & Permissions**

**Available Roles:**
- `student` - Regular coding platform users
- `college_admin` - Institution managers
- `product_admin` - Platform administrators
- `instructor_staff` - Teaching assistants/instructors

**Protection Patterns:**
```
/api/v1/student/* → requireAuth, requireRole("student")
/api/v1/admin/* → requireAuth, requireRole("product_admin")
/api/college-admin/* → requireCollegeAdminAuth
/api/v1/submissions/* → requireAuth (any authenticated user)
/api/v1/arduino/* → requireAuth (mixed public/protected)
```

### **Rate Limiting**

- **Login limiter**: 5 attempts per 15 minutes
- **Auth limiter**: General auth rate limit
- **Submission limiter**: Code submissions/tests
- **Arduino compile limiter**: 5 compilations per minute (configurable)
- **Submission limiter**: General submission rate limit

---

## **5. KEY FEATURES IMPLEMENTED**

### **Core Coding Platform**
✅ **Problem Solving (DSA)**
- Judge0 integration for 7 languages (C, C++, Java, JavaScript, Python, Go, Rust)
- Sample test cases (visible)
- Hidden test cases (for evaluation)
- Time/memory limits per problem
- Code drafts saving
- Submission history

✅ **MCQ Practice**
- Topic-based practice sessions
- Random MCQ generation (up to 25 per session)
- Instant feedback
- Practice statistics & accuracy tracking
- Session history with results

✅ **Problem of the Day (POTD)**
- Daily challenge selection (MCQ or DSA)
- Streak tracking
- Auto-selection if no manual challenge
- Support for both MCQ and DSA problem types
- History tracking

✅ **Contests**
- Contest listing with status filters (upcoming/active/past)
- Contest participation tracking
- Separate submission queues for DSA and MCQ
- Leaderboard by score
- Time window enforcement

✅ **Arduino Compilation**
- Arduino CLI integration for real hardware compilation
- Support for Uno, Mega boards
- BullMQ queue for async compilation
- Test case validation
- Simulation support via Wokwi
- Compilation job status tracking

✅ **Code Execution**
- **Run**: Execute code with custom stdin (no save)
- **Test**: Pre-submit against sample test cases only
- **Submit**: Full evaluation against all test cases
- Async job processing with Redis queue

### **College Admin Features**
✅ **User Management**
- Bulk user creation (up to 100 users)
- User search/filtering
- Role assignment
- Department assignment
- Account deletion

✅ **Department Management**
- Create/update/delete departments
- HOD assignment
- Department user listing
- Hierarchical structure support

✅ **Batch Management**
- Create/manage batches by department
- Bulk student assignment
- Mentor assignment
- Year/semester tracking

✅ **Test Management** (Schema incomplete)
- Create tests (likely for MCQ/DSA)
- Add questions to tests
- Real-time test status
- Test analysis reports

✅ **Analytics & Reporting**
- Student performance reports
- Student skillset summary
- Batch leaderboard
- Batch performance reports
- Test analysis reports
- Department performance reports

### **Student Features**
✅ **Dashboard** (Placeholder - "coming soon")
- Basic dashboard structure

✅ **Profile**
- View student profile

✅ **Activity Tracking**
- Practice activity logging
- Custom activity range queries

### **Supporting Features**
✅ **Email System**
- OTP-based email verification
- Password reset emails
- Mailtrap (dev) / AWS SES (prod) support

✅ **Google OAuth**
- Google sign-in integration
- ID token verification
- Automatic user creation

✅ **Rate Limiting**
- Per-user rate limits on submissions
- Brute-force protection on login
- Arduino compilation throttling

✅ **Database**
- PostgreSQL with Prisma ORM
- Migrations (14+ versions tracked)
- Cascading deletes for data integrity

✅ **Caching & Sessions**
- Redis for rate limiting buckets
- Session caching via Better Auth
- BullMQ for async jobs

✅ **Documentation**
- Swagger/OpenAPI endpoints
- Swagger UI at `/api-docs`

---

## **6. WORKFLOW & DATA FLOW**

### **Typical Code Submission Flow**

```
1. Student submits code:
   POST /api/v1/submissions/
   {
     "problemId": "two-sum",
     "language": "python",
     "sourceCode": "...",
   }

2. Auth Middleware:
   - Extract access_token from cookies
   - Verify JWT signature
   - Attach user info to req.user

3. Controller Handler (submission.controller.ts):
   - Parse and validate request
   - Call submission.service.submitCode()

4. Service Layer:
   - Load problem from JSON files
   - Create database record (status: "processing")
   - Call judge0.service.executeTestCases()

5. Judge0 Integration:
   - Send source code + test cases to Judge0 API
   - Poll for results (test case by test case)
   - Early exit on first failure

6. Result Processing:
   - Map Judge0 status codes to SubmissionStatus enum
   - Calculate test cases passed/failed
   - Store in database

7. Response:
   {
     "submissionId": "...",
     "status": "accepted",
     "testCasesPassed": 5,
     "totalTestCases": 5,
     "runtime": "0.045s",
     "memory": 12544,
     "testCaseResults": [...]
   }
```

### **Arduino Compilation Flow**

```
1. Student submits code:
   POST /api/v1/arduino/compile
   {
     "problemId": "...",
     "sourceCode": "..."
   }

2. Controller:
   - Validate request
   - Create ArduinoSubmission record (status: "processing")
   - Queue compilation job

3. BullMQ Queue:
   - Job added to "arduino:compile" queue
   - Picked up by arduino-worker.ts
   - Concurrency: 8 jobs max

4. Arduino Worker:
   - Call arduino-compiler.service.compile()
   - Compile code to HEX file
   - Validate against test cases

5. Storage:
   - Store HEX file (local or CDN)
   - Update submission with results

6. Frontend polling:
   GET /api/v1/arduino/jobs/:submissionId
   Returns: { status, progress, result }
```

### **Practice Session Flow**

```
1. Student selects topics:
   POST /api/v1/student/practice/mcq/session
   { "topics": ["arrays", "strings"], "difficulty": "medium" }

2. Service:
   - Query database for matching questions
   - Create MCQPracticeSession record
   - Return paginated questions

3. Student answers:
   POST /api/v1/student/practice/mcq
   { "questionId": "...", "selectedOption": 2 }

4. Instant Feedback:
   - Check against correctAnswer
   - Return { isCorrect, correctAnswer }
   - Log to practiceActivity table

5. Session Completion:
   POST /api/v1/student/practice/mcq/session/submit
   { "sessionId": "...", "answers": [...] }
   
   - Calculate final score
   - Mark session as complete
   - Update practice statistics
```

### **Contest Submission Flow**

```
1. Join Contest:
   POST /api/v1/student/contest/join
   { "contestId": "..." }
   → Creates ContestParticipation record

2. Submit DSA:
   POST /api/v1/student/contest/submit-dsa
   {
     "contestId": "...",
     "problemId": "...",
     "code": "...",
     "language": "python"
   }
   → Submission linked to ContestParticipation

3. Submit MCQ:
   POST /api/v1/student/contest/submit-mcq
   { "contestId": "...", "answers": {...} }
   → Answers stored in contestParticipation.mcqAnswers (JSON)

4. Scoring:
   - DSA: Points = test cases passed / total × max_points
   - MCQ: Points = correct answers × points_per_question
   - Total score calculated at submission time
```

### **POTD (Problem of the Day) Flow**

```
1. Get Today's Challenge:
   GET /api/v1/student/potd
   
   Service checks:
   - Is there a DailyChallenge for today?
   - If not, auto-select one (prefer unused in 30 days)
   - Check if user already solved it

2. Solve Challenge:
   POST /api/v1/student/potd/solve
   { "dailyChallengeId": "...", "selectedOption": 1 }
   
   For MCQ:
   - Verify correct answer
   - Create DailyChallengeS olve record
   - Update streak if successful

   For DSA:
   - Execute against test cases
   - Record attempt
   - Update streak if all pass

3. Streak Management:
   - Track consecutive days solved
   - Longest streak recorded
   - Return on GET /streak endpoint
```

---

## **7. CONFIGURATION & ENVIRONMENT**

### **Key Environment Variables**

**Database**
```env
DATABASE_URL=postgresql://user:pass@host:5432/codeethnics?schema=public
```

**Authentication**
```env
JWT_SECRET=random-32+-char-string
JWT_REFRESH_SECRET=random-32+-char-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-oauth-client-id
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=random-256-bit-string
```

**Email**
```env
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-mailtrap-user
EMAIL_PASS=your-mailtrap-pass
EMAIL_FROM=CodeEthnics <no-reply@codeethnics.com>
```

**Code Execution**
```env
JUDGE0_URL=http://localhost:2358
JUDGE0_AUTH_TOKEN=optional-auth-token
```

**Arduino**
```env
ARDUINO_SERVICE_URL=http://localhost:3001
ARDUINO_COMPILE_TIMEOUT=30 # seconds
ARDUINO_COMPILE_RATE_LIMIT=5 # per minute
ARDUINO_WORKER_CONCURRENCY=5
ARDUINO_SIMULATION_TIMEOUT=15 # seconds
```

**Caching & Queues**
```env
REDIS_URL=redis://localhost:6379  # (or use REDIS_HOST/PORT/PASSWORD)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
```

**CORS**
```env
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,https://app.codeethnics.com
```

**Server**
```env
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5000
```

### **Config Files**

- `src/config/auth.ts` - Better Auth setup with email OTP plugin
- `src/config/cors.ts` - CORS configuration
- `src/config/redis.ts` - Redis singleton
- `src/config/bullmq.ts` - BullMQ queue configuration
- `src/config/rateLimiter.ts` - Express rate limiters
- `src/config/swagger.ts` - OpenAPI documentation

---

## **8. TESTING**

### **Test Files (26 test suites)**

**Integration Tests:**
- `test/judge0.integration.test.ts` - Judge0 integration (requires `RUN_JUDGE0_INTEGRATION=true`)
- `test/arduino.integration.test.ts` - Arduino compilation
- `test/code.execution.integration.test.ts` - Code execution
- `test/mcq.evaluation.integration.test.ts` - MCQ scoring
- `test/practice.streak.integration.test.ts` - Practice streaks
- `test/test.creation.integration.test.ts` - Test creation
- `test/practice.random.integration.test.ts` - Random MCQ generation
- `src/__tests__/college-admin/integration.test.ts` - College admin API (37 endpoints)

**Unit Tests:**
- `test/judge0.unit.test.ts` - Judge0 service utilities
- `test/practice.random.unit.test.ts` - Random MCQ logic
- `test/mcq-submission.unit.test.ts` - MCQ answer validation
- `test/practiceActivity.unit.test.ts` - Activity tracking
- `test/performance.unit.test.ts` - Performance metrics
- `test/streak.unit.test.ts` - Streak calculation

**Authentication Tests:**
- `test/auth.test.ts` - Basic auth flows
- `test/auth.google.test.ts` - Google OAuth integration
- `src/__tests__/college-admin/auth.test.ts` - College admin auth

**Endpoint Tests:**
- `test/problem.fetch.test.ts` - Problem fetching
- `test/practice.random.endpoint.test.ts` - Random MCQ endpoint

**Other**
- `test/arduino.smoke-test.ts` - Arduino compilation smoke test

### **Test Coverage Areas**
- ✅ Code execution (Judge0)
- ✅ Authentication (JWT, Google, Better Auth)
- ✅ MCQ evaluation logic
- ✅ Practice streaks/activity
- ✅ Arduino compilation
- ✅ College admin user management
- ❌ Contest functionality (minimal/missing)
- ❌ POTD edge cases
- ❌ Code draft saving
- ❌ Full analytics pipeline

### **Running Tests**
```bash
pnpm test                       # All tests
pnpm test:watch                # Watch mode
pnpm test:coverage             # Coverage report
pnpm test:integration          # College admin integration only
pnpm test:unit                 # Unit tests only
pnpm test:judge0              # Judge0 (requires env var)
pnpm test:arduino             # Arduino compilation
```

---

## **9. MISSING & INCOMPLETE FEATURES**

### **Critical Database Schema Gaps**
1. **No `Department` model** - Exists in college-admin routes but not in schema
2. **No `Batch` model** - Referenced in routes but not defined
3. **No `DailyChallenge` / `DailyChallengeS olve` models** - Used in POTD service
4. **No `MCQPracticeSession` / `MCQSessionAnswer` models** - Practice sessions stored but schema missing
5. **No `PracticeActivity` model** - Used in routes, no schema
6. **No `Test` / `TestQuestion` / `TestParticipation` models** - College admin test management
7. **No `Report` / `Analytics` tables** - Report generation without schema

**Impact**: College admin routes will fail when attempting CRUD operations on these entities.

### **Incomplete Features**

| Feature | Status | Issue |
|---------|--------|-------|
| **Student Dashboard** | 🟡 Placeholder | Endpoints exist but return "coming soon" |
| **Contest DSA Grading** | 🟡 Partial | Has `TODO: Send to Judge0` comment in code |
| **Solved Problem Tracking** | 🟡 TODO | Arduino controller marks as not implemented |
| **Admin Analytics** | 🟡 Placeholder | Admin dashboard shows "coming soon" |
| **College Admin Reports** | 🟡 Pending | ReportService defined but models missing |
| **Code Drafts** | ✅ Complete | Implemented for all languages |
| **POTD DSA Support** | ✅ Complete | Both MCQ and DSA supported |

### **Known Issues**

1. **College Admin Schema Mismatch**
   - Routes assume 25+ database models but schema only defines 18
   - Bulk operations will fail at database layer

2. **Contest DSA Submission**
   - Controller has `TODO` comment for Judge0 integration
   - DSA contest submissions may not grade properly

3. **Arduino Test Coverage**
   - Smoke tests only, no full compilation+validation tests
   - Integration tests require external Arduino service

4. **Error Handling**
   - College admin API returns 500 for non-existent users (should be 401)
   - Some edge cases in MCQ session handling untested

5. **Missing Models Cause Cascading Failures**
   - DepartmentService, BatchService, TestService all reference undefined models
   - College admin routes will runtime crash when trying to create/fetch these entities

### **Partially Implemented Services**

```typescript
// These services exist but lack database schema support:
- DepartmentService.ts          // Expects department table
- BatchService.ts               // Expects batch table
- TestService.ts                // Expects test/test_question tables
- ReportService.ts              // Complex queries on undefined models
```

### **Code Cleanup Needs**

- Unused imports in some controllers
- Swagger docs included in college-admin.ts (not ideal)
- Some console.logs not consistent (some with `[]`, some without)
- Mixed async/await and `.then()` patterns in some services

---

## **10. TECH STACK & INTEGRATIONS**

### **External Services**

| Service | Purpose | Status | Config |
|---------|---------|--------|--------|
| **Judge0 API** | Code execution sandbox | ✅ Active | `JUDGE0_URL`, `JUDGE0_AUTH_TOKEN` |
| **Arduino CLI** | Hardware compilation | ✅ Active | Microservice at `ARDUINO_SERVICE_URL` |
| **PostgreSQL** | Primary database | ✅ Active | `DATABASE_URL` |
| **Redis** | Caching & queues | ✅ Active | `REDIS_URL` or host/port |
| **Google OAuth** | Social login | ✅ Active | `GOOGLE_CLIENT_ID` |
| **Mailtrap/SES** | Email delivery | ✅ Active | `EMAIL_*` vars |

### **Key Dependencies**

```json
{
  "runtime": "Node.js 20+",
  "framework": "Express 5.2.1",
  "database": {
    "orm": "Prisma 7.6.0",
    "adapter": "@prisma/adapter-pg",
    "driver": "pg 8.20.0"
  },
  "auth": "better-auth 1.5.5",
  "caching": "ioredis 5.10.1",
  "queues": "bullmq 5.71.1",
  "validation": "zod 4.3.6",
  "http": "axios 1.14.0",
  "security": {
    "helmet": "8.1.0",
    "bcrypt": "5.1.1",
    "jsonwebtoken": "9.0.2"
  },
  "email": "nodemailer 8.0.1",
  "oauth": "google-auth-library 10.6.1",
  "testing": "vitest 4.0.18"
}
```

---

## **SUMMARY: PROJECT MATURITY ASSESSMENT**

| Aspect | Status | Details |
|--------|--------|---------|
| **Core Functionality** | ✅ 85% | Judge0 integration, submissions, practice, contests working |
| **Arduino Support** | ✅ 80% | Compilation + testing with BullMQ queue system |
| **Authentication** | ✅ 90% | JWT + Better Auth implemented, Google OAuth working |
| **Database Schema** | ⚠️ 60% | 18/25+ models defined; critical college admin models missing |
| **College Admin** | ⚠️ 50% | Routes exist but models undefined; likely runtime failures |
| **Testing** | ✅ 75% | 26 test suites, good Judge0 & Arduino coverage |
| **Documentation** | ✅ 80% | Swagger docs, README, inline comments |
| **Error Handling** | 🟡 70% | Basic; some edge cases unhandled |
| **Production Ready** | ⚠️ 50% | Core features work; college admin needs schema completion |

**Critical Action Items:**
1. **Complete Prisma schema** with missing Department, Batch, Test, DailyChallenge models
2. **Migrate college-admin routes** to use corrected schema
3. **Complete test models** in database
4. **Add integration tests** for college admin CRUD operations
5. **Fix contest DSA grading** (Judge0 TODO)

This is a **feature-rich, well-structured backend** with solid core functionality but **requires immediate database schema fixes** before the college admin module becomes usable.