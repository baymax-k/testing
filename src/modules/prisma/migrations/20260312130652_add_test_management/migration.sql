-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('draft', 'scheduled', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('multiple_choice', 'true_false', 'short_answer', 'long_answer', 'coding');

-- CreateTable
CREATE TABLE "test" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "status" "TestStatus" NOT NULL DEFAULT 'draft',
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "passingMarks" INTEGER,
    "scheduledStartTime" TIMESTAMP(3),
    "scheduledEndTime" TIMESTAMP(3),
    "departmentId" TEXT,
    "batchId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "options" JSONB,
    "correctAnswer" TEXT,
    "explanation" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "answers" JSONB,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_status_idx" ON "test"("status");

-- CreateIndex
CREATE INDEX "test_departmentId_idx" ON "test"("departmentId");

-- CreateIndex
CREATE INDEX "test_batchId_idx" ON "test"("batchId");

-- CreateIndex
CREATE INDEX "test_createdById_idx" ON "test"("createdById");

-- CreateIndex
CREATE INDEX "test_scheduledStartTime_idx" ON "test"("scheduledStartTime");

-- CreateIndex
CREATE INDEX "question_testId_idx" ON "question"("testId");

-- CreateIndex
CREATE INDEX "question_orderIndex_idx" ON "question"("orderIndex");

-- CreateIndex
CREATE INDEX "test_attempt_testId_idx" ON "test_attempt"("testId");

-- CreateIndex
CREATE INDEX "test_attempt_studentId_idx" ON "test_attempt"("studentId");

-- CreateIndex
CREATE INDEX "test_attempt_status_idx" ON "test_attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempt_testId_studentId_attemptNumber_key" ON "test_attempt"("testId", "studentId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_testId_fkey" FOREIGN KEY ("testId") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
