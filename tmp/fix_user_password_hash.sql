UPDATE "user" SET "passwordHash" = '' WHERE "passwordHash" IS NULL;
ALTER TABLE "user" ALTER COLUMN "passwordHash" SET DEFAULT '';
ALTER TABLE "user" ALTER COLUMN "passwordHash" SET NOT NULL;
