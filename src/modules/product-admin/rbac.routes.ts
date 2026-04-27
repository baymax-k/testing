// ─── Product Admin RBAC Routes ────────────────────────────────────────────────

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireProductAdminOnly } from "../../middleware/rbac.js";
import {
  getAllAdmins,
  getAdminDetails,
  getProductAdmins,
  promoteAdmin,
  demoteAdmin,
  createProductAdmin,
  updateProductAdmin,
  deleteProductAdmin,
  getRolePermissions,
  getMyPermissions,
} from "./rbac.controller.js";

const router: Router = Router();

// All RBAC routes require authentication
router.use(requireAuth);

// ─── Admin Management (product_admin only) ─────────────────────────────────────

// List all admins
router.get("/admins", requireProductAdminOnly(), getAllAdmins);

// List all product admins with page permissions
router.get("/product-admins", requireProductAdminOnly(), getProductAdmins);

// Create a product admin with page permissions
router.post("/product-admins", requireProductAdminOnly(), createProductAdmin);

// Update a product admin and page permissions
router.patch("/product-admins/:adminId", requireProductAdminOnly(), updateProductAdmin);

// Delete a product admin
router.delete("/product-admins/:adminId", requireProductAdminOnly(), deleteProductAdmin);

// Get admin details
router.get("/admins/:adminId", getAdminDetails);

// Promote admin to product_admin
router.post("/promote", requireProductAdminOnly(), promoteAdmin);

// Demote product_admin to college_admin
router.post("/demote", requireProductAdminOnly(), demoteAdmin);

// ─── Permissions Management ────────────────────────────────────────────────────

// Get permissions for a specific role
router.get("/roles/:role/permissions", getRolePermissions);

// Get current user's permissions
router.get("/my-permissions", getMyPermissions);

export default router;
