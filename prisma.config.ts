// Prisma configuration for local development CLI usage.
// This file is NOT used during Docker builds — schema path is passed
// directly via --schema flag to avoid requiring DATABASE_URL at build time.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/modules/prisma/schema.prisma",
  migrations: {
    path: "src/modules/prisma/migrations",
  },
});
