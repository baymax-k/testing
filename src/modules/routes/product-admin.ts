// ─── Product Admin Routes ────────────────────────────────────────────────────

import { Router } from "express";
import productAdminAuthRoutes from "../product-admin/auth.routes.js";
import productAdminCollegesRoutes from "../product-admin/colleges.routes.js";
import productAdminRbacRoutes from "../product-admin/rbac.routes.js";
import productAdminHackathonRoutes from "../product-admin/hackathon.routes.js";
import productAdminDashboardRoutes from "../product-admin/dashboard.routes.js";
import productAdminUsersRoutes from "../product-admin/users.routes.js";

const router: Router = Router();

// ─── Mount Auth Routes ────────────────────────────────────────────────────────
router.use("/auth", productAdminAuthRoutes);

// ─── Mount RBAC Routes ────────────────────────────────────────────────────────
router.use("/rbac", productAdminRbacRoutes);

// ─── Mount Colleges Routes ────────────────────────────────────────────────────
router.use("/colleges", productAdminCollegesRoutes);

// ─── Mount Hackathon Routes ───────────────────────────────────────────────────
router.use("/hackathons", productAdminHackathonRoutes);

// ─── Mount Dashboard Routes ───────────────────────────────────────────────────
router.use("/dashboard", productAdminDashboardRoutes);

// ─── Mount Users Routes ───────────────────────────────────────────────────────
router.use("/users", productAdminUsersRoutes);

// Additional product admin routes can be added here
// router.use("/dashboard", productAdminDashboardRoutes);
// router.use("/analytics", productAdminAnalyticsRoutes);
// router.use("/settings", productAdminSettingsRoutes);

export default router;
