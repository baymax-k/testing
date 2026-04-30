/*
  Warnings:

  - You are about to drop the column `accessTokenExpiresAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenExpiresAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `correctOption` on the `question` table. All the data in the column will be lost.
  - The `correctAnswer` column on the `question` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[userId,providerId]` on the table `account` will be added. If there are existing duplicate values, this will fail.
  - Made the column `title` on table `question` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `question` required. This step will fail if there are existing NULL values in that column.
  - Made the column `difficulty` on table `question` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdBy` on table `question` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'arduino';

-- DropForeignKey
ALTER TABLE "daily_challenge" DROP CONSTRAINT "daily_challenge_questionId_fkey";

-- DropIndex
DROP INDEX "question_orderIndex_idx";

-- DropIndex
DROP INDEX "question_testId_idx";

-- AlterTable
ALTER TABLE "account" DROP COLUMN "accessTokenExpiresAt",
DROP COLUMN "refreshTokenExpiresAt",
DROP COLUMN "scope",
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "department" ADD COLUMN     "collegeId" TEXT;

-- AlterTable
ALTER TABLE "question" DROP COLUMN "correctOption",
ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "difficulty" SET NOT NULL,
ALTER COLUMN "createdBy" SET NOT NULL,
DROP COLUMN "correctAnswer",
ADD COLUMN     "correctAnswer" INTEGER,
ALTER COLUMN "orderIndex" DROP NOT NULL,
ALTER COLUMN "orderIndex" DROP DEFAULT,
ALTER COLUMN "marks" DROP NOT NULL,
ALTER COLUMN "marks" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "collegeId" TEXT,
ALTER COLUMN "passwordHash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "college" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "location" TEXT,
    "adminId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "college_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arduino_problem" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "fqbn" TEXT NOT NULL,
    "libraries" TEXT[],
    "starterCode" TEXT NOT NULL,
    "simulationConfig" JSONB NOT NULL,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryLimitKb" INTEGER NOT NULL DEFAULT 256,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arduino_problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arduino_test_case" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "pin" INTEGER,
    "expectedState" TEXT,
    "atMs" INTEGER,
    "toleranceMs" INTEGER DEFAULT 100,
    "minToggles" INTEGER,
    "withinMs" INTEGER,
    "expectedOutput" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "arduino_test_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arduino_submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'processing',
    "hexFile" TEXT,
    "verdict" JSONB,
    "testCasesPassed" INTEGER NOT NULL DEFAULT 0,
    "totalTestCases" INTEGER NOT NULL DEFAULT 0,
    "compileTime" INTEGER,
    "runtime" TEXT,
    "errorOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contestParticipationId" TEXT,

    CONSTRAINT "arduino_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "college_code_key" ON "college"("code");

-- CreateIndex
CREATE INDEX "college_adminId_idx" ON "college"("adminId");

-- CreateIndex
CREATE INDEX "college_createdById_idx" ON "college"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "arduino_problem_questionId_key" ON "arduino_problem"("questionId");

-- CreateIndex
CREATE INDEX "arduino_test_case_problemId_idx" ON "arduino_test_case"("problemId");

-- CreateIndex
CREATE INDEX "arduino_submission_userId_idx" ON "arduino_submission"("userId");

-- CreateIndex
CREATE INDEX "arduino_submission_problemId_idx" ON "arduino_submission"("problemId");

-- CreateIndex
CREATE INDEX "arduino_submission_userId_problemId_idx" ON "arduino_submission"("userId", "problemId");

-- CreateIndex
CREATE INDEX "code_draft_userId_idx" ON "code_draft"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "code_draft_userId_problemId_key" ON "code_draft"("userId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "account_userId_providerId_key" ON "account"("userId", "providerId");

-- CreateIndex
CREATE INDEX "daily_challenge_solve_dailyChallengeId_idx" ON "daily_challenge_solve"("dailyChallengeId");

-- CreateIndex
CREATE INDEX "department_collegeId_idx" ON "department"("collegeId");

-- CreateIndex
CREATE INDEX "session_token_idx" ON "session"("token");

-- CreateIndex
CREATE INDEX "user_collegeId_idx" ON "user"("collegeId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "college"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "college"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arduino_problem" ADD CONSTRAINT "arduino_problem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arduino_test_case" ADD CONSTRAINT "arduino_test_case_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "arduino_problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arduino_submission" ADD CONSTRAINT "arduino_submission_contestParticipationId_fkey" FOREIGN KEY ("contestParticipationId") REFERENCES "contest_participation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arduino_submission" ADD CONSTRAINT "arduino_submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arduino_submission" ADD CONSTRAINT "arduino_submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "arduino_problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_draft" ADD CONSTRAINT "code_draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_challenge" ADD CONSTRAINT "daily_challenge_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
