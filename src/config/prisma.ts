// ─── Prisma Singleton ────────────────────────────────────────────────────────
import "dotenv/config";
import { createRequire } from "module";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── ESM-safe import for CJS @prisma/client ──────────────────────────────────
// @prisma/client is a CJS module; named ESM imports fail at runtime under
// NodeNext even though tsc accepts them. createRequire is the correct fix.
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

type PrismaClient = InstanceType<typeof PrismaClient>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── SSL config ───────────────────────────────────────────────────────────────
function getSSLConfig():
  | { rejectUnauthorized: true; ca?: string[] }
  | { rejectUnauthorized: false }
  | undefined {
  if (process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: true };
  }

  const rawPath = process.env.RDS_SSL_CERT;
  if (!rawPath) return undefined;

  const certPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);

  if (!fs.existsSync(certPath)) return undefined;

  console.log("[prisma] Using RDS SSL cert:", certPath);

  if (process.env.RDS_SSL_INSECURE === "true") {
    console.warn("[prisma] RDS SSL insecure mode enabled (local dev only).");
    return { rejectUnauthorized: false };
  }

  return {
    rejectUnauthorized: true,
    ca: [fs.readFileSync(certPath, "utf8")],
  };
}

// ─── Adapter factory ──────────────────────────────────────────────────────────
function createAdapter(): PrismaPg {
  const datasourceUrl = process.env.DATABASE_URL;
  if (!datasourceUrl) throw new Error("DATABASE_URL is not set");

  const ssl = getSSLConfig();
  const pool = new Pool({ connectionString: datasourceUrl, ssl });
  return new PrismaPg(pool);
}

// ─── Singleton ────────────────────────────────────────────────────────────────
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}