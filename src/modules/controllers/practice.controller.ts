// ─── Practice Controller ──────────────────────────────────────────────────────
// Handles individual problem solving (MCQ + DSA) in practice mode.
// Like LeetCode's problem pages — no contest context.

import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";

// ─── MCQ Submission Schema ─────────────────────────────────────────────────────
const mcqSubmissionSchema = z.object({
  questionId: z.string(),
  selectedOption: z.number().int().min(0).max(3), // 0-3 for A/B/C/D
});

// ─── List Practice Problems ───────────────────────────────────────────────────
export async function listPracticeProblems(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const difficulty = req.query.difficulty as string;
    const tag = req.query.tag as string;
    const type = req.query.type as "mcq" | "dsa"; // Optional filter

    const offset = (page - 1) * limit;

    const where: any = {};
    if (difficulty) where.difficulty = difficulty;
    if (type) where.type = type;
    if (tag) {
      where.tags = { some: { name: tag } };
    }

    const [problems, total] = await Promise.all([
      prisma.question.findMany({
        where,
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
      prisma.question.count({ where }),
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
    console.error("[listPracticeProblems]", error);
    res.status(500).json({ error: "Failed to fetch problems" });
  }
}

// ─── Get Practice Problem ─────────────────────────────────────────────────────
export async function getPracticeProblem(req: Request, res: Response): Promise<void> {
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

    // Hide hidden test cases and correct answer for MCQ
    const { hiddenTestCases, correctAnswer, ...publicProblem } = problem;
    const problemWithTags = {
      ...publicProblem,
      tags: publicProblem.tags.map(t => t.name),
    };

    res.json({ problem: problemWithTags });
  } catch (error) {
    console.error("[getPracticeProblem]", error);
    res.status(500).json({ error: "Failed to fetch problem" });
  }
}

// ─── Submit MCQ Answer (Practice) ─────────────────────────────────────────────
export async function submitMcqPractice(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;

  try {
    const { questionId, selectedOption } = mcqSubmissionSchema.parse(req.body);

    // Get the question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { correctAnswer: true, type: true },
    });

    if (!question || question.type !== "mcq") {
      res.status(404).json({ error: "MCQ question not found" });
      return;
    }

    const isCorrect = selectedOption === question.correctAnswer;
    const points = isCorrect ? 10 : 0; // Simple scoring

    res.json({
      isCorrect,
      correctAnswer: question.correctAnswer, // Show correct answer
      points,
      explanation: isCorrect ? "Correct!" : "Incorrect.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[submitMcqPractice]", error);
    res.status(500).json({ error: "Failed to submit MCQ" });
  }
}