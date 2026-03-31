// ─── Product Admin Routes ────────────────────────────────────────────────────

import { Router } from "express";
import productAdminAuthRoutes from "../product-admin/auth.routes.js";

const router: Router = Router();

// ─── Mount Auth Routes ────────────────────────────────────────────────────────
router.use("/auth", productAdminAuthRoutes);

// Additional product admin routes can be added here
// router.use("/dashboard", productAdminDashboardRoutes);
// router.use("/products", productAdminProductRoutes);
// router.use("/settings", productAdminSettingsRoutes);

export default router;
