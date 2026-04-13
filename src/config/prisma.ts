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

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSSLConfig(),
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
