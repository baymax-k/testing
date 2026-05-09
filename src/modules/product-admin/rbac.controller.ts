// ─── Product Admin RBAC Controller ────────────────────────────────────────────

import type { Response } from "express";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import type { ProductAdminRole } from "../../middleware/rbac.js";
import { ROLE_PERMISSIONS } from "../../middleware/rbac.js";
import { hashPassword } from "../auth/auth.service.js";

// ─── Validators ───────────────────────────────────────────────────────────────

const promoteAdminSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required"),
  newRole: z.enum(["product_admin", "college_admin"]).optional(),
});

const demoteAdminSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required"),
  collegeId: z.string().min(1, "College ID is required"),
});

const getAdminPermissionsSchema = z.object({
  role: z.enum(["product_admin", "college_admin"]),
});

const PRODUCT_ADMIN_PAGE_KEYS = [
  "dashboard",
  "colleges",
  "hackathons",
  "public_tests",
  "public_problems",
  "problems",
  "mcq_list",
  "rbac",
  "users_management",
  "settings",
] as const;

type ProductAdminPageKey = (typeof PRODUCT_ADMIN_PAGE_KEYS)[number];

const PRODUCT_ADMIN_PAGE_LABELS: Record<ProductAdminPageKey, string> = {
  dashboard: "Dashboard",
  colleges: "Colleges",
  hackathons: "Hackathons",
  public_tests: "Public Tests",
  public_problems: "Public Problems",
  problems: "Problems",
  mcq_list: "MCQ List",
  rbac: "RBAC",
  users_management: "Users Management",
  settings: "Settings",
};

const createProductAdminSchema = z.object({
  email: z.email("Invalid email"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores")
    .optional(),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: z.string().max(20).optional().nullable(),
  permissions: z.array(z.enum(PRODUCT_ADMIN_PAGE_KEYS)).min(1, "At least one page permission is required"),
});

const updateProductAdminSchema = z.object({
  email: z.email("Invalid email").optional(),
  name: z.string().min(1, "Name is required").max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  permissions: z.array(z.enum(PRODUCT_ADMIN_PAGE_KEYS)).optional(),
});

const deleteProductAdminParamsSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required"),
});

function normalizePermissions(pages: ProductAdminPageKey[]): ProductAdminPageKey[] {
  return [...new Set(pages)];
}

function buildPermissionResponse(enabledPages: ProductAdminPageKey[]) {
  const enabledSet = new Set(enabledPages);

  return PRODUCT_ADMIN_PAGE_KEYS.map((page) => ({
    page,
    label: PRODUCT_ADMIN_PAGE_LABELS[page],
    canView: enabledSet.has(page),
  }));
}

function sanitizeUsernameBase(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized.length >= 3) {
    return normalized.slice(0, 24);
  }

  return `user_${normalized || "acct"}`.slice(0, 24);
}

async function generateUniqueUsername(seed: string): Promise<string> {
  const base = sanitizeUsernameBase(seed);
  const baseCandidate = base.slice(0, 30);

  const existingBase = await prisma.user.findUnique({ where: { username: baseCandidate } });
  if (!existingBase) {
    return baseCandidate;
  }

  for (let i = 0; i < 20; i++) {
    const suffix = createId().slice(0, 5);
    const trimmed = base.slice(0, Math.max(3, 30 - (suffix.length + 1)));
    const candidate = `${trimmed}_${suffix}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) {
      return candidate;
    }
  }

  return `user_${createId().slice(0, 8)}`;
}

function getUsernameSeed(email: string, name: string): string {
  const emailBase = email.split("@")[0];
  return emailBase || name || "user";
}

async function replaceProductAdminPagePermissions(adminUserId: string, enabledPages: ProductAdminPageKey[]): Promise<void> {
  const enabledSet = new Set(enabledPages);
  const permissionRows = PRODUCT_ADMIN_PAGE_KEYS.map((page) => ({
    adminUserId,
    page,
    canView: enabledSet.has(page),
  }));

  await (prisma as any).productAdminPagePermission.deleteMany({
    where: { adminUserId },
  });

  await (prisma as any).productAdminPagePermission.createMany({
    data: permissionRows,
  });
}

async function getEnabledPagesForAdmin(adminUserId: string): Promise<ProductAdminPageKey[]> {
  const rows = await (prisma as any).productAdminPagePermission.findMany({
    where: { adminUserId, canView: true },
    select: { page: true },
  });

  return rows
    .map((row: { page: ProductAdminPageKey }) => row.page)
    .filter((page: ProductAdminPageKey) => PRODUCT_ADMIN_PAGE_KEYS.includes(page));
}

// ─── Product Admin CRUD With Page Permissions ────────────────────────────────

/**
 * GET /api/product-admin/rbac/product-admins
 * List all product admins with page-level view permissions (product_admin only)
 */
export async function getProductAdmins(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const admins = await prisma.user.findMany({
      where: { role: "product_admin" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        collegeId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const adminIds = admins.map((admin) => admin.id);
    const permissionRows = adminIds.length
      ? await (prisma as any).productAdminPagePermission.findMany({
          where: {
            adminUserId: { in: adminIds },
            canView: true,
          },
          select: {
            adminUserId: true,
            page: true,
          },
        })
      : [];

    const enabledPagesByAdminId = new Map<string, ProductAdminPageKey[]>();
    for (const row of permissionRows as Array<{ adminUserId: string; page: ProductAdminPageKey }>) {
      const pages = enabledPagesByAdminId.get(row.adminUserId) || [];
      pages.push(row.page);
      enabledPagesByAdminId.set(row.adminUserId, pages);
    }

    const adminsWithPermissions = admins.map((admin) => ({
      ...admin,
      permissions: buildPermissionResponse(enabledPagesByAdminId.get(admin.id) || []),
    }));

    res.status(200).json({
      success: true,
      count: adminsWithPermissions.length,
      admins: adminsWithPermissions,
    });
  } catch (err: any) {
    console.error("[rbac/product-admins/list] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch product admins" });
  }
}

/**
 * POST /api/product-admin/rbac/product-admins
 * Create a product admin with page-level view permissions (product_admin only)
 */
export async function createProductAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = createProductAdminSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { email, username, name, password, phone, permissions } = validation.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already exists" });
      return;
    }

    const normalizedPermissions = normalizePermissions(permissions);
    const passwordHash = await hashPassword(password);
    let finalUsername = username;

    if (finalUsername) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: finalUsername },
        select: { id: true },
      });

      if (existingUsername) {
        res.status(400).json({ error: "Username already exists" });
        return;
      }
    } else {
      finalUsername = await generateUniqueUsername(getUsernameSeed(email, name));
    }

    const createdAdmin = await prisma.user.create({
      data: {
        email,
        username: finalUsername,
        name,
        passwordHash,
        role: "product_admin",
        phone: phone || null,
        collegeId: null,
        emailVerified: true,
      } as any,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        collegeId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.productAdminSettings.create({
      data: {
        userId: createdAdmin.id,
      },
    });

    await replaceProductAdminPagePermissions(createdAdmin.id, normalizedPermissions);

    res.status(201).json({
      success: true,
      message: "Product admin created successfully",
      admin: createdAdmin,
      permissions: buildPermissionResponse(normalizedPermissions),
    });
  } catch (err: any) {
    console.error("[rbac/product-admins/create] Error:", err);
    res.status(500).json({ error: err.message || "Failed to create product admin" });
  }
}

/**
 * PATCH /api/product-admin/rbac/product-admins/:adminId
 * Update product admin profile and page-level permissions (product_admin only)
 */
export async function updateProductAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { adminId } = req.params;

    const validation = updateProductAdminSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!admin) {
      res.status(404).json({ error: "Product admin not found" });
      return;
    }

    if (admin.role !== "product_admin") {
      res.status(400).json({ error: "Target user is not a product_admin" });
      return;
    }

    const { email, name, phone, permissions } = validation.data;

    if (email && email !== admin.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingEmail) {
        res.status(400).json({ error: "Email already exists" });
        return;
      }
    }

    const updatedAdmin = await prisma.user.update({
      where: { id: adminId },
      data: {
        ...(email !== undefined && { email }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        collegeId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (permissions !== undefined) {
      const normalizedPermissions = normalizePermissions(permissions);
      await replaceProductAdminPagePermissions(adminId, normalizedPermissions);
    }

    const enabledPages = await getEnabledPagesForAdmin(adminId);

    res.status(200).json({
      success: true,
      message: "Product admin updated successfully",
      admin: updatedAdmin,
      permissions: buildPermissionResponse(enabledPages),
    });
  } catch (err: any) {
    console.error("[rbac/product-admins/update] Error:", err);
    res.status(500).json({ error: err.message || "Failed to update product admin" });
  }
}

/**
 * DELETE /api/product-admin/rbac/product-admins/:adminId
 * Delete a product admin account (product_admin only)
 */
export async function deleteProductAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const paramsValidation = deleteProductAdminParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: paramsValidation.error.issues,
      });
      return;
    }

    const { adminId } = paramsValidation.data;

    if (adminId === req.user.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!admin) {
      res.status(404).json({ error: "Product admin not found" });
      return;
    }

    if (admin.role !== "product_admin") {
      res.status(400).json({ error: "Target user is not a product_admin" });
      return;
    }

    const totalProductAdmins = await prisma.user.count({
      where: { role: "product_admin" },
    });

    if (totalProductAdmins <= 1) {
      res.status(400).json({ error: "Cannot delete the last product admin" });
      return;
    }

    const reassignedTo = req.user.userId;

    await prisma.$transaction([
      prisma.college.updateMany({
        where: { createdById: adminId },
        data: { createdById: reassignedTo },
      }),
      prisma.test.updateMany({
        where: { createdById: adminId },
        data: { createdById: reassignedTo },
      }),
      prisma.hackathon.updateMany({
        where: { createdByUserId: adminId },
        data: { createdByUserId: reassignedTo },
      }),
      prisma.user.delete({
        where: { id: adminId },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Product admin deleted successfully",
      deletedAdminId: adminId,
      reassignedTo,
    });
  } catch (err: any) {
    console.error("[rbac/product-admins/delete] Error:", err);
    if (err instanceof Error && "code" in err && (err as any).code === "P2003") {
      res.status(400).json({ error: "Cannot delete product admin with dependent records" });
      return;
    }
    res.status(500).json({ error: err.message || "Failed to delete product admin" });
  }
}

// ─── Get All Product Admins ───────────────────────────────────────────────────

/**
 * GET /api/product-admin/rbac/admins
 * List all product admins (product_admin only)
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
          in: ["product_admin", "college_admin"],
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

    if (!["product_admin", "college_admin"].includes(admin.role)) {
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

// ─── Promote Admin (to product_admin) ────────────────────────────────────────────

/**
 * POST /api/product-admin/rbac/promote
 * Promote an admin to product_admin (product_admin only)
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
    const targetRole = newRole || "product_admin";

    // Find the admin to promote
    const adminToPromote = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!adminToPromote) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }

    if (!["product_admin", "college_admin"].includes(adminToPromote.role)) {
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
        // If promoting to product_admin, they don't need collegeId
        ...(targetRole === "product_admin" && { collegeId: null }),
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
 * Demote a product_admin to college_admin and assign to a college (product_admin only)
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

    if (adminToDemote.role !== "product_admin") {
      res.status(400).json({ error: "Only product_admins can be demoted" });
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

