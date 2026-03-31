// ─── Product Admin RBAC Routes ────────────────────────────────────────────────

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireSuperAdmin } from "../../middleware/rbac.js";
import {
  getAllAdmins,
  getAdminDetails,
  promoteAdmin,
  demoteAdmin,
  getRolePermissions,
  getMyPermissions,
} from "./rbac.controller.js";

const router: Router = Router();

// All RBAC routes require authentication
router.use(requireAuth);

// ─── Admin Management (superadmin only) ────────────────────────────────────────

// List all admins
router.get("/admins", requireSuperAdmin(), getAllAdmins);

// Get admin details
router.get("/admins/:adminId", getAdminDetails);

// Promote admin to superadmin
router.post("/promote", requireSuperAdmin(), promoteAdmin);

// Demote superadmin to admin
router.post("/demote", requireSuperAdmin(), demoteAdmin);

// ─── Permissions Management ────────────────────────────────────────────────────

// Get permissions for a specific role
router.get("/roles/:role/permissions", getRolePermissions);

// Get current user's permissions
router.get("/my-permissions", getMyPermissions);

export default router;
