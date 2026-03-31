// ─── Product Admin RBAC Controller ────────────────────────────────────────────

import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import type { ProductAdminRole } from "../../middleware/rbac.js";
import { ROLE_PERMISSIONS } from "../../middleware/rbac.js";

// ─── Validators ───────────────────────────────────────────────────────────────

const promoteAdminSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required"),
  newRole: z.enum(["super_admin", "college_admin"]).optional(),
});

const demoteAdminSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required"),
  collegeId: z.string().min(1, "College ID is required"),
});

const getAdminPermissionsSchema = z.object({
  role: z.enum(["super_admin", "college_admin"]),
});

// ─── Get All Product Admins ───────────────────────────────────────────────────

/**
 * GET /api/product-admin/rbac/admins
 * List all product admins (super_admin only)
 */
export async function getAllAdmins(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ["super_admin", "college_admin"],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        collegeId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch college details separately
    const adminsWithCollege = await Promise.all(
      admins.map(async (admin) => {
        if (admin.collegeId) {
          const college = await prisma.college.findUnique({
            where: { id: admin.collegeId },
            select: {
              id: true,
              name: true,
              code: true,
            },
          });
          return { ...admin, college };
        }
        return { ...admin, college: null };
      })
    );

    res.status(200).json({
      success: true,
      count: adminsWithCollege.length,
      admins: adminsWithCollege,
    });
  } catch (err: any) {
    console.error("[rbac/admins/list] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch admins" });
  }
}

// ─── Get Admin Details ────────────────────────────────────────────────────────

/**
 * GET /api/product-admin/rbac/admins/:adminId
 * Get detailed information about a specific admin
 */
export async function getAdminDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { adminId } = req.params;

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        collegeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }

    if (!["super_admin", "college_admin"].includes(admin.role)) {
      res.status(400).json({ error: "User is not a product admin" });
      return;
    }

    const permissions = ROLE_PERMISSIONS[admin.role as ProductAdminRole] || [];

    let college = null;
    if (admin.collegeId) {
      college = await prisma.college.findUnique({
        where: { id: admin.collegeId },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });
    }

    res.status(200).json({
      success: true,
      admin: {
        ...admin,
        college,
        permissions,
      },
    });
  } catch (err: any) {
    console.error("[rbac/admins/get] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch admin" });
  }
}

// ─── Promote Admin (to super_admin) ────────────────────────────────────────────

/**
 * POST /api/product-admin/rbac/promote
 * Promote an admin to super_admin (super_admin only)
 */
export async function promoteAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = promoteAdminSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { adminId, newRole } = validation.data;
    const targetRole = (newRole || "super_admin") as "super_admin" | "college_admin";

    // Find the admin to promote
    const adminToPromote = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!adminToPromote) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }

    if (!["super_admin", "college_admin"].includes(adminToPromote.role)) {
      res.status(400).json({ error: "User is not a product admin" });
      return;
    }

    if (adminToPromote.role === targetRole) {
      res.status(400).json({ error: `Admin already has role: ${targetRole}` });
      return;
    }

    // Update the admin's role
    const updated = await prisma.user.update({
      where: { id: adminId },
      data: {
        role: targetRole,
        // If promoting to super_admin, they don't need collegeId
        ...(targetRole === "super_admin" && { collegeId: null }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        collegeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let college = null;
    if (updated.collegeId) {
      college = await prisma.college.findUnique({
        where: { id: updated.collegeId },
        select: { id: true, name: true },
      });
    }

    res.status(200).json({
      success: true,
      message: `Admin promoted to ${targetRole} successfully`,
      admin: { ...updated, college },
    });
  } catch (err: any) {
    console.error("[rbac/promote] Error:", err);
    res.status(500).json({ error: err.message || "Failed to promote admin" });
  }
}

// ─── Demote Admin (to college_admin) ───────────────────────────────────────────

/**
 * POST /api/product-admin/rbac/demote
 * Demote a super_admin to college_admin and assign to a college (super_admin only)
 */
export async function demoteAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = demoteAdminSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { adminId, collegeId } = validation.data;

    // Find the admin to demote
    const adminToDemote = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!adminToDemote) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }

    if (adminToDemote.role !== "super_admin") {
      res.status(400).json({ error: "Only super_admins can be demoted" });
      return;
    }

    // Check if college exists
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    // Update the admin's role
    const updated = await prisma.user.update({
      where: { id: adminId },
      data: {
        role: "college_admin",
        collegeId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        collegeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const updatedCollege = await prisma.college.findUnique({
      where: { id: updated.collegeId! },
      select: { id: true, name: true },
    });

    res.status(200).json({
      success: true,
      message: "Admin demoted to college_admin role successfully",
      admin: { ...updated, college: updatedCollege },
    });
  } catch (err: any) {
    console.error("[rbac/demote] Error:", err);
    res.status(500).json({ error: err.message || "Failed to demote admin" });
  }
}

// ─── Get Role Permissions ────────────────────────────────────────────────────

/**
 * GET /api/product-admin/rbac/roles/:role/permissions
 * Get all permissions for a specific role
 */
export async function getRolePermissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role } = req.params;

    const validation = getAdminPermissionsSchema.safeParse({ role });
    if (!validation.success) {
      res.status(400).json({
        error: "Invalid role",
        details: validation.error.issues,
      });
      return;
    }

    const permissions = ROLE_PERMISSIONS[role as ProductAdminRole] || [];

    res.status(200).json({
      success: true,
      role,
      permissionCount: permissions.length,
      permissions,
    });
  } catch (err: any) {
    console.error("[rbac/permissions] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch permissions" });
  }
}

// ─── Get User Permissions ────────────────────────────────────────────────────

/**
 * GET /api/product-admin/rbac/my-permissions
 * Get current user's permissions
 */
export async function getMyPermissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId || !req.user?.role) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userRole = req.user.role as ProductAdminRole;
    const permissions = ROLE_PERMISSIONS[userRole] || [];

    res.status(200).json({
      success: true,
      role: userRole,
      permissionCount: permissions.length,
      permissions,
    });
  } catch (err: any) {
    console.error("[rbac/my-permissions] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch permissions" });
  }
}
