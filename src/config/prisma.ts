// ─── Prisma Singleton ────────────────────────────────────────────────────────
// Serverless-safe singleton: reuses the same PrismaClient instance across
// hot-reloads in development and across invocations in serverless (Vercel).

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── SSL config for AWS RDS ──────────────────────────────────────────────────
// On Vercel (production), system certs handle SSL — no extra config needed.
// Locally, use the downloaded RDS cert bundle if available.
function buildDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  if (process.env.NODE_ENV === "production") return base;

  const certPath = process.env.RDS_SSL_CERT
    ? path.resolve(__dirname, "../../..", process.env.RDS_SSL_CERT)
    : null;
  if (certPath && fs.existsSync(certPath)) {
    process.env.NODE_EXTRA_CA_CERTS = certPath;
    console.log("[prisma] Using RDS SSL cert:", certPath);
  }
  return base;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: buildDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
