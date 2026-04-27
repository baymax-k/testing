// ─── Product Admin Hackathon Routes ───────────────────────────────────────────

import { Router } from "express";
import {
  createHackathon,
  getHackathons,
  getHackathonById,
  updateHackathon,
  updateHackathonStatus,
  deleteHackathon,
  updateTeam,
  getHackathonStats,
} from "./hackathon.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router: Router = Router();

// All hackathon routes require authentication
router.use(requireAuth);

// ─── Create hackathon (product_admin only)
router.post("/", requireRole("product_admin"), createHackathon);

// ─── Get all hackathons (with filtering)
router.get("/", getHackathons);

// ─── Get hackathon by ID
router.get("/:hackathonId", getHackathonById);

// ─── Get hackathon statistics
router.get("/:hackathonId/stats", getHackathonStats);

// ─── Update hackathon (product_admin only)
router.patch("/:hackathonId", requireRole("product_admin"), updateHackathon);

// ─── Update hackathon status (product_admin only)
router.patch("/:hackathonId/status", requireRole("product_admin"), updateHackathonStatus);

// ─── Delete hackathon (product_admin only)
router.delete("/:hackathonId", requireRole("product_admin"), deleteHackathon);

// ─── Update team submission/scoring
router.patch("/:hackathonId/teams/:teamId", updateTeam);

export default router;
