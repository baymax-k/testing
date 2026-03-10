// ─── Practice Routes ──────────────────────────────────────────────────────────
// Student practice mode: browse and solve individual problems (MCQ + DSA).
// Like LeetCode's problem solving experience.

import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../../../middleware/auth.js";
import {
  listPracticeProblems,
  getPracticeProblem,
  submitMcqPractice,
} from '../../controllers/practice.controller.js';

const router: RouterType = Router();

// GET /api/v1/student/practice — List problems with filters (difficulty, tag, type)
router.get("/", requireAuth, listPracticeProblems);

// GET /api/v1/student/practice/:id — Get problem details
router.get("/:id", requireAuth, getPracticeProblem);

// POST /api/v1/student/practice/mcq — Submit MCQ answer (instant feedback)
router.post("/mcq", requireAuth, submitMcqPractice);

export default router;