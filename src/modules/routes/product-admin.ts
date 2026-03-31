// ─── Product Admin Routes ────────────────────────────────────────────────────

import { Router } from "express";
import productAdminAuthRoutes from "../product-admin/auth.routes.js";
import productAdminCollegesRoutes from "../product-admin/colleges.routes.js";

const router: Router = Router();

// ─── Mount Auth Routes ────────────────────────────────────────────────────────
router.use("/auth", productAdminAuthRoutes);

// ─── Mount Colleges Routes ────────────────────────────────────────────────────
router.use("/colleges", productAdminCollegesRoutes);

// Additional product admin routes can be added here
// router.use("/dashboard", productAdminDashboardRoutes);
// router.use("/analytics", productAdminAnalyticsRoutes);
// router.use("/settings", productAdminSettingsRoutes);

export default router;
