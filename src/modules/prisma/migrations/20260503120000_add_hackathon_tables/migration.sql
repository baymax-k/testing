-- CreateEnum (idempotent)
DO $$
BEGIN
    CREATE TYPE "HackathonStatus" AS ENUM ('draft', 'registration_open', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "hackathon" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "shortDescription" VARCHAR(500),
    "collegeId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "status" "HackathonStatus" NOT NULL DEFAULT 'draft',
    "maxTeams" INTEGER,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 5,
    "minTeamSize" INTEGER NOT NULL DEFAULT 1,
    "theme" TEXT,
    "problemStatementUrl" VARCHAR(500),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowRemoteParticipation" BOOLEAN NOT NULL DEFAULT true,
    "prizesInfo" TEXT,
    "rulesUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathon_team" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "leaderUserId" TEXT NOT NULL,
    "projectTitle" VARCHAR(255),
    "projectDescription" TEXT,
    "repositoryUrl" VARCHAR(500),
    "demoUrl" VARCHAR(500),
    "score" DOUBLE PRECISION,
    "ranking" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hackathon_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathon_participant" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contributions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hackathon_participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hackathon_collegeId_idx" ON "hackathon"("collegeId");
CREATE INDEX "hackathon_status_idx" ON "hackathon"("status");
CREATE INDEX "hackathon_startDate_idx" ON "hackathon"("startDate");
CREATE INDEX "hackathon_createdByUserId_idx" ON "hackathon"("createdByUserId");

CREATE INDEX "hackathon_team_hackathonId_idx" ON "hackathon_team"("hackathonId");
CREATE INDEX "hackathon_team_leaderUserId_idx" ON "hackathon_team"("leaderUserId");
CREATE INDEX "hackathon_team_ranking_idx" ON "hackathon_team"("ranking");

CREATE UNIQUE INDEX "hackathon_participant_hackathonId_userId_key" ON "hackathon_participant"("hackathonId", "userId");
CREATE INDEX "hackathon_participant_hackathonId_idx" ON "hackathon_participant"("hackathonId");
CREATE INDEX "hackathon_participant_teamId_idx" ON "hackathon_participant"("teamId");
CREATE INDEX "hackathon_participant_userId_idx" ON "hackathon_participant"("userId");
CREATE INDEX "hackathon_participant_status_idx" ON "hackathon_participant"("status");

-- AddForeignKey
ALTER TABLE "hackathon" ADD CONSTRAINT "hackathon_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "college"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hackathon" ADD CONSTRAINT "hackathon_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hackathon_team" ADD CONSTRAINT "hackathon_team_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hackathon_team" ADD CONSTRAINT "hackathon_team_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hackathon_participant" ADD CONSTRAINT "hackathon_participant_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hackathon_participant" ADD CONSTRAINT "hackathon_participant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "hackathon_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hackathon_participant" ADD CONSTRAINT "hackathon_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
