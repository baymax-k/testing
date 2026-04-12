import { Router, type Request, type Response, type Router as RouterType } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { AuthRequest } from "../../middleware/auth.js";
import { getStudentProfileHandler } from "../controllers/student.controller.js";
import { getStudentDashboardHandler } from "../controllers/student-dashboard.controller.js";

const router: RouterType = Router();

// ─── Student dashboard ──────────────────────────────────────────────────────────
router.get(
  "/dashboard",
  requireAuth,
  requireRole("student"),
  getStudentDashboardHandler
);

// ─── Student profile ────────────────────────────────────────────────────────────
router.get(
  "/profile",
  requireAuth,
  requireRole("student"),
  getStudentProfileHandler
);

export default router;
