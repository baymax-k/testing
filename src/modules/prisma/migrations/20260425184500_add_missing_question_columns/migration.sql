-- Ensure question table columns required by Prisma schema exist on drifted databases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'question'
  ) THEN
    ALTER TABLE "question"
      ADD COLUMN IF NOT EXISTS "correctOption" INTEGER,
      ADD COLUMN IF NOT EXISTS "explanation" TEXT,
      ADD COLUMN IF NOT EXISTS "marks" INTEGER DEFAULT 1;

    UPDATE "question"
    SET "marks" = 1
    WHERE "marks" IS NULL;

    ALTER TABLE "question"
      ALTER COLUMN "marks" SET DEFAULT 1,
      ALTER COLUMN "marks" SET NOT NULL,
      ALTER COLUMN "title" DROP NOT NULL,
      ALTER COLUMN "description" DROP NOT NULL,
      ALTER COLUMN "difficulty" DROP NOT NULL,
      ALTER COLUMN "createdBy" DROP NOT NULL;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'question'
        AND column_name = 'correctAnswer'
        AND data_type <> 'text'
    ) THEN
      ALTER TABLE "question"
        ALTER COLUMN "correctAnswer" TYPE TEXT USING "correctAnswer"::TEXT;
    END IF;
  END IF;
END $$;
