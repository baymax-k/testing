import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { getProductAdminUserStats } from "../services/productAdminUserStats.service.js";

function isProductAdminRole(role: string): boolean {
  return role === "product_admin" || role === "super_admin";
}

/**
 * GET /api/product-admin/users/stats
 * Returns hierarchical user stats grouped by college -> department -> year -> batch.
 */
export async function getUsersStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!isProductAdminRole(req.user.role)) {
      res.status(403).json({ error: "Only product_admin or super_admin can access user stats" });
      return;
    }

    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const stats = await getProductAdminUserStats({ search });

    res.status(200).json({
      success: true,
      ...stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[product-admin/users/stats] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch user stats" });
  }
}