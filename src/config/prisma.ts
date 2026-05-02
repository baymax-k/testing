// ─── Prisma Singleton ────────────────────────────────────────────────────────
// Serverless-safe singleton: reuses the same PrismaClient instance across
// hot-reloads in development and across invocations in serverless (Vercel).

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── SSL config for AWS RDS ──────────────────────────────────────────────────
// On Vercel (production), system certs handle SSL — no extra config needed.
// Locally, use the downloaded RDS cert bundle if available.
function resolveRdsCertPath(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!process.env.RDS_SSL_CERT) return null;

  const rawPath = process.env.RDS_SSL_CERT;
  const certPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);
  return fs.existsSync(certPath) ? certPath : null;
}

function buildDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  if (process.env.NODE_ENV === "production") return base;
  return base;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createAdapter(): PrismaPg {
  const datasourceUrl = buildDatasourceUrl();
  if (!datasourceUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const certPath = resolveRdsCertPath();
  const allowInsecure = process.env.RDS_SSL_INSECURE === "true";
  if (certPath) {
    process.env.NODE_EXTRA_CA_CERTS = certPath;
    console.log("[prisma] Using RDS SSL cert:", certPath);
  }
  if (allowInsecure) {
    console.warn("[prisma] RDS SSL insecure mode enabled (local dev only).");
  }

  const sslConfig = allowInsecure
    ? { rejectUnauthorized: false }
    : certPath
      ? {
          ca: fs.readFileSync(certPath, "utf8"),
          rejectUnauthorized: true,
        }
      : undefined;

  const pool = new Pool({
    connectionString: datasourceUrl,
    ssl: sslConfig,
  });
  return new PrismaPg(pool);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
