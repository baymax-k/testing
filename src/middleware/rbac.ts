// ─── Role-Based Access Control (RBAC) Middleware ────────────────────────────

import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";

// ─── Role Hierarchy & Permissions ─────────────────────────────────────────────

export type ProductAdminRole = "super_admin" | "college_admin";

/**
 * Role hierarchy for product admin portal:
 * super_admin (level 3) > college_admin (level 2)
 * 
 * super_admin: Can access all colleges, create new colleges, manage all admins
 * college_admin: Can only access their assigned college, manage college-level resources
 */

export const ROLE_HIERARCHY: Record<ProductAdminRole, number> = {
  super_admin: 3,
  college_admin: 2,
};

export const ROLE_PERMISSIONS: Record<ProductAdminRole, string[]> = {
  super_admin: [
    // College management
    "college:create",
    "college:read",
    "college:update",
    "college:delete",
    "college:list",
    
    // Admin management
    "admin:create",
    "admin:read",
    "admin:update",
    "admin:delete",
    "admin:list",
    "admin:promote",
    "admin:demote",
    
    // Settings management
    "settings:manage",
    "system:manage",
  ],
  college_admin: [
    // Can read own college
    "college:read",
    "college:update",
    
    // Can manage college resources
    "admin:read",
    "admin:list",
    
    // Can manage own settings
    "settings:manage",
  ],
};

// ─── Middleware Factories ─────────────────────────────────────────────────────

/**
 * Check if user has specific product admin role
 * Usage: router.use(requireRole("super_admin"))
 */
export const requireRole = (requiredRole: ProductAdminRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userRole = authReq.user.role as ProductAdminRole;
    const requiredLevel = ROLE_HIERARCHY[requiredRole];
    const userLevel = ROLE_HIERARCHY[userRole];

    if (!userLevel || userLevel < requiredLevel) {
      res.status(403).json({
        error: "Forbidden",
        message: `This action requires ${requiredRole} role. User has: ${userRole}`,
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has specific permission
 * Usage: router.use(requirePermission("admin:create"))
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userRole = authReq.user.role as ProductAdminRole;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!userPermissions.includes(permission)) {
      res.status(403).json({
        error: "Forbidden",
        message: `This action requires '${permission}' permission`,
      });
      return;
    }

    next();
  };
};

/**
 * Check if user is super_admin
 * Usage: router.use(requireSuperAdmin())
 */
export const requireSuperAdmin = () => {
  return requireRole("super_admin");
};

/**
 * Check if user is at least college_admin
 * Usage: router.use(requireProductAdmin())
 */
export const requireProductAdmin = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validRoles = ["super_admin", "college_admin"];
    if (!validRoles.includes(authReq.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: "This action requires product admin role",
      });
      return;
    }

    next();
  };
};

/**
 * Helper function to check if user can access a specific college
 * - super_admin can access all colleges
 * - college_admin can only access their assigned college
 */
export const canAccessCollege = (userRole: string, userCollegeId: string | null, targetCollegeId: string): boolean => {
  if (userRole === "super_admin") {
    return true;
  }
  
  if (userRole === "college_admin") {
    return userCollegeId === targetCollegeId;
  }
  
  return false;
};

// ─── Role-based response filtering ────────────────────────────────────────────

/**
 * Filter college data based on user role and permissions
 */
export const filterCollegeResponse = (
  college: any,
  userRole: string,
  includeStats: boolean = false
) => {
  const baseCollege = {
    id: college.id,
    name: college.name,
    code: college.code,
    description: college.description,
    website: college.website,
    location: college.location,
    adminId: college.adminId,
    admin: college.admin ? {
      id: college.admin.id,
      email: college.admin.email,
      name: college.admin.name,
      phone: college.admin.phone,
    } : null,
    createdAt: college.createdAt,
    updatedAt: college.updatedAt,
  };

  if (includeStats && userRole === "super_admin") {
    return {
      ...baseCollege,
      stats: {
        totalDepartments: college._count?.departments || 0,
        totalAdmins: college._count?.users || 0,
      },
    };
  }

  return baseCollege;
};
