// Prisma configuration.
// DATABASE_URL is read directly from process.env — dotenv/config loads it
// before this file is evaluated at runtime.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/modules/prisma/schema.prisma",
  migrations: {
    path: "src/modules/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
