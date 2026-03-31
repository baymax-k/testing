// ─── Product Admin College Controller ──────────────────────────────────────────

import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import { auth } from "../../config/auth.js";
import {
  hashPassword,
  verifyPassword,
  issueTokens,
  accessCookieOptions,
  refreshCookieOptions,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../auth/auth.service.js";

// ─── Validators ───────────────────────────────────────────────────────────────

const createCollegeSchema = z.object({
  name: z.string().min(1, "College name is required").max(200),
  code: z.string().min(1, "College code is required").max(50),
  description: z.string().max(500).optional().nullable(),
  website: z.string().url().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

const createCollegeAdminSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: z.string().max(20).optional().nullable(),
  collegeId: z.string().min(1, "College ID is required"),
});

const assignAdminSchema = z.object({
  collegeId: z.string().min(1, "College ID is required"),
  adminId: z.string().min(1, "Admin ID is required"),
});

const updateCollegeSchema = z.object({
  name: z.string().min(1, "College name is required").max(200).optional(),
  code: z.string().min(1, "College code is required").max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  website: z.string().url().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  adminId: z.string().optional().nullable(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeCollege(college: any) {
  return {
    id: college.id,
    name: college.name,
    code: college.code,
    description: college.description,
    website: college.website,
    location: college.location,
    adminId: college.adminId,
    admin: college.admin
      ? {
          id: college.admin.id,
          email: college.admin.email,
          name: college.admin.name,
          phone: college.admin.phone,
        }
      : null,
    createdAt: college.createdAt,
    updatedAt: college.updatedAt,
  };
}

// ─── Create College ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/colleges
 * Creates a new college/institution
 */
export async function createCollege(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = createCollegeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const data = validation.data;

    // Check if college code already exists
    const existingCollege = await prisma.college.findUnique({
      where: { code: data.code },
    });

    if (existingCollege) {
      res.status(400).json({ error: "College code already exists" });
      return;
    }

    // Check if college name already exists
    const existingName = await prisma.college.findUnique({
      where: { name: data.name },
    });

    if (existingName) {
      res.status(400).json({ error: "College name already exists" });
      return;
    }

    const college = await prisma.college.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        website: data.website || null,
        location: data.location || null,
        createdById: req.user.userId,
      },
      include: {
        admin: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "College created successfully",
      college: safeCollege(college),
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/create] Error:", err);
    res.status(500).json({ error: err.message || "Failed to create college" });
  }
}

// ─── Get All Colleges ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/product-admin/colleges
 * Retrieves all colleges
 */
export async function getColleges(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const colleges = await prisma.college.findMany({
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: {
            departments: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      colleges: colleges.map((c) => ({
        ...safeCollege(c),
        stats: {
          totalDepartments: c._count.departments,
          totalUsers: c._count.users,
        },
      })),
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/list] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch colleges" });
  }
}

// ─── Get Single College ────────────────────────────────────────────────────────

/**
 * GET /api/v1/product-admin/colleges/:collegeId
 * Retrieves a single college with details
 */
export async function getCollege(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { collegeId } = req.params;

    const college = await prisma.college.findUnique({
      where: { id: collegeId },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
          },
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
            _count: {
              select: { users: true, batches: true },
            },
          },
        },
        _count: {
          select: {
            departments: true,
            users: true,
          },
        },
      },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    res.status(200).json({
      success: true,
      college: {
        ...safeCollege(college),
        departments: college.departments,
        stats: {
          totalDepartments: college._count.departments,
          totalUsers: college._count.users,
        },
      },
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/get] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch college" });
  }
}

// ─── Update College ───────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/product-admin/colleges/:collegeId
 * Updates college details
 */
export async function updateCollege(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { collegeId } = req.params;

    const validation = updateCollegeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const data = validation.data;

    // Check if college exists
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    // Check for unique code conflicts
    if (data.code && data.code !== college.code) {
      const existingCode = await prisma.college.findUnique({
        where: { code: data.code },
      });
      if (existingCode) {
        res.status(400).json({ error: "College code already exists" });
        return;
      }
    }

    // Check for unique name conflicts
    if (data.name && data.name !== college.name) {
      const existingName = await prisma.college.findUnique({
        where: { name: data.name },
      });
      if (existingName) {
        res.status(400).json({ error: "College name already exists" });
        return;
      }
    }

    const updated = await prisma.college.update({
      where: { id: collegeId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.adminId !== undefined && { adminId: data.adminId }),
      },
      include: {
        admin: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "College updated successfully",
      college: safeCollege(updated),
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/update] Error:", err);
    res.status(500).json({ error: err.message || "Failed to update college" });
  }
}

// ─── Create College Admin ──────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/colleges/admins/create
 * Creates a new college admin and assigns to college
 */
export async function createCollegeAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = createCollegeAdminSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const data = validation.data;

    // Check if college exists
    const college = await prisma.college.findUnique({
      where: { id: data.collegeId },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already exists" });
      return;
    }

    // Create user via Better Auth
    const newUser = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      } as any,
    });

    if (!newUser || !newUser.user || (newUser as any).error) {
      const errorMessage = (newUser as any).error?.message || "Failed to create user";
      res.status(400).json({ error: errorMessage });
      return;
    }

    // Update user with college_admin role and college assignment
    const admin = await prisma.user.update({
      where: { email: data.email },
      data: {
        role: "college_admin",
        phone: data.phone || null,
        collegeId: data.collegeId,
        emailVerified: true,
      },
    });

    // Assign admin to college
    await prisma.college.update({
      where: { id: data.collegeId },
      data: { adminId: admin.id },
    });

    res.status(201).json({
      success: true,
      message: "College admin created and assigned successfully",
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        collegeId: admin.collegeId,
      },
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/admins/create] Error:", err);
    res.status(500).json({ error: err.message || "Failed to create college admin" });
  }
}

// ─── Assign Admin to College ───────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/colleges/assign-admin
 * Assigns an existing user as admin of a college
 */
export async function assignAdminToCollege(req: AuthRequest, res: Response): Promise<void> {
  try {
    const validation = assignAdminSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { collegeId, adminId } = validation.data;

    // Check if college exists
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // User must have college_admin or principal role
    if (user.role !== "college_admin" && user.role !== "principal") {
      res.status(400).json({
        error: `User must have college_admin or principal role, got: ${user.role}`,
      });
      return;
    }

    // Update college and user
    const [updatedCollege, updatedUser] = await Promise.all([
      prisma.college.update({
        where: { id: collegeId },
        data: { adminId },
        include: { admin: true },
      }),
      prisma.user.update({
        where: { id: adminId },
        data: { collegeId },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Admin assigned to college successfully",
      college: safeCollege(updatedCollege),
      admin: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        collegeId: updatedUser.collegeId,
      },
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/assign-admin] Error:", err);
    res.status(500).json({ error: err.message || "Failed to assign admin" });
  }
}

// ─── Remove Admin from College ─────────────────────────────────────────────────

/**
 * DELETE /api/v1/product-admin/colleges/:collegeId/admin
 * Removes admin from college
 */
export async function removeAdminFromCollege(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { collegeId } = req.params;

    // Check if college exists
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
      include: { admin: true },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    if (!college.adminId) {
      res.status(400).json({ error: "College has no admin assigned" });
      return;
    }

    // Update college to remove admin and update user
    const [updatedCollege, updatedUser] = await Promise.all([
      prisma.college.update({
        where: { id: collegeId },
        data: { adminId: null },
        include: { admin: true },
      }),
      prisma.user.update({
        where: { id: college.adminId },
        data: { collegeId: null },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Admin removed from college successfully",
      college: safeCollege(updatedCollege),
      removedAdmin: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
      },
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/remove-admin] Error:", err);
    res.status(500).json({ error: err.message || "Failed to remove admin" });
  }
}

// ─── Delete College ───────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/product-admin/colleges/:collegeId
 * Deletes a college (admin only)
 */
export async function deleteCollege(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { collegeId } = req.params;

    // Check if college exists
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
      include: {
        _count: {
          select: { departments: true, users: true },
        },
      },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    // Prevent deletion if college has departments or users
    if (college._count.departments > 0 || college._count.users > 0) {
      res.status(400).json({
        error: "Cannot delete college with existing departments or users",
        stats: {
          departments: college._count.departments,
          users: college._count.users,
        },
      });
      return;
    }

    await prisma.college.delete({
      where: { id: collegeId },
    });

    res.status(200).json({
      success: true,
      message: "College deleted successfully",
    });
  } catch (err: any) {
    console.error("[product-admin/colleges/delete] Error:", err);
    res.status(500).json({ error: err.message || "Failed to delete college" });
  }
}
