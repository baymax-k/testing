// ─── Problem Controller ─────────────────────────────────────────────────────────

import type { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";

/**
 * GET /api/v1/problems
 * List all problems (summaries only) with pagination — fetches from database
 */
export async function listProblems(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const difficulty = (req.query.difficulty as string | undefined)?.toLowerCase();
    const tag = (req.query.tag as string | undefined)?.toLowerCase();
    const search = (req.query.search as string | undefined)?.toLowerCase();

    const where: any = { type: "dsa" }; // Fetch DSA problems

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (tag) {
      where.tags = {
        some: {
          name: {
            equals: tag,
            mode: "insensitive",
          },
        },
      };
    }

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [problems, total] = await Promise.all([
      prisma.question.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          difficulty: true,
          tags: {
            select: { name: true },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.question.count({ where }),
    ]);

    const formattedProblems = problems.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug ?? "",
      difficulty: p.difficulty,
      tags: p.tags.map((t) => t.name),
    }));

    res.json({
      problems: formattedProblems,
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
 * Get a single problem by slug (with sample test cases, no hidden) — fetches from database
 */
export async function getProblem(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;

    const problem = await prisma.question.findFirst({
      where: {
        slug,
        type: "dsa",
      },
      include: {
        tags: {
          select: { name: true },
        },
      },
    });

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Construct response, excluding hidden test cases and correct answer
    const { hiddenTestCases, correctAnswer, ...publicProblem } = problem;

    const response = {
      ...publicProblem,
      tags: problem.tags.map((t) => t.name),
    };

    res.json({ problem: response });
  } catch (error) {
    console.error("[getProblem]", error);
    res.status(500).json({ error: "Failed to fetch problem" });
  }
}
