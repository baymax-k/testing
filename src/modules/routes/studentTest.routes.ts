// ─── Student Test Routes ────────────────────────────────────────────────────────

import { Router, type Router as RouterType } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  listTestsHandler,
  getTestHandler,
  submitTestHandler,
  getTestAttemptHandler,
} from "../controllers/studentTest.controller.js";

const router: RouterType = Router();

/**
 * GET /api/v1/student/tests
 * List all tests assigned to the student
 * Query params: limit, offset, difficulty, tags, status
 */
router.get("/", requireAuth, requireRole("student"), listTestsHandler);

/**
 * GET /api/v1/student/tests/:id
 * Get detailed information about a specific test
 */
router.get("/:id", requireAuth, requireRole("student"), getTestHandler);

/**
 * POST /api/v1/student/tests/:id/submit
 * Submit test attempt with answers
 * Body: { answers: [{ questionId, selectedAnswer }, ...] }
 */
router.post(
  "/:id/submit",
  requireAuth,
  requireRole("student"),
  submitTestHandler
);

/**
 * GET /api/v1/student/tests/:id/attempts/:attemptNumber (optional)
 * Get details of a previous test attempt
 */
router.get(
  "/:id/attempts/:attemptNumber",
  requireAuth,
  requireRole("student"),
  getTestAttemptHandler
);

export default router;
