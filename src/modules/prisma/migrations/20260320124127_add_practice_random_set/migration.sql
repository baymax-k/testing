-- AlterTable
ALTER TABLE "daily_challenge_solve" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "languageId" INTEGER,
ADD COLUMN     "sourceCode" TEXT;

-- CreateTable
CREATE TABLE "daily_practice_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "problemsSolved" INTEGER NOT NULL DEFAULT 0,
    "mcqSolved" INTEGER NOT NULL DEFAULT 0,
    "dsaSolved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_practice_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_random_set" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seed" TEXT,
    "filters" JSONB NOT NULL,
    "questionIds" JSONB NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "practice_random_set_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_practice_activity_userId_idx" ON "daily_practice_activity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_practice_activity_userId_date_key" ON "daily_practice_activity"("userId", "date");

-- CreateIndex
CREATE INDEX "practice_random_set_userId_idx" ON "practice_random_set"("userId");

-- AddForeignKey
ALTER TABLE "daily_practice_activity" ADD CONSTRAINT "daily_practice_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_random_set" ADD CONSTRAINT "practice_random_set_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
