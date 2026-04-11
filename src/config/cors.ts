// ─── CORS Configuration ────────────────────────────────────────────────────────
// Fully driven by environment variables for easy frontend connection.
//
// Set CORS_ORIGINS in .env as a comma-separated list:
//   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
//
// Falls back to APP_URL, BETTER_AUTH_URL, FRONTEND_URL, and optional
// admin portal URLs if CORS_ORIGINS is not set.

import type { CorsOptions } from "cors";
import { getConfiguredOrigins, normalizeOrigin } from "./origins.js";

export const allowedOrigins: string[] = getConfiguredOrigins();
const allowedOriginsSet = new Set(allowedOrigins);

export const isAllowedOrigin = (origin: string): boolean => {
  return allowedOriginsSet.has(normalizeOrigin(origin));
};

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, server-to-server, health checks)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
};
