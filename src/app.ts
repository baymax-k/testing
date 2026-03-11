// ─── Express Application ──────────────────────────────────────────────────────

import express, { type Request, type Response, type NextFunction, type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";

import { corsOptions, swaggerSpec } from "./config/index.js";

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

// ─── Create app ───────────────────────────────────────────────────────────────
const app: Application = express();

// Trust the first proxy (AWS ALB, Nginx, Cloudflare)
// Without this, all users behind a reverse proxy share ONE rate-limit counter.
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(cors(corsOptions));

// Parse cookies — must come before routes so req.cookies is populated
app.use(cookieParser());

// Parse JSON body
app.use(express.json());

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs-json", (_req, res) => { res.json(swaggerSpec); });

// ─── Serve test frontend ──────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/test", express.static(path.join(__dirname, "..", "public")));

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

// ─── Global error handler ─────────────────────────────────────────────────────
// Must be the LAST app.use() — Express identifies it by the 4-argument signature.
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
