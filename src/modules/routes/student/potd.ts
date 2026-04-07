// ─── POTD Routes ──────────────────────────────────────────────────────────────
// Student Problem of the Day endpoints.

import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../../../middleware/auth.js";
import {
  getTodaysPotd,
  solvePotd,
  getStreak,
  getPotdHistoryHandler,
} from "../../controllers/potd.controller.js";

const router: RouterType = Router();

// GET /api/v1/student/potd — Today's Problem of the Day
router.get("/", requireAuth, getTodaysPotd);

// POST /api/v1/student/potd/solve — Submit POTD answer
router.post("/solve", requireAuth, solvePotd);

// GET /api/v1/student/potd/streak — Get streak info
router.get("/streak", requireAuth, getStreak);

// GET /api/v1/student/potd/history — POTD history
router.get("/history", requireAuth, getPotdHistoryHandler);

export default router;
