import { Router, type Request, type Response, type Router as RouterType } from "express";
import { requireAuth } from "../../middleware/auth.js";
import type { AuthRequest } from "../../middleware/auth.js";

const router: RouterType = Router();

// Role → frontend redirect mapping
const ROLE_REDIRECTS: Record<string, string> = {
  student: "/student/dashboard",
  college_admin: "/admin/dashboard",
  product_admin: "/admin/dashboard",
  instructor_staff: "/admin/dashboard",
};

// ─── Health check ───────────────────────────────────────────────────────────────
router.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "CodeEthnics API is running",
  });
});

// ─── Who am I? (frontend calls this after login to know where to redirect) ─────
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.json({
    user: {
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
    redirect: ROLE_REDIRECTS[user.role] || "/student/dashboard",
  });
});

export default router;
