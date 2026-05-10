// Prisma configuration for local development CLI usage only.
// DATABASE_URL is intentionally not read here — Prisma CLI picks it up
// from the environment directly. This avoids build-time failures when
// DATABASE_URL is not available (e.g. Docker build stage on Railway).
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/modules/prisma/schema.prisma",
  migrations: {
    path: "src/modules/prisma/migrations",
  },
});
