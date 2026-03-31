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
import { requireAuth } from "../../middleware/auth.js";
import { requireSuperAdmin } from "../../middleware/rbac.js";

const router: Router = Router();

// All hackathon routes require authentication
router.use(requireAuth);

// ─── Create hackathon (super_admin only)
router.post("/", requireSuperAdmin(), createHackathon);

// ─── Get all hackathons (with filtering)
router.get("/", getHackathons);

// ─── Get hackathon by ID
router.get("/:hackathonId", getHackathonById);

// ─── Get hackathon statistics
router.get("/:hackathonId/stats", getHackathonStats);

// ─── Update hackathon (super_admin only)
router.patch("/:hackathonId", requireSuperAdmin(), updateHackathon);

// ─── Update hackathon status (super_admin only)
router.patch("/:hackathonId/status", requireSuperAdmin(), updateHackathonStatus);

// ─── Delete hackathon (super_admin only)
router.delete("/:hackathonId", requireSuperAdmin(), deleteHackathon);

// ─── Update team submission/scoring
router.patch("/:hackathonId/teams/:teamId", updateTeam);

export default router;
