// ─── Judge0 Health Route ────────────────────────────────────────────────────────

import { Router, type Router as RouterType } from "express";
import { judge0HealthHandler } from "../controllers/submission.controller.js";

const router: RouterType = Router();

// GET /api/v1/judge0/health — Check if Judge0 is reachable (no auth required)
router.get("/health", judge0HealthHandler);

export default router;
