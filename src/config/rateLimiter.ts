// ─── Rate Limiters ──────────────────────────────────────────────────────────────
// Centralised so any route module can import what it needs.

import rateLimit from "express-rate-limit";

/** Login rate-limit: 8 requests per minute per IP */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
