-- CreateEnum
CREATE TYPE "McqSessionStatus" AS ENUM ('in_progress', 'submitted');

-- CreateTable
CREATE TABLE "mcq_practice_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "difficulty" TEXT,
    "requestedCount" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "questionIds" JSONB NOT NULL,
    "status" "McqSessionStatus" NOT NULL DEFAULT 'in_progress',
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcq_practice_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcq_practice_answer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" INTEGER NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcq_practice_answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcq_practice_session_userId_idx" ON "mcq_practice_session"("userId");

-- CreateIndex
CREATE INDEX "mcq_practice_session_userId_createdAt_idx" ON "mcq_practice_session"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mcq_practice_answer_sessionId_questionId_key" ON "mcq_practice_answer"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "mcq_practice_answer_sessionId_idx" ON "mcq_practice_answer"("sessionId");

-- CreateIndex
CREATE INDEX "mcq_practice_answer_questionId_idx" ON "mcq_practice_answer"("questionId");

-- AddForeignKey
ALTER TABLE "mcq_practice_session" ADD CONSTRAINT "mcq_practice_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcq_practice_answer" ADD CONSTRAINT "mcq_practice_answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mcq_practice_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcq_practice_answer" ADD CONSTRAINT "mcq_practice_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
