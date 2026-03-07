// ─── Problem Controller ─────────────────────────────────────────────────────────

import type { Request, Response } from "express";
import { getProblems, getProblemBySlug } from "../../data/problems/index.js";

/**
 * GET /api/v1/problems
 * List all problems (summaries only)
 */
export async function listProblems(_req: Request, res: Response): Promise<void> {
  const problems = getProblems();
  res.json({ problems });
}

/**
 * GET /api/v1/problems/:slug
 * Get a single problem by slug (with sample test cases, no hidden)
 */
export async function getProblem(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug as string;

  const problem = getProblemBySlug(slug);
  if (!problem) {
    res.status(404).json({ error: "Problem not found" });
    return;
  }

  res.json({ problem });
}
