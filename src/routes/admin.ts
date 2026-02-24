import { Router, type Request, type Response, type Router as RouterType } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { auth, prisma } from "../auth.js";

const router: RouterType = Router();

// ─── Admin dashboard (product_admin only) ───────────────────────────────────────
router.get(
  "/dashboard",
  requireAuth,
  requireRole("product_admin"),
  (req: Request, res: Response) => {
    const user = (req as AuthRequest).user!;
    res.json({
      panel: "admin",
      message: `Welcome back, ${user.name}!`,
      dashboard: {
        title: "Admin Dashboard",
        sections: [
          { name: "User Management", status: "active", endpoint: "/admin/users" },
          { name: "Create Staff User", status: "active", endpoint: "/admin/create-user" },
          { name: "Analytics", status: "coming soon" },
          { name: "Settings", status: "coming soon" },
        ],
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        image: user.image,
      },
    });
  }
);

// ─── Create a new staff/admin user (product_admin only) ─────────────────────────
router.post(
  "/create-user",
  requireAuth,
  requireRole("product_admin"),
  async (req: Request, res: Response) => {
    try {
      const { email, password, name, role } = req.body;

      // Validate required fields
      if (!email || !password || !name || !role) {
        res
          .status(400)
          .json({ error: "Missing required fields: email, password, name, role" });
        return;
      }

      // Validate role – students are not created via this endpoint
      const allowedRoles = ["college_admin", "product_admin", "instructor_staff"];
      if (!allowedRoles.includes(role)) {
        res.status(400).json({
          error: `Invalid role. Allowed: ${allowedRoles.join(", ")}. Students register via /auth/sign-up.`,
        });
        return;
      }

      // Validate password length
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ error: "A user with this email already exists" });
        return;
      }

      // Create user via Better Auth's internal API (handles password hashing)
      const result = await auth.api.signUpEmail({
        body: { email, password, name },
      });

      if (!result?.user?.id) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Update the role (since input: false prevents it from being set during sign-up)
      await prisma.user.update({
        where: { id: result.user.id },
        data: {
          role,
          emailVerified: true, // Admin-created users are pre-verified
        },
      });

      const createdUser = await prisma.user.findUnique({
        where: { id: result.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json(createdUser);
    } catch (err: unknown) {
      console.error("Admin create-user error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── List all users (product_admin only) ────────────────────────────────────────
router.get(
  "/users",
  requireAuth,
  requireRole("product_admin"),
  async (_req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(users);
    } catch (err: unknown) {
      console.error("Admin list-users error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
