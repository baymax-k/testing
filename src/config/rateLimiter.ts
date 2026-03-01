// ─── Rate Limiters ──────────────────────────────────────────────────────────────
// Centralised so any route module can import what it needs.

import rateLimit from "express-rate-limit";

/** Login rate-limit: 8 requests per minute per IP */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General auth rate-limit: 20 requests per 10 minutes */
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: { error: "Too many auth requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
