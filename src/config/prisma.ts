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
// Secure SSL configuration:
// - Production: Uses system root CA, rejects unauthorized connections
// - Development: Optional SSL with custom cert if PROVIDED via RDS_SSL_CERT env var
function getSSLConfig():
  | { rejectUnauthorized: true; ca?: string[] }
  | { rejectUnauthorized: false }
  | undefined {
  const nodeEnv = process.env.NODE_ENV || "development";

  // Production: Enforce strict SSL verification
  if (nodeEnv === "production") {
    return { rejectUnauthorized: true };
  }

  // Development: Optional SSL with custom cert
  const certPath = process.env.RDS_SSL_CERT
    ? path.resolve(__dirname, "../../..", process.env.RDS_SSL_CERT)
    : null;
  if (certPath && fs.existsSync(certPath)) {
    const caContent = fs.readFileSync(certPath, "utf8");
    console.log("[prisma] Using RDS SSL with custom cert:", certPath);
    return { rejectUnauthorized: true, ca: [caContent] };
  }

  // No SSL if cert not provided in development
  return undefined;
}
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

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSSLConfig(),
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

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
