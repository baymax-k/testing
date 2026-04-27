-- Add missing public-test columns for databases that predate these schema fields.
-- This migration is idempotent and safe to run on environments where columns already exist.

DO $$
BEGIN
  -- Backward compatibility: some environments may have snake_case is_public.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'test'
      AND column_name = 'is_public'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'test'
      AND column_name = 'isPublic'
  ) THEN
    ALTER TABLE "test" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "test"
    SET "isPublic" = COALESCE("is_public", false)
    WHERE "isPublic" = false;
  END IF;
END $$;

ALTER TABLE "test"
ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "difficulty" TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "test_isPublic_idx" ON "test"("isPublic");
CREATE INDEX IF NOT EXISTS "test_difficulty_idx" ON "test"("difficulty");