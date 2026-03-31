// ─── Product Admin Colleges Routes ────────────────────────────────────────────

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  createCollege,
  getColleges,
  getCollege,
  updateCollege,
  createCollegeAdmin,
  assignAdminToCollege,
  editAdmin,
  removeAdminFromCollege,
  deleteCollege,
} from "./colleges.controller.js";

const router: Router = Router();

// All routes require authentication as product admin
router.use(requireAuth);

// ─── College Management ────────────────────────────────────────────────────────

// Create college
router.post("/", createCollege);

// Get all colleges
router.get("/", getColleges);

// Get single college
router.get("/:collegeId", getCollege);

// Update college
router.patch("/:collegeId", updateCollege);

// Delete college
router.delete("/:collegeId", deleteCollege);

// ─── College Admin Management ──────────────────────────────────────────────────

// Create and assign college admin
router.post("/admins/create", createCollegeAdmin);

// Assign existing user as college admin
router.post("/assign-admin", assignAdminToCollege);

// Edit college admin details
router.patch("/admin/:adminId", editAdmin);

// Remove admin from college
router.delete("/:collegeId/admin", removeAdminFromCollege);

export default router;
