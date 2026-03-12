// ─── Problem Controller ─────────────────────────────────────────────────────────

import type { Request, Response } from "express";
import { getProblems, getProblemBySlug } from "../../data/problems/index.js";

/**
 * GET /api/v1/problems
 * List all problems (summaries only) with pagination
 */
export async function listProblems(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const difficulty = (req.query.difficulty as string | undefined)?.toLowerCase();
    const tag = (req.query.tag as string | undefined)?.toLowerCase();
    const search = (req.query.search as string | undefined)?.toLowerCase();

    let problems = getProblems();

    if (difficulty) {
      problems = problems.filter((p) => p.difficulty.toLowerCase() === difficulty);
    }

    if (tag) {
      problems = problems.filter((p) => p.tags.some((value) => value.toLowerCase() === tag));
    }

    if (search) {
      problems = problems.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.slug.toLowerCase().includes(search) ||
          p.id.toLowerCase().includes(search)
      );
    }

    const total = problems.length;
    const paginatedProblems = problems.slice(offset, offset + limit);

    res.json({
      problems: paginatedProblems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[listProblems]", error);
    res.status(500).json({ error: "Failed to fetch problems" });
  }
}

/**
 * GET /api/v1/problems/:slug
 * Get a single problem by slug (with sample test cases, no hidden)
 */
export async function getProblem(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const problem = getProblemBySlug(slug);

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    res.json({ problem });
  } catch (error) {
    console.error("[getProblem]", error);
    res.status(500).json({ error: "Failed to fetch problem" });
  }
}
