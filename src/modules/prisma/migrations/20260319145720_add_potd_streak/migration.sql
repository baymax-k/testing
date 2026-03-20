-- CreateTable
CREATE TABLE "daily_challenge" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenge_solve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyChallengeId" TEXT NOT NULL,
    "selectedOption" INTEGER,
    "isCorrect" BOOLEAN NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenge_solve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSolveDate" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_streak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenge_date_key" ON "daily_challenge"("date");

-- CreateIndex
CREATE INDEX "daily_challenge_date_idx" ON "daily_challenge"("date");

-- CreateIndex
CREATE INDEX "daily_challenge_solve_userId_idx" ON "daily_challenge_solve"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenge_solve_userId_dailyChallengeId_key" ON "daily_challenge_solve"("userId", "dailyChallengeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_streak_userId_key" ON "user_streak"("userId");

-- AddForeignKey
ALTER TABLE "daily_challenge" ADD CONSTRAINT "daily_challenge_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_challenge_solve" ADD CONSTRAINT "daily_challenge_solve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_challenge_solve" ADD CONSTRAINT "daily_challenge_solve_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "daily_challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streak" ADD CONSTRAINT "user_streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
