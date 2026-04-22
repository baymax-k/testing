UPDATE "user" SET "username" = COALESCE(NULLIF("username", ''), id) WHERE "username" IS NULL OR "username" = '';
ALTER TABLE "user" ALTER COLUMN "username" SET DEFAULT md5(random()::text);
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;
