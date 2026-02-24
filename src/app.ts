// ─── Express Application (thin orchestrator) ────────────────────────────────────
// All config, routes, and middleware live in their own modules.
// This file wires them together — keep it lean for easy collaboration.

import express, { type Request, type Response, type Application } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import swaggerUi from "swagger-ui-express";

import { auth } from "./auth.js";
import { corsOptions, loginLimiter, swaggerSpec } from "./config/index.js";

// Route modules (each dev owns their own file)
import commonRoutes from "./routes/common.js";
import adminRoutes from "./routes/admin.js";
import studentRoutes from "./routes/student.js";

// ─── Create app ─────────────────────────────────────────────────────────────────
const app: Application = express();

app.use(cors(corsOptions));

// Rate-limit login endpoint (8 req / min per IP)
app.use("/auth/sign-in", loginLimiter);

// ─── Mount Better Auth ──────────────────────────────────────────────────────────
// IMPORTANT: must come BEFORE express.json() — Better Auth reads the raw body.
const betterAuthHandler = toNodeHandler(auth);

// Short aliases so clients can POST /auth/sign-up instead of /auth/sign-up/email
app.post("/auth/sign-up", (req: Request, res: Response) => {
  req.url = "/auth/sign-up/email";
  return betterAuthHandler(req, res);
});
app.post("/auth/sign-in", (req: Request, res: Response) => {
  req.url = "/auth/sign-in/email";
  return betterAuthHandler(req, res);
});

// Catch-all for remaining Better Auth routes
// (sign-out, get-session, verify-email, email-otp/*, etc.)
app.all(/^\/auth\/.*/, (req: Request, res: Response) => {
  return betterAuthHandler(req, res);
});

// ─── Body parser (AFTER Better Auth) ────────────────────────────────────────────
app.use(express.json());

// ─── Swagger UI ─────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Serve test frontend at /test ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/test", express.static(path.join(__dirname, "..", "public")));

// ─── Mount route modules ────────────────────────────────────────────────────────
app.use("/", commonRoutes);
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);

export default app;