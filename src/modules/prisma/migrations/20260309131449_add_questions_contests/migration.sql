/*
  Warnings:

  - You are about to drop the `refresh_token` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'dsa');

-- CreateEnum
CREATE TYPE "ContestType" AS ENUM ('contest', 'practice');

-- DropForeignKey
ALTER TABLE "refresh_token" DROP CONSTRAINT "refresh_token_userId_fkey";

-- AlterTable
ALTER TABLE "submission" ADD COLUMN     "contestParticipationId" TEXT,
ALTER COLUMN "language" DROP NOT NULL,
ALTER COLUMN "languageId" DROP NOT NULL,
ALTER COLUMN "sourceCode" DROP NOT NULL;

-- DropTable
DROP TABLE "refresh_token";

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "company" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "options" JSONB,
    "correctAnswer" INTEGER,
    "timeLimit" INTEGER,
    "memoryLimit" INTEGER,
    "sampleTestCases" JSONB,
    "hiddenTestCases" JSONB,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ContestType" NOT NULL DEFAULT 'contest',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_question" (
    "contestId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "contest_question_pkey" PRIMARY KEY ("contestId","questionId")
);

-- CreateTable
CREATE TABLE "contest_participation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "mcqAnswers" JSONB,

    CONSTRAINT "contest_participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_QuestionToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_QuestionToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contest_participation_userId_contestId_key" ON "contest_participation"("userId", "contestId");

-- CreateIndex
CREATE INDEX "_QuestionToTag_B_index" ON "_QuestionToTag"("B");

-- AddForeignKey
ALTER TABLE "contest_question" ADD CONSTRAINT "contest_question_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_question" ADD CONSTRAINT "contest_question_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_participation" ADD CONSTRAINT "contest_participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_participation" ADD CONSTRAINT "contest_participation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_contestParticipationId_fkey" FOREIGN KEY ("contestParticipationId") REFERENCES "contest_participation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionToTag" ADD CONSTRAINT "_QuestionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionToTag" ADD CONSTRAINT "_QuestionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
