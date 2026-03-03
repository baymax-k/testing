import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { AuthRequest } from "../../middleware/auth.js";
import { auth, prisma } from "../../config/auth.js";

const router: RouterType = Router();

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  role: z.enum(["college_admin", "product_admin", "instructor_staff"], {
    message: "Invalid role. Allowed: college_admin, product_admin, instructor_staff",
  }),
});

// ─── Admin dashboard ─────────────────────────────────────────────────────────
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
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      image: user.image,
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

      const userRole = (req as AuthRequest).user!.role;
      // College admins can only create instructor staff
      if (userRole === "college_admin" && data.role !== "instructor_staff") {
        res.status(403).json({ error: "College admins can only create instructor staff." });
        return;
      }

      // Avoid setting session cookies on the admin's response by not passing headers
      const newUser = await auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: data.name,
        } as any,
      });

      if (!newUser?.user) {
        res.status(400).json({ error: "Failed to create user." });
        return;
      }

      // Elevate privileges directly in the DB since input:false blocks it during signup
      await prisma.user.update({
        where: { id: newUser.user.id },
        data: { role: data.role, emailVerified: true },
      });

      res.status(201).json({
        message: "User created successfully",
        user: { ...newUser.user, role: data.role },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: err.issues });
        return;
      }
      console.error("[create-user] Error:", err);
      // Surface Better-Auth API errors (like email already exists)
      res.status(400).json({ error: err.message || "Failed to create user" });
    }
  }
);

export default router;
