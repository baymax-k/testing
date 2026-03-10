// ─── Submission Routes ──────────────────────────────────────────────────────────

import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { submissionLimiter } from "../../config/rateLimiter.js";
import {
  runCodeHandler,
  submitCodeHandler,
  listSubmissionsHandler,
  getSubmissionHandler,
  judge0HealthHandler,
} from "../controllers/submission.controller.js";

const router: RouterType = Router();

// POST /api/v1/submissions/run — Run code with custom stdin (playground)
router.post("/run", requireAuth, submissionLimiter, runCodeHandler);

// POST /api/v1/submissions — Submit code against problem test cases
router.post("/", requireAuth, submissionLimiter, submitCodeHandler);

// GET /api/v1/submissions — Get user's submission history
router.get("/", requireAuth, listSubmissionsHandler);

// GET /api/v1/submissions/:id — Get a single submission detail
router.get("/:id", requireAuth, getSubmissionHandler);

export default router;
