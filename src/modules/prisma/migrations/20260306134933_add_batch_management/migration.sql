-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'mentor';
ALTER TYPE "Role" ADD VALUE 'dept_admin';
ALTER TYPE "Role" ADD VALUE 'hod';
ALTER TYPE "Role" ADD VALUE 'principal';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "hodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER,
    "departmentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "department_code_key" ON "department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "department_hodId_key" ON "department"("hodId");

-- CreateIndex
CREATE INDEX "batch_departmentId_idx" ON "batch"("departmentId");

-- CreateIndex
CREATE INDEX "batch_mentorId_idx" ON "batch"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_code_departmentId_key" ON "batch"("code", "departmentId");

-- CreateIndex
CREATE INDEX "user_departmentId_idx" ON "user"("departmentId");

-- CreateIndex
CREATE INDEX "user_batchId_idx" ON "user"("batchId");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch" ADD CONSTRAINT "batch_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch" ADD CONSTRAINT "batch_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
