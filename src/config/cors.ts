// ─── CORS Configuration ────────────────────────────────────────────────────────
// Fully driven by environment variables for easy frontend connection.
//
// Set CORS_ORIGINS in .env as a comma-separated list:
//   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
//
// Falls back to FRONTEND_URL + BETTER_AUTH_URL if CORS_ORIGINS is not set.

import type { CorsOptions } from "cors";

function buildOrigins(): (string | RegExp)[] {
  // Explicit list takes priority
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  }

  // Default: backend + frontend URLs
  const origins: string[] = [
    process.env.BETTER_AUTH_URL || "http://localhost:5000",
    process.env.FRONTEND_URL || "http://localhost:3000",
  ];

  return origins;
}

export const corsOptions: CorsOptions = {
  origin: buildOrigins(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
