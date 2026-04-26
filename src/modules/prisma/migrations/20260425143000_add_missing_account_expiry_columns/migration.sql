-- Ensure Better Auth account expiry columns exist on drifted databases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'account'
  ) THEN
    ALTER TABLE "account"
      ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "scope" TEXT;
  END IF;
END $$;
