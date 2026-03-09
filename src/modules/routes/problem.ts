// ─── Problem Routes ─────────────────────────────────────────────────────────────

import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { listProblems, getProblem } from "../controllers/problem.controller.js";

const router: RouterType = Router();

// GET /api/v1/problems — List all problems
router.get("/", requireAuth, listProblems);

// GET /api/v1/problems/:id — Get problem details  
router.get("/:id", requireAuth, getProblem);

export default router;
