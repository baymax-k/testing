import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { getProductAdminDashboardData } from "../services/productAdminDashboard.service.js";

function isProductAdminRole(role: string): boolean {
  return role === "product_admin" || role === "super_admin";
}

/**
 * GET /api/product-admin/dashboard
 * Returns product-admin dashboard stats/cards/charts/activity feed.
 */
export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!isProductAdminRole(req.user.role)) {
      res.status(403).json({ error: "Only product_admin or super_admin can access dashboard" });
      return;
    }

    const dashboard = getProductAdminDashboardData();

    res.status(200).json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[product-admin/dashboard] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch dashboard" });
  }
}
