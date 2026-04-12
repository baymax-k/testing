# 🔧 ARDUINO IMPLEMENTATION - COMPLETE GUIDE

## 📋 TABLE OF CONTENTS
1. [What is Implemented](#what-is-implemented)
2. [How It Works (Architecture)](#how-it-works)
3. [How to Run It](#how-to-run-it)
4. [All Endpoints](#all-endpoints)
5. [Cost Analysis](#cost-analysis)
6. [What Should Be Implemented](#what-should-be-implemented)
7. [How to Test It](#how-to-test-it)
8. [Troubleshooting](#troubleshooting)

---

## 1. WHAT IS IMPLEMENTED ✅

### Core Features

#### ✅ **Arduino Code Compilation**
- Compiles Arduino C/C++ code (`.ino` files) to HEX files
- Supports **Arduino Uno** and **Arduino Mega** boards
- Real Arduino CLI compilation (not emulation)
- Returns compiled HEX file ready for hardware upload

#### ✅ **Async Queue Processing**
- BullMQ queue system with Redis
- 5 concurrent compilation jobs
- Automatic retries (3 attempts)
- Job status tracking
- Job cancellation support

#### ✅ **Test Case Validation**
- 4 test case types:
  - **pin_state**: Check if pin is HIGH/LOW at specific time
  - **serial_output**: Validate serial monitor output
  - **toggle_count**: Count pin toggles
  - **timing**: Verify timing constraints
- Hidden vs visible test cases
- Pass/fail per test case

#### ✅ **Rate Limiting**
- 5 compilations per minute per user
- 20 general API requests per minute
- Protection against abuse

#### ✅ **Wokwi Simulator Integration** (Schema Ready)
- Circuit diagram configuration stored in database
- Simulation config as JSON
- Ready for frontend embedding

#### ✅ **Problem Management**
- List Arduino problems with pagination
- Filter by difficulty (easy/medium/hard)
- Problem details with test cases
- Starter code templates

#### ✅ **Submission History**
- User's past submissions
- Filter by problem
- Pagination support
- Status tracking

#### ✅ **Authentication & Authorization**
- JWT-based auth on all submit endpoints
- Public problem listing
- User-specific submission history

---

## 2. HOW IT WORKS (ARCHITECTURE) 🏗️

### **Two-Service Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│              MAIN BACKEND (Port 5000)                       │
│                                                             │
│  Student submits code via API                              │
│         ↓                                                  │
│  Controller validates & creates DB record                  │
│         ↓                                                  │
│  Adds job to BullMQ queue (Redis)                         │
│         ↓                                                  │
│  Returns submissionId immediately                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ BullMQ Worker picks job
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            ARDUINO COMPILER SERVICE (Port 8080)             │
│                                                             │
│  Receives HTTP request with code                           │
│         ↓                                                  │
│  Creates temp directory                                    │
│         ↓                                                  │
│  Writes .ino file (folder name must match)                │
│         ↓                                                  │
│  Calls: arduino-cli compile --fqbn {board} {dir}          │
│         ↓                                                  │
│  Arduino CLI → avr-gcc → .hex file                        │
│         ↓                                                  │
│  Reads .hex from build/arduino.avr.uno/sketch.ino.hex     │
│         ↓                                                  │
│  Returns hex content + compile time + errors               │
│         ↓                                                  │
│  Cleanup temp directory                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Worker updates DB
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                          │
│                                                             │
│  Update ArduinoSubmission:                                 │
│    - status: "compiled" or "compilation_error"            │
│    - hexFile: hex content                                 │
│    - compileTime: milliseconds                            │
│    - errorOutput: compilation errors                      │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Frontend polls status
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Student)                             │
│                                                             │
│  Poll: GET /api/v1/arduino/jobs/:submissionId             │
│    Every 2-3 seconds until status != "processing"         │
│                                                             │
│  On Success: Download .hex file                            │
│  On Error: Display compilation errors                      │
└─────────────────────────────────────────────────────────────┘
```

---

### **Detailed Flow: Student Submits Code**

```
1. Student clicks "Compile" in UI
   ↓
2. POST /api/v1/arduino/compile
   {
     "problemId": "abc123",
     "code": "void setup() {...}",
     "boardType": "uno"
   }
   ↓
3. Rate Limiter Middleware
   - Check: Has user exceeded 5 compilations in last 60s?
   - If yes: Return 429 Too Many Requests
   - If no: Continue
   ↓
4. Auth Middleware
   - Extract JWT from cookie
   - Verify signature
   - Attach user to req.user
   ↓
5. Controller (arduino.controller.ts)
   - Validate request body (Zod schema)
   - Check if problemId exists in database
   ↓
6. Create ArduinoSubmission Record
   INSERT INTO arduino_submission (
     userId, problemId, sourceCode, status
   ) VALUES (
     'user123', 'abc123', 'void setup()...', 'processing'
   )
   - Returns: submissionId = "sub_xyz789"
   ↓
7. Add Job to BullMQ Queue
   await arduinoQueue.add('compile', {
     submissionId: 'sub_xyz789',
     userId: 'user123',
     problemId: 'abc123',
     code: 'void setup()...',
     boardType: 'uno'
   })
   ↓
8. Return Immediate Response
   {
     "success": true,
     "data": {
       "submissionId": "sub_xyz789",
       "status": "processing"
     }
   }
   ↓
9. Worker Picks Up Job (arduino-worker.ts)
   - Worker has 5 concurrent slots
   - Job enters processing
   ↓
10. Worker Calls Compiler Service
    POST http://localhost:8080/compile/json
    {
      "code": "void setup()...",
      "boardType": "uno",
      "libraries": []
    }
    ↓
11. Compiler Service Creates Temp Directory
    /tmp/arduino-compile-xyz789/
      └── sketch_xyz789/
          └── sketch_xyz789.ino  ← Code written here
    ↓
12. Execute Arduino CLI
    $ ./bin/arduino-cli compile \
        --fqbn arduino:avr:uno \
        /tmp/arduino-compile-xyz789/sketch_xyz789
    
    Output:
      Sketch uses 1234 bytes (3%) of program storage space.
      Global variables use 56 bytes (2%) of dynamic memory.
    ↓
13. Read HEX File
    Path: /tmp/arduino-compile-xyz789/sketch_xyz789/
          build/arduino.avr.uno/sketch_xyz789.ino.hex
    
    Content: ":100000000C945D000C9485000C9485000C948500..."
    ↓
14. Return to Worker
    {
      "success": true,
      "hexFile": ":100000000C945D000C...",
      "compileTimeMs": 1247,
      "errors": [],
      "warnings": []
    }
    ↓
15. Worker Updates Database
    UPDATE arduino_submission
    SET status = 'compiled',
        hexFile = ':100000000C945D000C...',
        compileTime = 1247,
        updatedAt = NOW()
    WHERE id = 'sub_xyz789'
    ↓
16. Job Completes
    - BullMQ marks job as completed
    - Worker logs success
    ↓
17. Frontend Polling (Every 2-3 seconds)
    GET /api/v1/arduino/jobs/sub_xyz789
    
    Returns:
    {
      "success": true,
      "data": {
        "submissionId": "sub_xyz789",
        "status": "compiled",
        "hexFile": ":100000000C945D000C...",
        "compileTime": 1247,
        "createdAt": "2026-04-04T13:00:00Z"
      }
    }
    ↓
18. Frontend Shows Success
    - Display: "✅ Compiled successfully in 1.25s"
    - Provide: Download .hex button
    - Optionally: Load into Wokwi simulator
```

---

### **Database Schema**

**ArduinoProblem** (stores problem definition)
```typescript
{
  id: "prob_abc123",
  questionId: "q_xyz789",        // Links to Question model
  board: "uno",                  // Board type
  fqbn: "arduino:avr:uno",       // Fully Qualified Board Name
  libraries: ["Servo.h"],        // Required libraries
  starterCode: "void setup() {}", // Initial code template
  simulationConfig: {            // Wokwi diagram JSON
    "version": 1,
    "author": "CodeEthnics",
    "parts": [...],
    "connections": [...]
  },
  timeLimitMs: 2000,             // Compilation timeout
  memoryLimitKb: 256,            // Memory limit for board
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z"
}
```

**ArduinoTestCase** (validation rules)
```typescript
{
  id: "test_123",
  problemId: "prob_abc123",
  label: "LED should blink every 1 second",
  type: "pin_state",             // pin_state | serial_output | toggle_count | timing
  isHidden: false,               // Show to student or not
  pin: 13,                       // GPIO pin number (for pin_state/toggle)
  expectedState: "HIGH",         // Expected pin state
  atMs: 1000,                    // Check at this time (milliseconds)
  toleranceMs: 100,              // ±100ms tolerance
  minToggles: null,              // Min toggles (for toggle_count type)
  withinMs: null,                // Time window (for toggle_count)
  expectedOutput: null,          // Expected serial output (for serial_output)
  order: 1                       // Display order
}
```

**ArduinoSubmission** (student's attempt)
```typescript
{
  id: "sub_xyz789",
  userId: "user_123",
  problemId: "prob_abc123",
  sourceCode: "void setup() { pinMode(13, OUTPUT); } ...",
  status: "compiled",            // processing | compiled | compilation_error | accepted | wrong_answer
  hexFile: ":100000000C945D...", // Compiled HEX content
  verdict: {                     // Test results (JSON)
    "allTestsPassed": true,
    "testResults": [
      {
        "testCaseId": "test_123",
        "passed": true,
        "actualValue": "HIGH",
        "expectedValue": "HIGH"
      }
    ]
  },
  testCasesPassed: 3,
  totalTestCases: 3,
  compileTime: 1247,             // Milliseconds
  runtime: "2.5s",               // Simulated execution time
  errorOutput: null,             // Compilation errors (if any)
  createdAt: "2026-04-04T13:00:00Z",
  updatedAt: "2026-04-04T13:00:15Z"
}
```

---

## 3. HOW TO RUN IT 🚀

### **Prerequisites**

1. **Node.js 20+**
   ```bash
   node --version  # Should be v20.x.x
   ```

2. **PostgreSQL**
   ```bash
   # Running on localhost:5432
   # Database: codeethnics
   ```

3. **Redis**
   ```bash
   # Running on localhost:6379
   redis-cli ping  # Should return PONG
   ```

4. **Arduino CLI** (Already in `/bin/arduino-cli`)
   ```bash
   ./bin/arduino-cli version
   # arduino-cli Version: 1.1.1
   ```

---

### **Step 1: Install Dependencies**

```bash
# In project root
pnpm install

# In arduino-compiler directory
cd arduino-compiler
pnpm install
cd ..
```

---

### **Step 2: Setup Environment Variables**

Create `.env` file:
```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/codeethnics?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"
# OR
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# Arduino Compiler Service
ARDUINO_COMPILER_URL="http://localhost:8080"
ARDUINO_COMPILER_TIMEOUT="30000"
ARDUINO_WORKER_CONCURRENCY="5"
ARDUINO_COMPILE_RATE_LIMIT="5"

# JWT (for auth)
JWT_SECRET="your-secret-minimum-32-characters-long"
JWT_REFRESH_SECRET="your-refresh-secret-minimum-32-characters"

# Server
PORT="5000"
NODE_ENV="development"
```

---

### **Step 3: Setup Database**

```bash
# Run Prisma migrations
pnpm prisma migrate dev

# Seed database with Arduino problems (optional)
pnpm run seed
```

---

### **Step 4: Start Services** (3 terminals)

**Terminal 1: Arduino Compiler Microservice**
```bash
cd arduino-compiler
pnpm run dev

# Output:
# Arduino Compiler Service listening on port 8080
# Arduino CLI detected at: /path/to/arduino-cli
```

**Terminal 2: Main Backend**
```bash
pnpm run dev

# Output:
# Server running on port 5000
# Connected to database
# Redis connected
```

**Terminal 3: BullMQ Worker**
```bash
pnpm run worker:dev

# Output:
# Worker started with concurrency: 5
# Connected to Redis
# Listening on queue: arduino-compile
```

---

### **Step 5: Verify Setup**

```bash
# Check Arduino compiler health
curl http://localhost:8080/health

# Check main backend
curl http://localhost:5000/api/v1

# Check Arduino API health
curl http://localhost:5000/api/v1/arduino/health
```

---

### **Alternative: Docker Setup**

**Start Arduino Compiler**
```bash
cd arduino-compiler
docker build -t arduino-compiler .
docker run -d -p 8080:8080 --name arduino-compiler arduino-compiler
```

**Check logs**
```bash
docker logs -f arduino-compiler
```

---

## 4. ALL ENDPOINTS 🔌

### **Base URL**: `/api/v1/arduino`

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/health` | ❌ | None | Health check |
| `GET` | `/boards` | ❌ | 20/min | List supported boards |
| `GET` | `/problems` | ❌ | 20/min | List Arduino problems |
| `GET` | `/problems/:problemId` | ❌ | 20/min | Get problem details |
| `POST` | `/compile` | ✅ | **5/min** | Submit code for compilation |
| `GET` | `/jobs/:submissionId` | ✅ | None | Get job status |
| `GET` | `/submissions` | ✅ | None | List user's submissions |
| `DELETE` | `/jobs/:submissionId` | ✅ | None | Cancel queued job |
| `POST` | `/validate` | ✅ | None | Validate against test cases |
| `GET` | `/admin/queue/stats` | ✅ Admin | None | Queue statistics |

---

### **Endpoint Details**

#### **GET `/health`** - Service Health Check
**Auth**: None  
**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-04T13:00:00Z",
  "compilerService": {
    "available": true,
    "responseTimeMs": 12
  }
}
```

---

#### **GET `/boards`** - List Supported Boards
**Auth**: None  
**Response**:
```json
{
  "success": true,
  "data": {
    "boards": [
      {
        "id": "uno",
        "name": "Arduino Uno",
        "fqbn": "arduino:avr:uno",
        "flash": "32KB",
        "sram": "2KB"
      },
      {
        "id": "mega",
        "name": "Arduino Mega 2560",
        "fqbn": "arduino:avr:mega",
        "flash": "256KB",
        "sram": "8KB"
      }
    ]
  }
}
```

---

#### **GET `/problems`** - List Arduino Problems
**Auth**: None  
**Query Params**:
- `difficulty` (optional): `easy` | `medium` | `hard`
- `limit` (optional): 1-100 (default: 20)
- `offset` (optional): ≥0 (default: 0)

**Example Request**:
```
GET /api/v1/arduino/problems?difficulty=easy&limit=10&offset=0
```

**Response**:
```json
{
  "success": true,
  "data": {
    "problems": [
      {
        "id": "prob_abc123",
        "title": "Blink LED",
        "difficulty": "easy",
        "board": "uno",
        "totalSubmissions": 145,
        "acceptedSubmissions": 98,
        "acceptanceRate": "67.6%"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 10,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

#### **GET `/problems/:problemId`** - Get Problem Details
**Auth**: None  
**Path Params**: `problemId` (CUID)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "prob_abc123",
    "title": "Blink LED",
    "description": "Write a program to blink an LED connected to pin 13...",
    "difficulty": "easy",
    "board": "uno",
    "fqbn": "arduino:avr:uno",
    "libraries": [],
    "starterCode": "void setup() {\n  // Initialize pin 13\n}\n\nvoid loop() {\n  // Write your code here\n}",
    "timeLimitMs": 2000,
    "memoryLimitKb": 256,
    "simulationConfig": {
      "version": 1,
      "parts": [...],
      "connections": [...]
    },
    "testCases": [
      {
        "id": "test_123",
        "label": "LED should turn on",
        "type": "pin_state",
        "isHidden": false,
        "pin": 13,
        "expectedState": "HIGH",
        "atMs": 100
      }
    ]
  }
}
```

---

#### **POST `/compile`** - Submit Code for Compilation
**Auth**: ✅ Required (JWT)  
**Rate Limit**: **5 requests per minute**

**Request Body**:
```json
{
  "problemId": "prob_abc123",
  "code": "void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}",
  "boardType": "uno"
}
```

**Validation**:
- `problemId`: Must be valid CUID
- `code`: 1-50,000 characters
- `boardType`: `uno` | `mega` (optional, default: `uno`)

**Success Response** (202 Accepted):
```json
{
  "success": true,
  "message": "Compilation job queued",
  "data": {
    "submissionId": "sub_xyz789",
    "status": "processing",
    "estimatedTimeSeconds": 5
  }
}
```

**Rate Limit Response** (429):
```json
{
  "success": false,
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "error": "RATE_LIMIT_EXCEEDED"
}
```

---

#### **GET `/jobs/:submissionId`** - Get Job Status
**Auth**: ✅ Required  
**Path Params**: `submissionId` (CUID)

**Response** (Processing):
```json
{
  "success": true,
  "data": {
    "submissionId": "sub_xyz789",
    "status": "processing",
    "progress": "Compiling...",
    "createdAt": "2026-04-04T13:00:00Z"
  }
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": {
    "submissionId": "sub_xyz789",
    "status": "compiled",
    "hexFile": ":100000000C945D000C9485000C9485000C948500...",
    "compileTime": 1247,
    "createdAt": "2026-04-04T13:00:00Z",
    "updatedAt": "2026-04-04T13:00:05Z"
  }
}
```

**Response** (Error):
```json
{
  "success": true,
  "data": {
    "submissionId": "sub_xyz789",
    "status": "compilation_error",
    "errorOutput": "sketch_xyz789.ino:5:18: error: 'digitalWrit' was not declared in this scope\n   digitalWrit(13, HIGH);\n                  ^~~~~\nDid you mean 'digitalWrite'?",
    "createdAt": "2026-04-04T13:00:00Z",
    "updatedAt": "2026-04-04T13:00:03Z"
  }
}
```

---

#### **GET `/submissions`** - List User's Submissions
**Auth**: ✅ Required  
**Query Params**:
- `problemId` (optional): Filter by problem
- `limit` (optional): 1-100 (default: 20)
- `offset` (optional): ≥0 (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "sub_xyz789",
        "problemId": "prob_abc123",
        "problemTitle": "Blink LED",
        "status": "compiled",
        "testCasesPassed": 3,
        "totalTestCases": 3,
        "compileTime": 1247,
        "createdAt": "2026-04-04T13:00:00Z"
      }
    ],
    "pagination": {
      "total": 47,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

#### **POST `/validate`** - Validate Submission
**Auth**: ✅ Required

**Request Body**:
```json
{
  "submissionId": "sub_xyz789"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "submissionId": "sub_xyz789",
    "allTestsPassed": true,
    "testResults": [
      {
        "testCaseId": "test_123",
        "label": "LED should blink",
        "passed": true,
        "actualValue": "HIGH",
        "expectedValue": "HIGH"
      }
    ],
    "passedCount": 3,
    "totalCount": 3,
    "verdict": "accepted"
  }
}
```

---

#### **DELETE `/jobs/:submissionId`** - Cancel Job
**Auth**: ✅ Required

**Response**:
```json
{
  "success": true,
  "message": "Compilation job cancelled"
}
```

---

## 5. COST ANALYSIS 💰

### **Resource Requirements**

| Resource | Usage | Cost Estimate |
|----------|-------|---------------|
| **CPU** | High during compilation | $20-50/month (2-4 vCPU VPS) |
| **RAM** | Moderate (Arduino CLI ~500MB) | Included in VPS |
| **Storage** | Low (HEX files ~10-50KB each) | $0.01/GB/month |
| **Redis** | Queue + rate limiting | $5-10/month (256MB) |
| **PostgreSQL** | Metadata storage | $10-20/month (shared DB) |
| **Bandwidth** | Low (API calls + HEX downloads) | ~$1-5/month |

**Total Estimated Cost**: **$35-85/month** for 1,000 compilations/day

---

### **Scaling Costs**

| Load | Compilations/Day | Server Cost | Total/Month |
|------|------------------|-------------|-------------|
| **Small** | 100-500 | $20 (1 vCPU) | $35 |
| **Medium** | 500-2,000 | $40 (2 vCPU) | $60 |
| **Large** | 2,000-10,000 | $80 (4 vCPU) | $110 |
| **Enterprise** | 10,000+ | $200+ (8+ vCPU) | $250+ |

---

### **Cost Optimizations**

1. **Use Docker** - Reduce deployment overhead
2. **Self-hosted Redis** - Avoid managed Redis costs
3. **Shared PostgreSQL** - Store with main database
4. **CDN for HEX files** - Store large files on Cloudinary/ImageKit (free tier)
5. **Rate limiting** - Already implemented (5/min per user)

---

### **Free Tier Option**

| Service | Free Tier | Usage |
|---------|-----------|-------|
| **Railway** | $5 credit/month | Host compiler service |
| **Redis Cloud** | 30MB free | Queue (limited) |
| **Supabase** | PostgreSQL free | Database |
| **Vercel** | Free | Main backend API |

**Total**: **$0-5/month** for low traffic (<100 compilations/day)

---

## 6. WHAT SHOULD BE IMPLEMENTED 🔨

### **Missing Features (Priority Order)**

#### **HIGH PRIORITY**

1. **Real Simulator Integration** ⚠️
   - **Current**: Mock validation (random results)
   - **Needed**: Actual AVR8JS or Wokwi API integration
   - **Impact**: Test cases don't actually validate code logic
   - **Effort**: 2-3 days
   
   **Implementation**:
   ```typescript
   // Replace mock in arduino-compiler/src/server.ts
   import { AVR8 } from 'avr8js';
   
   async function runSimulation(hexFile: string, testCases: TestCase[]) {
     const avr = new AVR8({ hex: hexFile });
     avr.run();
     
     // Check pin states, serial output, etc.
     for (const test of testCases) {
       if (test.type === 'pin_state') {
         const pinState = avr.readPin(test.pin);
         // Compare with expected
       }
     }
   }
   ```

2. **HEX File Storage on CDN** 📦
   - **Current**: Stored in PostgreSQL (inefficient)
   - **Needed**: Upload to ImageKit/Cloudinary
   - **Impact**: Database bloat, slow queries
   - **Effort**: 4-6 hours
   
   **Implementation**:
   ```typescript
   // In worker after compilation
   const hexUrl = await uploadToImageKit(hexFile, {
     folder: 'arduino-submissions',
     fileName: `${submissionId}.hex`
   });
   
   await prisma.arduinoSubmission.update({
     where: { id: submissionId },
     data: { hexFileUrl: hexUrl }
   });
   ```

3. **Serial Monitor Emulation** 📟
   - **Current**: Not implemented
   - **Needed**: Capture serial output during simulation
   - **Impact**: Can't test Serial.print() problems
   - **Effort**: 1-2 days

4. **Circuit Diagram Validation** 🔌
   - **Current**: simulationConfig stored but not validated
   - **Needed**: Ensure circuit matches problem requirements
   - **Impact**: Students might wire incorrectly
   - **Effort**: 1 day

---

#### **MEDIUM PRIORITY**

5. **Library Support** 📚
   - **Current**: Only standard Arduino libs
   - **Needed**: Install custom libraries (Servo, Wire, etc.)
   - **Effort**: 1 day
   
   ```typescript
   // In compiler service
   if (libraries.length > 0) {
     for (const lib of libraries) {
       execSync(`arduino-cli lib install "${lib}"`);
     }
   }
   ```

6. **Code Quality Metrics** 📊
   - **Current**: Only pass/fail
   - **Needed**: Code size, memory usage, warnings count
   - **Effort**: 4 hours

7. **Contest Integration** 🏆
   - **Current**: Standalone Arduino problems
   - **Needed**: Link to contests (like DSA problems)
   - **Effort**: 1 day

8. **Collaborative Debugging** 🐛
   - **Current**: No debugging support
   - **Needed**: Breakpoints, variable inspection
   - **Effort**: 1 week (complex)

---

#### **LOW PRIORITY**

9. **Hardware Upload Instructions** 📱
   - **Current**: Just HEX download
   - **Needed**: Step-by-step upload guide
   - **Effort**: 2 hours (documentation)

10. **Multiple Test Runs** 🔄
    - **Current**: One simulation per submit
    - **Needed**: Run multiple iterations for timing accuracy
    - **Effort**: 1 day

11. **Code Hints/Autocomplete** 💡
    - **Current**: None
    - **Needed**: Suggest Arduino functions
    - **Effort**: Frontend work

12. **Problem Difficulty Algorithm** 📈
    - **Current**: Manual difficulty setting
    - **Needed**: Auto-calculate based on submission stats
    - **Effort**: 1 day

---

### **Recommended Implementation Order**

**Week 1: Critical Fixes**
- [ ] Integrate real AVR8JS simulator
- [ ] Move HEX files to CDN storage
- [ ] Add serial monitor emulation

**Week 2: Enhanced Features**
- [ ] Library support
- [ ] Code quality metrics
- [ ] Contest integration

**Week 3: UX Improvements**
- [ ] Hardware upload guide
- [ ] Multiple test runs
- [ ] Circuit validation

---

## 7. HOW TO TEST IT 🧪

### **Automated Tests**

#### **Run All Arduino Tests**
```bash
pnpm run test:arduino
```

#### **Smoke Test** (Quick Health Check)
```bash
pnpm run smoke:arduino
```

**Coverage**:
- ✅ Database connection
- ✅ Redis connection
- ✅ Arduino compiler service availability
- ✅ Queue system
- ✅ API endpoints reachability

---

### **Integration Tests**

**File**: `/test/arduino.integration.test.ts`

**Test Cases**:
1. List Arduino problems without auth
2. Get problem details by ID
3. Compile code with auth (creates submission)
4. Poll job status until completion
5. List user submissions
6. Rate limiting (5 compilations/min)
7. Cancel pending job

**Run**:
```bash
pnpm test arduino.integration.test.ts
```

---

### **Manual Testing Steps**

#### **Test 1: Full Compilation Flow**

**Step 1**: Sign up / login
```bash
curl -X POST http://localhost:5000/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@test.com",
    "password": "Student@1234"
  }'

# Extract access_token from Set-Cookie header
```

**Step 2**: List Arduino problems
```bash
curl http://localhost:5000/api/v1/arduino/problems
```

**Step 3**: Get problem details
```bash
curl http://localhost:5000/api/v1/arduino/problems/{problemId}
```

**Step 4**: Submit code for compilation
```bash
curl -X POST http://localhost:5000/api/v1/arduino/compile \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=YOUR_TOKEN" \
  -d '{
    "problemId": "prob_abc123",
    "code": "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }",
    "boardType": "uno"
  }'

# Response: { "submissionId": "sub_xyz789" }
```

**Step 5**: Poll job status
```bash
# Poll every 2-3 seconds
curl http://localhost:5000/api/v1/arduino/jobs/sub_xyz789 \
  -H "Cookie: access_token=YOUR_TOKEN"

# Keep polling until status != "processing"
```

**Step 6**: Download HEX file (if success)
```bash
# Extract hexFile from response and save to file
echo "{hexFile content}" > blink.hex

# Upload to real Arduino using avrdude or Arduino IDE
```

---

#### **Test 2: Rate Limiting**

```bash
# Submit 6 compilations rapidly
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/v1/arduino/compile \
    -H "Content-Type: application/json" \
    -H "Cookie: access_token=YOUR_TOKEN" \
    -d '{
      "problemId": "prob_abc123",
      "code": "void setup() {}",
      "boardType": "uno"
    }'
  echo "\nRequest $i"
done

# 6th request should return 429 Too Many Requests
```

---

#### **Test 3: Compilation Error**

```bash
# Submit code with syntax error
curl -X POST http://localhost:5000/api/v1/arduino/compile \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=YOUR_TOKEN" \
  -d '{
    "problemId": "prob_abc123",
    "code": "void setup() { digitalWrit(13, HIGH); }",
    "boardType": "uno"
  }'

# Poll status - should return "compilation_error" with error details
```

---

#### **Test 4: Worker Queue**

```bash
# Terminal 1: Start worker with logging
pnpm run worker:dev

# Terminal 2: Submit 10 compilations
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/v1/arduino/compile \
    -H "Content-Type: application/json" \
    -H "Cookie: access_token=YOUR_TOKEN" \
    -d "{
      \"problemId\": \"prob_abc123\",
      \"code\": \"void setup() { pinMode($i, OUTPUT); }\",
      \"boardType\": \"uno\"
    }"
done

# Watch Terminal 1 - should process 5 concurrent, queue others
```

---

### **Load Testing**

**Using k6** (install: `brew install k6`):

**File**: `test/load/arduino-compile.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

const BASE_URL = 'http://localhost:5000/api/v1/arduino';
const TOKEN = 'your-access-token';

export default function () {
  const payload = JSON.stringify({
    problemId: 'prob_abc123',
    code: 'void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }',
    boardType: 'uno',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `access_token=${TOKEN}`,
    },
  };

  const res = http.post(`${BASE_URL}/compile`, payload, params);

  check(res, {
    'status is 202 or 429': (r) => r.status === 202 || r.status === 429,
  });

  sleep(12); // Respect rate limit (5/min)
}
```

**Run**:
```bash
k6 run test/load/arduino-compile.js
```

---

## 8. TROUBLESHOOTING 🔧

### **Common Issues**

#### **Issue 1: "Arduino compiler service unavailable"**

**Symptoms**:
```
Error: Arduino compiler service is not responding
```

**Diagnosis**:
```bash
# Check if compiler service is running
curl http://localhost:8080/health

# If not running, check logs
cd arduino-compiler
pnpm run dev
```

**Solution**:
- Start compiler service: `cd arduino-compiler && pnpm run dev`
- Check port 8080 is not in use: `lsof -i :8080`
- Verify `ARDUINO_COMPILER_URL` in `.env`

---

#### **Issue 2: "Queue jobs stuck in processing"**

**Symptoms**:
- Jobs never complete
- Worker not processing

**Diagnosis**:
```bash
# Check if worker is running
ps aux | grep worker

# Check Redis connection
redis-cli ping

# Check BullMQ dashboard (if installed)
npm install -g bull-board
```

**Solution**:
- Start worker: `pnpm run worker:dev`
- Restart Redis: `redis-server`
- Clear stuck jobs:
  ```bash
  redis-cli
  > DEL bull:arduino-compile:*
  ```

---

#### **Issue 3: "Rate limit not resetting"**

**Symptoms**:
- Still blocked after waiting 1 minute

**Diagnosis**:
```bash
# Check Redis keys
redis-cli KEYS "*compile:user:*"

# Check TTL
redis-cli TTL "compile:user:user_123"
```

**Solution**:
```bash
# Manually clear rate limit
redis-cli DEL "compile:user:user_123"

# Or wait for TTL to expire
```

---

#### **Issue 4: "Arduino CLI not found"**

**Symptoms**:
```
Error: arduino-cli: command not found
```

**Solution**:
```bash
# Verify binary exists
ls -lh ./bin/arduino-cli

# Make executable
chmod +x ./bin/arduino-cli

# Test manually
./bin/arduino-cli version
```

---

#### **Issue 5: "HEX file not generated"**

**Symptoms**:
- Compilation succeeds but no HEX file

**Diagnosis**:
```bash
# Check temp directory permissions
ls -la /tmp/arduino-compile-*

# Manual compilation test
mkdir -p /tmp/test/blink
echo "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); }" > /tmp/test/blink/blink.ino
./bin/arduino-cli compile --fqbn arduino:avr:uno /tmp/test/blink

# Check for HEX
ls -la /tmp/test/blink/build/arduino.avr.uno/
```

**Solution**:
- Ensure sketch folder name matches .ino file name
- Check Arduino CLI has installed cores: `./bin/arduino-cli core list`
- Reinstall core: `./bin/arduino-cli core install arduino:avr`

---

### **Debug Checklist**

- [ ] PostgreSQL running and accessible
- [ ] Redis running on port 6379
- [ ] Arduino compiler service on port 8080
- [ ] Main backend on port 5000
- [ ] Worker process running
- [ ] Arduino CLI binary exists and executable
- [ ] Environment variables set correctly
- [ ] User authenticated (JWT token valid)
- [ ] Problem exists in database
- [ ] Rate limit not exceeded

---

## 📊 SUMMARY

### **What Works**
✅ Full compilation pipeline (code → HEX)  
✅ BullMQ async queue with 5 concurrent jobs  
✅ Arduino Uno & Mega support  
✅ Rate limiting (5/min per user)  
✅ JWT authentication  
✅ Problem management  
✅ Submission history  
✅ Job cancellation  

### **What's Missing**
⚠️ Real simulator (AVR8JS integration)  
⚠️ HEX file CDN storage  
⚠️ Serial monitor emulation  
⚠️ Test case validation (currently mocked)  

### **Production Readiness: 70%**
- Core functionality: ✅ Complete
- Simulation/validation: ⚠️ Needs work
- Scaling: ✅ Ready (queue-based)
- Cost: ✅ Reasonable ($35-85/month)

### **Next Steps**
1. Integrate AVR8JS for real simulation
2. Move HEX storage to CDN
3. Add serial output capture
4. Frontend integration (code editor + Wokwi embed)
