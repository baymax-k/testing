// ─── Rate Limiters ──────────────────────────────────────────────────────────────
// Centralised so any route module can import what it needs.
//
// HOW IT WORKS:
//   • Each limiter tracks requests **per IP address** (not globally).
//   • 10,000 users each get their own independent counter.
//   • Behind a proxy (AWS ALB, Nginx, Cloudflare), you MUST set
//     `app.set('trust proxy', 1)` in app.ts so Express reads the real
//     client IP from X-Forwarded-For instead of the proxy's IP.
//   • Default store = in-memory (fine for single-server).
//     For multi-instance deployments, swap to `rate-limit-redis`.

import rateLimit from "express-rate-limit";

/**
 * Login / sign-up brute-force protection: 15 requests per minute per IP.
 *
 * A normal user does 1-2 login attempts. Even with typos, 15/min is generous.
 * An attacker trying to brute-force passwords gets blocked quickly.
 *
 * Applied ONLY to POST /auth/sign-in and POST /auth/sign-up.
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true, // sends RateLimit-* headers
  legacyHeaders: false, // disables X-RateLimit-* headers
});

/**
 * General auth safety net: 100 requests per 15 minutes per IP.
 *
 * Covers ALL auth POSTs: sign-up, sign-in, OTP send/verify,
 * password reset, change-password, sign-out, etc.
 *
 * A legitimate user in a 15-min session might:
 *   sign-up (1) + verify OTP (1) + resend OTP (1-2) + sign-in (1-2)
 *   + get-session (5-10 auto-refreshes) + change-password (1) = ~20 max
 *
 * 100/15min gives 5× headroom per user while still blocking scripted abuse.
 * At 10,000 concurrent users, each has their own counter — no interference.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many auth requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Submission rate limiter: 15 requests per minute per IP.
 *
 * Protects Judge0 from abuse — code execution is expensive.
 * 15/min is generous for normal coding sessions.
 *
 * Applied to POST /submissions/run and POST /submissions.
 */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: { error: "Too many submissions, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
