// ─── Express Application ──────────────────────────────────────────────────────

import express, { type Request, type Response, type NextFunction, type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import swaggerUi from "swagger-ui-express";

import { corsOptions, swaggerSpec } from "./config/index.js";
import { env } from "./config/env.js";

// Route modules
import authRoutes from "./modules/auth/auth.routes.js";
import commonRoutes from "./modules/routes/common.js";
import adminRoutes from "./modules/routes/admin.js";
import studentRoutes from "./modules/routes/student.js";
import practiceRoutes from "./modules/routes/student/practice.js";
import contestRoutes from "./modules/routes/student/contest.js";
import problemRoutes from "./modules/routes/problem.js";
import submissionRoutes from "./modules/routes/submission.js";
import judge0Routes from "./modules/routes/judge0.js";
import collegeAdminRoutes from "./modules/routes/college-admin.js";
import potdRoutes from "./modules/routes/student/potd.js";
import proctoringRoutes from "./modules/routes/proctoring.js";
import arduinoRoutes from "./modules/arduino/routes/arduino.routes.js";

// ─── Create app ───────────────────────────────────────────────────────────────
const app: Application = express();

// Trust the first proxy (AWS ALB, Nginx, Cloudflare)
// Without this, all users behind a reverse proxy share ONE rate-limit counter.
app.set("trust proxy", 1);

// Security headers
// Note: Google OAuth requires frame-src and connect-src permissions
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://accounts.google.com"],
        scriptSrcAttr: ["'none'"], // Strongly discourage inline scripts
        styleSrc: ["'self'", "https://fonts.googleapis.com", "https://accounts.google.com"],
        styleSrcElem: ["'self'", "https://fonts.googleapis.com", "https://accounts.google.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://accounts.google.com"],
        frameSrc: ["'self'", "https://accounts.google.com"],
      },
    },
  })
);

app.use(cors(corsOptions));

// Parse cookies — must come before routes so req.cookies is populated
app.use(cookieParser());

// Parse JSON body
app.use(express.json());

// ─── Swagger UI (disabled in production) ──────────────────────────────────────
if (env.nodeEnv !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs-json", (_req, res) => {
    res.json(swaggerSpec);
  });
}

// ─── Serve test frontend (disabled in production) ──────────────────────────────
if (env.nodeEnv !== "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use("/test", express.static(path.join(__dirname, "..", "public")));
}

// ─── Mount routes ─────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", commonRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/student/practice", practiceRoutes);
app.use("/api/v1/student/contest", contestRoutes);
app.use("/api/v1/problems", problemRoutes);
app.use("/api/v1/submissions", submissionRoutes);
app.use("/api/v1/judge0", judge0Routes);
app.use("/api/college-admin", collegeAdminRoutes);
app.use("/api/v1/student/potd", potdRoutes);
app.use("/api/v1/proctoring", proctoringRoutes);
app.use("/api/v1/arduino", arduinoRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
// Must be the LAST app.use() — Express identifies it by the 4-argument signature.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[unhandled error]", err);

  let statusCode = 500;
  let message: string;

  if (err instanceof Error) {
    // Don't expose error details in production
    message = env.nodeEnv === "production" ? "Internal server error" : err.message;
  } else {
    message = env.nodeEnv === "production" ? "Internal server error" : String(err);
  }

  res.status(statusCode).json({ error: message });
});

export default app;
