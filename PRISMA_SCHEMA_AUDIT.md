# Prisma Schema Audit Report

**Date**: April 12, 2026  
**Status**: ⚠️ **CRITICAL ISSUES FOUND** - 3 Missing Models, 4 Missing Fields, 1 Wrong Reference

---

## EXECUTIVE SUMMARY

The codebase references Prisma models and fields that **do not exist in the schema**. These cause TypeScript compilation errors and runtime failures. The issues stem from:

1. **Better-Auth Integration**: The project uses Better-Auth for authentication but is missing the required `Session` and `Account` models in the Prisma schema
2. **Test Management Feature**: Missing critical fields (`marks`, `content`, `orderIndex`, `explanation`) in the `Question` model
3. **Model Naming Mismatch**: Test files reference incorrect model names

---

## SECTION 1: MISSING PRISMA MODELS

### ❌ Model 1: `Session` (CRITICAL)

**Why It's Missing**: Better-Auth requires a Session model for session persistence and management. The auth.ts file uses Better-Auth's prismaAdapter which expects this model.

**Current Usage in Code**:

| File | Line | Code | Usage |
|------|------|------|-------|
| [src/config/auth.ts](src/config/auth.ts#L96) | 96 | `await prisma.session.deleteMany({...})` | Delete old sessions in databaseHook |
| [src/middleware/auth.ts](src/middleware/auth.ts#L71) | 71 | `const session = await prisma.session.findUnique({...})` | Lookup session by token |
| [src/__tests__/college-admin/integration.test.ts](src/__tests__/college-admin/integration.test.ts#L215) | 215 | `await prisma.session.createMany({...})` | Test setup |
| [src/__tests__/college-admin/integration.test.ts](src/__tests__/college-admin/integration.test.ts#L246) | 246 | `await prisma.session.deleteMany({...})` | Test cleanup |
| [src/modules/routes/college-admin.ts](src/modules/routes/college-admin.ts#L1963) | 1963 | `await prisma.session.create({...})` | Create session for user |
| [tmp/debug-login.ts](tmp/debug-login.ts#L39) | 39 | `const sessions = await prisma.session.findMany({...})` | Debug/testing |

**Required Schema Definition** (Add to `src/modules/prisma/schema.prisma`):

```prisma
model Session {
  id            String    @id @default(cuid())
  expiresAt     DateTime
  ipAddress     String?
  userAgent     String?
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId])
  @@map("session")
}
```

**Add Relation to User Model**:
```prisma
model User {
  // ...existing fields...
  sessions      Session[]  // Add this line
  // ...rest of fields...
}
```

---

### ❌ Model 2: `Account` (REQUIRED FOR OAUTH)

**Why It's Missing**: Better-Auth requires an Account model for managing OAuth provider integrations and external authentication methods.

**Current Usage in Code**:

| File | Line | Code | Usage |
|------|------|------|-------|
| [tmp/debug-login.ts](tmp/debug-login.ts#L28) | 28 | `const accounts = await prisma.account.findMany({...})` | Debug/testing OAuth accounts |

**Required Schema Definition** (Add to `src/modules/prisma/schema.prisma`):

```prisma
model Account {
  id           String  @id @default(cuid())
  userId       String
  type         String
  provider     String
  providerAccountId String
  refreshToken String?
  accessToken  String?
  expiresAt    Int?
  tokenType    String?
  scope        String?
  idToken      String?
  sessionState String?
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("account")
}
```

**Add Relation to User Model**:
```prisma
model User {
  // ...existing fields...
  accounts      Account[]  // Add this line
  // ...rest of fields...
}
```

---

## SECTION 2: MISSING/INCORRECT FIELD NAMES

### ❌ Model: `Question` - Multiple Missing Fields

The `Question` model in the schema is missing critical fields needed for test management functionality.

#### Field 1: `content` (Missing)
**Current Schema**: Uses `description` instead
**Code Expects**: A dedicated `content` field for question content

| File | Line | Context |
|------|------|---------|
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L627) | 627-628 | `content: data.content,` - Creating question with content |
| [src/modules/services/reportService.ts](src/modules/services/reportService.ts#L516) | 516 | `questionText: (question.content \|\| "").substring(0, 100)` - Extracting question text for reports |

**Issue**: Schema has `description` but code tries to set/access `content`

---

#### Field 2: `marks` (Missing)
**Current Schema**: Not defined
**Code Expects**: Integer field for question points/marks

| File | Line | Context |
|------|------|---------|
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L140) | 140 | `return questions.reduce((total, question) => total + question.marks, 0);` - Calculate test total marks |
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L628) | 628 | `marks: data.marks,` - Saving marks when creating question |
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L691) | 691 | `if (data.marks !== undefined)` - Update marks logic |
| [src/modules/services/reportService.ts](src/modules/services/reportService.ts#L519) | 519 | `averageScoreOnQuestion: (correctAnswerPercentage / 100) * question.marks` - Calculating score |

**Issue**: Completely missing from schema, TypeScript errors when accessing

---

#### Field 3: `orderIndex` (Missing)
**Current Schema**: Not defined
**Code Expects**: Integer field for question ordering within a test

| File | Line | Context |
|------|------|---------|
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L632) | 632 | `orderIndex: data.orderIndex ?? questionCount,` - Setting question order |
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L520) | 520 | `questions: { orderBy: { orderIndex: "asc" } }` - Ordering questions by index |

**Issue**: Missing field causes failed orderBy clauses and creation errors

---

#### Field 4: `explanation` (Missing)
**Current Schema**: Not defined
**Code Expects**: Optional text field for question explanation/solution

| File | Line | Context |
|------|------|---------|
| [src/modules/services/testService.ts](src/modules/services/testService.ts#L630) | 630 | `explanation: data.explanation ?? undefined,` - Saving explanation |

**Issue**: Missing field, cannot save question explanations

---

**Required Schema Changes** (Update `Question` model):

```prisma
model Question {
  id          String       @id @default(cuid())
  type        QuestionType
  title       String
  description String       // Existing - keep for DSA problems
  
  // ADD THESE FIELDS:
  content     String?      // Question content (for test questions)
  marks       Int          // Points/marks for this question
  orderIndex  Int?         // Question order within test
  explanation String?      @db.Text  // Optional explanation/solution
  
  difficulty  String       // Existing
  tags        Tag[]        // Existing
  company     String?      // Existing
  createdBy   String       // Existing
  createdAt   DateTime     @default(now())  // Existing
  updatedAt   DateTime     @updatedAt  // Existing
  
  testId      String?      // Existing
  test        Test?        @relation(fields: [testId], references: [id], onDelete: Cascade)  // Existing
  
  options       Json?  // Existing
  correctAnswer Int?   // Existing
  timeLimit       Int?   // Existing
  memoryLimit     Int?   // Existing
  sampleTestCases Json?  // Existing
  hiddenTestCases Json?  // Existing
  
  contests ContestQuestion[]  // Existing
  arduinoProblem ArduinoProblem?  // Existing
  dailyChallenges DailyChallenge[]  // Existing
  mcqSessionAnswers MCQSessionAnswer[]  // Existing

  @@map("question")  // Existing
}
```

---

## SECTION 3: WRONG MODEL/FIELD REFERENCES

### ⚠️ Issue 1: `dailyPracticeActivity` vs `practiceActivity`

**Problem**: Test file references wrong model name

| File | Line | Current Code | Should Be |
|------|------|--------------|-----------|
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L45) | 45 | `prisma.dailyPracticeActivity.findUnique` | `prisma.practiceActivity.findUnique` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L46) | 46 | `prisma.dailyPracticeActivity.create` | `prisma.practiceActivity.create` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L57) | 57 | `prisma.dailyPracticeActivity.create` | `prisma.practiceActivity.create` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L63) | 63 | `prisma.dailyPracticeActivity.findUnique` | `prisma.practiceActivity.findUnique` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L70) | 70 | `prisma.dailyPracticeActivity.update` | `prisma.practiceActivity.update` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L79) | 79 | `prisma.dailyPracticeActivity.update` | `prisma.practiceActivity.update` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L87) | 87 | `prisma.dailyPracticeActivity.findMany` | `prisma.practiceActivity.findMany` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L96) | 96 | `prisma.dailyPracticeActivity.findMany` | `prisma.practiceActivity.findMany` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L100) | 100 | `prisma.dailyPracticeActivity.findUnique` | `prisma.practiceActivity.findUnique` |
| [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts#L109) | 109 | `prisma.dailyPracticeActivity.findUnique` | `prisma.practiceActivity.findUnique` |

**Schema Truth**: The model is defined as `PracticeActivity` (Prisma converts to camelCase as `practiceActivity`)

**Fix**: Replace all instances of `dailyPracticeActivity` with `practiceActivity` in the test file

---

### ✅ Note: `mCQPracticeSession` is CORRECT

The references to `prisma.mCQPracticeSession` are actually correct. Prisma automatically converts the PascalCase model name `MCQPracticeSession` to camelCase `mCQPracticeSession` in the client.

---

## REMEDIATION CHECKLIST

### Phase 1: Add Missing Models (CRITICAL)
- [ ] Add `Session` model to schema.prisma
- [ ] Add `Account` model to schema.prisma
- [ ] Add relation fields to User model for both
- [ ] Run `prisma migrate dev --name add_session_account_models`
- [ ] Regenerate Prisma client

### Phase 2: Add Missing Question Fields
- [ ] Add `content` field to Question model
- [ ] Add `marks` field to Question model
- [ ] Add `orderIndex` field to Question model
- [ ] Add `explanation` field to Question model
- [ ] Run `prisma migrate dev --name add_question_fields`
- [ ] Regenerate Prisma client

### Phase 3: Fix Model References
- [ ] Find & replace `dailyPracticeActivity` → `practiceActivity` in [test/practiceActivity.unit.test.ts](test/practiceActivity.unit.test.ts)
- [ ] Verify all test mocks use correct model names
- [ ] Run all tests to verify fixes

### Phase 4: Verification
- [ ] Run TypeScript compiler: `pnpm tsc --noEmit`
- [ ] Run tests: `pnpm test`
- [ ] Check build: `pnpm build`

---

## IMPACT ANALYSIS

### TypeScript Errors
These issues cause **compilation errors** in:
- testService.ts (missing marks, content, orderIndex, explanation fields)
- reportService.ts (missing marks, content fields)
- practice.controller.ts (model name references)
- student.service.ts (model name references)

### Runtime Errors
These cause **runtime failures** in:
- Authentication middleware when looking up sessions
- Better-Auth initialization with databaseHooks
- Test management features that try to calculate marks or create questions
- Debug scripts in tmp folder

### Missing Features
Without these models/fields:
- ✗ Session management breaks
- ✗ OAuth provider authentication fails
- ✗ Test question scoring doesn't work
- ✗ Question ordering fails
- ✗ Report generation fails

---

## IMPLEMENTATION PRIORITY

| Priority | Item | Impact |
|----------|------|--------|
| **CRITICAL** | Add Session model | Auth system broken |
| **CRITICAL** | Add Account model | OAuth integration fails |
| **HIGH** | Add Question.marks | Test scoring broken |
| **HIGH** | Add Question.content | Test creation broken |
| **HIGH** | Add Question.orderIndex | Question ordering broken |
| **MEDIUM** | Add Question.explanation | Cannot show solutions |
| **MEDIUM** | Fix dailyPracticeActivity reference | Tests fail |

