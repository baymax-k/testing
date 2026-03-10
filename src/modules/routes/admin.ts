import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import { hashPassword } from "../auth/auth.service.js";

const router: RouterType = Router();

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  role: z.enum(["college_admin", "product_admin", "instructor_staff"], {
    message: "Invalid role. Allowed: college_admin, product_admin, instructor_staff",
  }),
});

// ─── Admin dashboard ──────────────────────────────────────────────────────────
router.get("/dashboard", requireAuth, requireRole("product_admin"), (req: Request, res: Response) => {
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
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// ─── Create a Staff/Admin User ────────────────────────────────────────────────
router.post(
  "/create-user",
  requireAuth,
  requireRole("product_admin", "college_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = createUserSchema.parse(req.body);
      const requestingUser = (req as AuthRequest).user!;

      // College admins can only create instructor staff
      if (requestingUser.role === "college_admin" && data.role !== "instructor_staff") {
        res.status(403).json({ error: "College admins can only create instructor staff." });
        return;
      }

      const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
      if (existingEmail) {
        res.status(400).json({ error: "An account with this email already exists" });
        return;
      }

      const existingUsername = await prisma.user.findUnique({ where: { username: data.username } });
      if (existingUsername) {
        res.status(400).json({ error: "That username is already taken" });
        return;
      }

      const passwordHash = await hashPassword(data.password);

      const newUser = await prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          name: data.name,
          passwordHash,
          role: data.role,
          emailVerified: true, // Staff accounts are pre-verified by admin
        },
      });

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
          emailVerified: newUser.emailVerified,
        },
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: err.issues });
        return;
      }
      console.error("[create-user] Error:", err);
      res.status(500).json({ error: "Failed to create user" });
    }
  }
);

// ─── List Users ───────────────────────────────────────────────────────────────
router.get(
  "/users",
  requireAuth,
  requireRole("product_admin"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ users, total: users.length });
    } catch (err) {
      console.error("[list-users] Error:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

export default router;
