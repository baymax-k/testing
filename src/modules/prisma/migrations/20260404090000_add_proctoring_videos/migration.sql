-- CreateEnum
CREATE TYPE "ProctoringViolationType" AS ENUM (
    'NO_FACE_DETECTED',
    'MULTIPLE_FACES',
    'OFF_SCREEN_GAZE',
    'TAB_SWITCH',
    'FULLSCREEN_EXIT',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "ProctoringReviewStatus" AS ENUM (
    'pending',
    'confirmed',
    'dismissed',
    'needs_review'
);

-- CreateEnum
CREATE TYPE "ProctoringSeverity" AS ENUM (
    'low',
    'medium',
    'high'
);

-- CreateTable
CREATE TABLE "proctoring_video" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "violationType" "ProctoringViolationType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "meta" JSONB,
    "clientEventId" TEXT,
    "reviewStatus" "ProctoringReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "severity" "ProctoringSeverity",
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proctoring_video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proctoring_video_studentId_clientEventId_key"
    ON "proctoring_video"("studentId", "clientEventId");

-- CreateIndex
CREATE INDEX "proctoring_video_testId_idx" ON "proctoring_video"("testId");

-- CreateIndex
CREATE INDEX "proctoring_video_attemptId_idx" ON "proctoring_video"("attemptId");

-- CreateIndex
CREATE INDEX "proctoring_video_studentId_idx" ON "proctoring_video"("studentId");

-- CreateIndex
CREATE INDEX "proctoring_video_violationType_idx" ON "proctoring_video"("violationType");

-- CreateIndex
CREATE INDEX "proctoring_video_reviewStatus_idx" ON "proctoring_video"("reviewStatus");

-- CreateIndex
CREATE INDEX "proctoring_video_createdAt_idx" ON "proctoring_video"("createdAt");

-- AddForeignKey
ALTER TABLE "proctoring_video"
    ADD CONSTRAINT "proctoring_video_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_video"
    ADD CONSTRAINT "proctoring_video_testId_fkey"
    FOREIGN KEY ("testId") REFERENCES "test"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_video"
    ADD CONSTRAINT "proctoring_video_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "test_attempt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_video"
    ADD CONSTRAINT "proctoring_video_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
