// ─── Practice Routes ──────────────────────────────────────────────────────────
// Student practice mode: browse and solve individual problems (MCQ + DSA).
// Like LeetCode's problem solving experience.

import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../../../middleware/auth.js";
import {
  listPracticeProblems,
  getPracticeProblem,
  listMcqTopics,
  createMcqPracticeSession,
  submitMcqPractice,
  submitMcqPracticeSession,
  getMcqPracticeHistory,
  getMcqPracticeHistoryDetail,
  getMcqStats,
  getMcqSessionById,
} from '../../controllers/practice.controller.js';
import { createRandomPractice } from '../../controllers/practice.controller.js';

import { postPracticeActivity, getPracticeActivityHandler } from '../../controllers/practiceActivity.controller.js';

const router: RouterType = Router();

// GET /api/v1/student/practice — List problems with filters (difficulty, tag, type)
router.get("/", requireAuth, listPracticeProblems);

// GET /api/v1/student/practice/mcq/topics — List available MCQ practice topics
router.get("/mcq/topics", requireAuth, listMcqTopics);

// GET /api/v1/student/practice/mcq/stats — Get MCQ practice stats (accuracy, topics)
router.get("/mcq/stats", requireAuth, getMcqStats);

// POST /api/v1/student/practice/mcq/session — Create MCQ session by selected topics
router.post("/mcq/session", requireAuth, createMcqPracticeSession);

// POST /api/v1/student/practice/random — Generate a random MCQ set (non-persistent)
router.post("/random", requireAuth, createRandomPractice);

// GET /api/v1/student/practice/mcq/session/:sessionId — Get/resume session
router.get("/mcq/session/:sessionId", requireAuth, getMcqSessionById);

// POST /api/v1/student/practice/mcq/session/submit — Submit full MCQ session answers
router.post("/mcq/session/submit", requireAuth, submitMcqPracticeSession);

// GET /api/v1/student/practice/mcq/history — Get MCQ practice session history
router.get("/mcq/history", requireAuth, getMcqPracticeHistory);

// GET /api/v1/student/practice/mcq/history/:sessionId — Get MCQ practice session detail
router.get("/mcq/history/:sessionId", requireAuth, getMcqPracticeHistoryDetail);

// POST /api/v1/student/practice/mcq — Submit MCQ answer (instant feedback)
router.post("/mcq", requireAuth, submitMcqPractice);

// POST /api/v1/student/practice/activity — Record a practice activity (visit/solve/mcq/dsa)
router.post("/activity", requireAuth, postPracticeActivity);

// GET /api/v1/student/practice/activity — Get today's activity or range with `?days=`
router.get("/activity", requireAuth, getPracticeActivityHandler);

// GET /api/v1/student/practice/:id — Get problem details
router.get("/:id", requireAuth, getPracticeProblem);

export default router;