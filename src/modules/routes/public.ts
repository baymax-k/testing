// ─── Public Tests Routes ──────────────────────────────────────────────────────

import { Router } from "express";
import {
  getPublicTests,
  getPublicTestById,
  getAvailableDifficulties,
  getAvailableTags,
  getPublicTestsStats,
} from "../controllers/publicTests.controller.js";

const router: Router = Router();

// ─── Get all public tests with filtering and pagination
router.get("/", getPublicTests);

// ─── Get test statistics and aggregates
router.get("/stats", getPublicTestsStats);

// ─── Get available difficulty levels
router.get("/filters/difficulties", getAvailableDifficulties);

// ─── Get available tags
router.get("/filters/tags", getAvailableTags);

// ─── Get specific public test with all questions
router.get("/:testId", getPublicTestById);

export default router;
