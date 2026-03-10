-- Add username column to user table.
-- 1. Add as nullable first so we can backfill existing rows.
ALTER TABLE "user" ADD COLUMN "username" TEXT;

-- 2. Backfill: derive username from the local part of the email
--    (everything before @), lowercased, non-alphanumeric replaced with _.
UPDATE "user"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9]', '_', 'g'));

-- 3. If any two users collided (unlikely with seeded data), append a short suffix.
--    For safety we append _N for duplicates using a window function.
UPDATE "user" u
SET "username" = u."username" || '_' || rn.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt") AS rn
  FROM "user"
) rn
WHERE u.id = rn.id AND rn.rn > 1;

-- 4. Add unique constraint and NOT NULL.
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "user" ADD CONSTRAINT "user_username_key" UNIQUE ("username");

-- 5. Index for fast lookups by username at sign-in.
CREATE INDEX IF NOT EXISTS "user_username_idx" ON "user" ("username");
