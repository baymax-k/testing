// ─── Express Application (thin orchestrator) ────────────────────────────────────
// All config, routes, and middleware live in their own modules.
// This file wires them together — keep it lean for easy collaboration.

import express, { type Request, type Response, type NextFunction, type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import swaggerUi from "swagger-ui-express";

import { auth } from "./config/auth.js";
import { corsOptions, loginLimiter, authLimiter, swaggerSpec } from "./config/index.js";

// Route modules (each dev owns their own file)
import commonRoutes from "./modules/routes/common.js";
import adminRoutes from "./modules/routes/admin.js";
import studentRoutes from "./modules/routes/student.js";
import practiceRoutes from "./modules/routes/student/practice.js";
import contestRoutes from "./modules/routes/student/contest.js";
import problemRoutes from "./modules/routes/problem.js";
import submissionRoutes from "./modules/routes/submission.js";
import judge0Routes from "./modules/routes/judge0.js";

// ─── Create app ─────────────────────────────────────────────────────────────────
const app: Application = express();

// Trust the first proxy (AWS ALB, Nginx, Cloudflare, etc.)
// Without this, all users behind a reverse proxy share ONE rate-limit counter
// because Express sees the proxy's IP, not the real client IP.
// Set to 1 for a single proxy layer (ALB → Express). Adjust if there are more.
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"], // required for inline onclick/onsubmit handlers
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(cors(corsOptions));

// Rate-limit auth endpoints to prevent abuse
// authLimiter = broad safety net for ALL auth POSTs (60 req / 15 min)
// loginLimiter = tighter limit on credential endpoints (10 req / 1 min)
app.use("/api/v1/auth", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") {
    authLimiter(req, res, next);
  } else {
    next();
  }
});

// ─── Mount Better Auth ──────────────────────────────────────────────────────────
// IMPORTANT: must come BEFORE express.json() — Better Auth reads the raw body.
const betterAuthHandler = toNodeHandler(auth);

// Short aliases so clients can POST /api/v1/auth/sign-up instead of /api/v1/auth/sign-up/email
// loginLimiter is chained here so it only fires on these POST routes (not GET/OPTIONS)
app.post("/api/v1/auth/sign-up", loginLimiter, (req: Request, res: Response) => {
  req.url = "/api/v1/auth/sign-up/email";
  return betterAuthHandler(req, res);
});
app.post("/api/v1/auth/sign-in", loginLimiter, (req: Request, res: Response) => {
  req.url = "/api/v1/auth/sign-in/email";
  return betterAuthHandler(req, res);
});

// Catch-all for remaining Better Auth routes
// (sign-out, get-session, verify-email, email-otp/*, etc.)
app.all(/^\/api\/v1\/auth\/.*/, (req: Request, res: Response) => {
  return betterAuthHandler(req, res);
});

// ─── Body parser (AFTER Better Auth) ────────────────────────────────────────────
app.use(express.json());

// ─── Swagger UI ─────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs-json", (_req, res) => { res.json(swaggerSpec); });

// ─── Serve test frontend at /test ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/test", express.static(path.join(__dirname, "..", "public")));

// ─── Mount route modules ────────────────────────────────────────────────────────
app.use("/api/v1", commonRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/student/practice", practiceRoutes);
app.use("/api/v1/student/contest", contestRoutes);
app.use("/api/v1/problems", problemRoutes);
app.use("/api/v1/submissions", submissionRoutes);
app.use("/api/v1/judge0", judge0Routes);

// ─── Global error handler ───────────────────────────────────────────────────────
// Must be the LAST app.use() — Express identifies it by the 4-argument signature.
// In production, raw error messages are hidden to avoid leaking internals.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[unhandled error]", err);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : String(err);
  res.status(500).json({ error: message });
});

export default app;