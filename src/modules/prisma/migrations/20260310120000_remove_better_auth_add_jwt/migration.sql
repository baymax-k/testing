-- ─── Remove Better Auth, Add JWT Auth (clean slate) ─────────────────────────
--
-- Wipes all existing user data, drops Better Auth tables, and sets up the
-- new JWT-based auth schema. Run the seed script after this migration to
-- create fresh admin and student users.

-- Step 1: Wipe all user-dependent data (cascades handle most of it, but
-- explicit deletes are safer for tables without ON DELETE CASCADE)
DELETE FROM "contest_participation";
DELETE FROM "submission";
DELETE FROM "verification";

-- Step 2: Wipe users (cascades to session and account automatically)
DELETE FROM "user";

-- Step 3: Drop Better Auth tables
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_userId_fkey";
DROP TABLE "session";

ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "account_userId_fkey";
DROP TABLE "account";

-- Step 4: Add passwordHash column — no backfill needed since all rows are gone
ALTER TABLE "user" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "user" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- Step 5: Create the new refresh_token table
-- jti = JWT ID, the unique identifier baked into each refresh token JWT.
-- One row per active device/session. Deleted on sign-out or new sign-in.
CREATE TABLE "refresh_token" (
    "id"        TEXT NOT NULL,
    "jti"       TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_token_jti_key"    ON "refresh_token"("jti");
CREATE INDEX        "refresh_token_userId_idx" ON "refresh_token"("userId");

ALTER TABLE "refresh_token"
    ADD CONSTRAINT "refresh_token_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
