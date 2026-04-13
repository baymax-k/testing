// ─── Environment Variable Validation ──────────────────────────────────────────
// Validates all required environment variables at startup.
// Fails fast before the server starts if any are missing.

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  frontendUrl: string;
  corsOrigins: string[];
  judge0Url: string;
  betterAuthSecret: string;
  emailHost?: string;
  emailPort?: number;
  emailUser?: string;
  emailPass?: string;
  emailFrom: string;
}

const requiredEnvVars = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "BETTER_AUTH_SECRET",
  "FRONTEND_URL",
  "JUDGE0_URL",
];

const optionalEnvVars = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_FROM",
];

function validateEnv(): EnvConfig {
  // Check required variables
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("❌ FATAL: Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  // Validate Node environment
  const nodeEnv = process.env.NODE_ENV || "development";
  if (!["development", "production", "test"].includes(nodeEnv)) {
    console.error(`❌ FATAL: Invalid NODE_ENV="${nodeEnv}". Must be one of: development, production, test`);
    process.exit(1);
  }

  // Validate port is a number
  const port = Number(process.env.PORT) || 5000;
  if (isNaN(port) || port < 0 || port > 65535) {
    console.error(`❌ FATAL: Invalid PORT="${process.env.PORT}". Must be a number between 0-65535`);
    process.exit(1);
  }

  // Parse CORS origins
  const corsOriginsStr = process.env.CORS_ORIGINS || "";
  const corsOrigins = corsOriginsStr
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // In production, require CORS origins
  if (nodeEnv === "production" && corsOrigins.length === 0) {
    console.error("❌ FATAL: CORS_ORIGINS must be set in production");
    process.exit(1);
  }

  // Validate JWT secret length
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    console.error(`❌ FATAL: JWT_SECRET must be at least 32 characters. Current length: ${jwtSecret.length}`);
    process.exit(1);
  }

  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
  if (jwtRefreshSecret.length < 32) {
    console.error(
      `❌ FATAL: JWT_REFRESH_SECRET must be at least 32 characters. Current length: ${jwtRefreshSecret.length}`
    );
    process.exit(1);
  }

  return {
    nodeEnv,
    port,
    appUrl: process.env.APP_URL || `http://localhost:${port}`,
    databaseUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
    jwtSecret,
    jwtRefreshSecret,
    frontendUrl: process.env.FRONTEND_URL!,
    corsOrigins,
    judge0Url: process.env.JUDGE0_URL!,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET!,
    emailHost: process.env.EMAIL_HOST,
    emailPort: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined,
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    emailFrom: process.env.EMAIL_FROM || "CodeEthnics <no-reply@codeethnics.com>",
  };
}

// Validate and export configuration
export const env = validateEnv();
