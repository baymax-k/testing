import { Router, type Request, type Response, type Router as RouterType } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { AuthRequest } from "../../middleware/auth.js";

const router: RouterType = Router();

// ─── Student dashboard ──────────────────────────────────────────────────────────
router.get(
  "/dashboard",
  requireAuth,
  requireRole("student"),
  (req: Request, res: Response) => {
    const user = (req as AuthRequest).user!;
    res.json({
      panel: "student",
      message: `Welcome back, ${user.name}!`,
      dashboard: {
        title: "Student Dashboard",
        sections: [
          { name: "My Courses", status: "coming soon" },
          { name: "Assignments", status: "coming soon" },
          { name: "Grades", status: "coming soon" },
          { name: "Schedule", status: "coming soon" },
        ],
      },
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  }
);

// ─── Student profile ────────────────────────────────────────────────────────────
router.get(
  "/profile",
  requireAuth,
  requireRole("student"),
  (req: Request, res: Response) => {
    const user = (req as AuthRequest).user!;
    res.json({
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    });
  }
);

export default router;
