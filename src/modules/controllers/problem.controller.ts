// ─── Problem Controller ─────────────────────────────────────────────────────────

import type { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";

/**
 * GET /api/v1/problems
 * List all problems (summaries only) with pagination
 */
export async function listProblems(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [problems, total] = await Promise.all([
      prisma.question.findMany({
        select: {
          id: true,
          title: true,
          difficulty: true,
          tags: { select: { name: true } },
          company: true,
          type: true,
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.question.count(),
    ]);

    res.json({
      problems: problems.map(p => ({
        ...p,
        tags: p.tags.map(t => t.name),
      })),
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
 * GET /api/v1/problems/:id
 * Get a single problem by ID (with sample test cases, no hidden)
 */
export async function getProblem(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;

    const problem = await prisma.question.findUnique({
      where: { id },
      include: { tags: { select: { name: true } } },
    });

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Hide hidden test cases
    const { hiddenTestCases, ...publicProblem } = problem;
    const problemWithTags = {
      ...publicProblem,
      tags: publicProblem.tags.map(t => t.name),
    };

    res.json({ problem: problemWithTags });
  } catch (error) {
    console.error("[getProblem]", error);
    res.status(500).json({ error: "Failed to fetch problem" });
  }
}
