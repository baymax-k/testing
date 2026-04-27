// ─── Public Tests Controller ──────────────────────────────────────────────────

import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";

// ─── Validators ───────────────────────────────────────────────────────────────

const getPublicTestsQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tag: z.string().optional(),
  search: z.string().max(255).optional(),
  sortBy: z.enum(["createdAt", "title", "durationMinutes"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

function safeTest(test: any) {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    instructions: test.instructions,
    status: test.status,
    durationMinutes: test.durationMinutes,
    difficulty: test.difficulty || "medium",
    tags: test.tags || [],
    totalMarks: test.totalMarks,
    passingMarks: test.passingMarks,
    questionCount: test.questions?.length || 0,
    scheduledStartTime: test.scheduledStartTime,
    scheduledEndTime: test.scheduledEndTime,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
  };
}

function safeTestWithQuestions(test: any) {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    instructions: test.instructions,
    status: test.status,
    durationMinutes: test.durationMinutes,
    difficulty: test.difficulty || "medium",
    tags: test.tags || [],
    totalMarks: test.totalMarks,
    passingMarks: test.passingMarks,
    scheduledStartTime: test.scheduledStartTime,
    scheduledEndTime: test.scheduledEndTime,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    questionCount: test.questions?.length || 0,
    questions: (test.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      marks: q.marks,
      difficulty: q.difficulty,
      orderIndex: q.orderIndex,
      ...(q.type === "mcq" && { options: q.options }),
    })),
  };
}

// ─── Get All Publicly Available Tests ──────────────────────────────────────────

/**
 * GET /api/public/tests
 * Get publicly available tests with filtering, sorting, and pagination
 */
export async function getPublicTests(req: Request, res: Response): Promise<void> {
  try {
    const queryResult = getPublicTestsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
      return;
    }

    const { page, limit, difficulty, tag, search, sortBy, sortOrder } = queryResult.data;
    const pageNum = Math.max(1, page || 1);
    const limitNum = Math.max(1, Math.min(100, limit || 20));
    const skip = (pageNum - 1) * limitNum;

    const whereFilter: any = {
      isPublic: true,
      status: { in: ["scheduled", "active"] },
    };

    const now = new Date();
    whereFilter.OR = [
      { scheduledStartTime: null },
      {
        AND: [
          { scheduledStartTime: { lte: now } },
          {
            OR: [
              { scheduledEndTime: null },
              { scheduledEndTime: { gte: now } },
            ],
          },
        ],
      },
    ];

    if (difficulty) whereFilter.difficulty = difficulty;
    if (tag) whereFilter.tags = { has: tag };
    if (search) {
      whereFilter.OR = [
        ...(whereFilter.OR || []),
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const orderBy: any = {};
    switch (sortBy) {
      case "title":
        orderBy.title = sortOrder === "asc" ? "asc" : "desc";
        break;
      case "durationMinutes":
        orderBy.durationMinutes = sortOrder === "asc" ? "asc" : "desc";
        break;
      default:
        orderBy.createdAt = sortOrder === "asc" ? "asc" : "desc";
    }

    const [tests, totalCount] = await Promise.all([
      prisma.test.findMany({
        where: whereFilter as any,
        select: {
          id: true,
          title: true,
          description: true,
          instructions: true,
          status: true,
          durationMinutes: true,
          totalMarks: true,
          passingMarks: true,
          difficulty: true,
          tags: true,
          scheduledStartTime: true,
          scheduledEndTime: true,
          createdAt: true,
          updatedAt: true,
          questions: { select: { id: true } },
        } as any,
        orderBy,
        skip,
        take: limitNum,
      }) as any,
      prisma.test.count({ where: whereFilter }),
    ]);

    res.status(200).json({
      success: true,
      count: tests.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
      },
      tests: tests.map((t: any) => safeTest(t)),
    });
  } catch (err: any) {
    console.error("[public/tests/list] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch tests" });
  }
}

// ─── Get Public Test by ID ────────────────────────────────────────────────────

/**
 * GET /api/public/tests/:testId
 * Get a specific public test with questions
 */
export async function getPublicTestById(req: Request, res: Response): Promise<void> {
  try {
    const { testId } = req.params;

    const test = await (prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: {
          select: {
            id: true,
            type: true,
            content: true,
            marks: true,
            difficulty: true,
            orderIndex: true,
            options: true,
          },
          orderBy: { orderIndex: "asc" },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }) as any);

    if (!test) {
      res.status(404).json({ error: "Test not found" });
      return;
    }

    if (!test.isPublic) {
      res.status(403).json({ error: "This test is not publicly available" });
      return;
    }

    if (!["scheduled", "active"].includes(test.status)) {
      res.status(403).json({ error: "This test is not currently available" });
      return;
    }

    const now = new Date();
    if (test.scheduledStartTime && test.scheduledStartTime > now) {
      res.status(403).json({
        error: "Test has not started yet",
        availableAt: test.scheduledStartTime,
      });
      return;
    }

    if (test.scheduledEndTime && test.scheduledEndTime < now) {
      res.status(403).json({
        error: "Test has ended",
        endedAt: test.scheduledEndTime,
      });
      return;
    }

    res.status(200).json({
      success: true,
      test: safeTestWithQuestions(test),
    });
  } catch (err: any) {
    console.error("[public/tests/get] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch test" });
  }
}

// ─── Get Available Difficulties ────────────────────────────────────────────────

/**
 * GET /api/public/tests/filters/difficulties
 * Get difficulty levels across public tests
 */
export async function getAvailableDifficulties(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();

    const tests = await prisma.test.findMany({
      where: {
        isPublic: true,
        status: { in: ["scheduled", "active"] },
        OR: [
          { scheduledStartTime: null },
          {
            AND: [
              { scheduledStartTime: { lte: now } },
              {
                OR: [
                  { scheduledEndTime: null },
                  { scheduledEndTime: { gte: now } },
                ],
              },
            ],
          },
        ],
      } as any,
      select: { difficulty: true } as any,
    }) as any;

    const difficulties: Record<string, number> = {};
    tests.forEach((test: any) => {
      const level = test.difficulty || "unknown";
      difficulties[level] = (difficulties[level] || 0) + 1;
    });

    res.status(200).json({ success: true, difficulties });
  } catch (err: any) {
    console.error("[public/tests/difficulties] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch difficulties" });
  }
}

// ─── Get Available Tags ────────────────────────────────────────────────────────

/**
 * GET /api/public/tests/filters/tags
 * Get tags across public tests sorted by popularity
 */
export async function getAvailableTags(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();

    const tests = await prisma.test.findMany({
      where: {
        isPublic: true,
        status: { in: ["scheduled", "active"] },
        OR: [
          { scheduledStartTime: null },
          {
            AND: [
              { scheduledStartTime: { lte: now } },
              {
                OR: [
                  { scheduledEndTime: null },
                  { scheduledEndTime: { gte: now } },
                ],
              },
            ],
          },
        ],
      } as any,
      select: { tags: true } as any,
    }) as any;

    const tagCounts: Record<string, number> = {};
    tests.forEach((test: any) => {
      (test.tags || []).forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.status(200).json({ success: true, tags });
  } catch (err: any) {
    console.error("[public/tests/tags] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch tags" });
  }
}

// ─── Get Test Statistics ──────────────────────────────────────────────────────

/**
 * GET /api/public/tests/stats
 * Get aggregate statistics about public tests
 */
export async function getPublicTestsStats(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();

    const tests = await prisma.test.findMany({
      where: {
        isPublic: true,
        status: { in: ["scheduled", "active"] },
        OR: [
          { scheduledStartTime: null },
          {
            AND: [
              { scheduledStartTime: { lte: now } },
              {
                OR: [
                  { scheduledEndTime: null },
                  { scheduledEndTime: { gte: now } },
                ],
              },
            ],
          },
        ],
      } as any,
      select: {
        id: true,
        durationMinutes: true,
        totalMarks: true,
        difficulty: true,
        questions: { select: { id: true } },
      } as any,
    }) as any;

    const totalQuestions = tests.reduce((sum: number, t: any) => sum + (t.questions?.length || 0), 0);
    const avgDuration =
      tests.length > 0
        ? (tests.reduce((sum: number, t: any) => sum + t.durationMinutes, 0) / tests.length).toFixed(0)
        : "0";
    const avgMarks =
      tests.length > 0
        ? (tests.reduce((sum: number, t: any) => sum + t.totalMarks, 0) / tests.length).toFixed(0)
        : "0";

    const difficultyBreakdown: Record<string, number> = {};
    tests.forEach((test: any) => {
      const level = test.difficulty || "unknown";
      difficultyBreakdown[level] = (difficultyBreakdown[level] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      stats: {
        totalTests: tests.length,
        totalQuestions,
        averageDurationMinutes: avgDuration,
        averageMarks: avgMarks,
        difficultyBreakdown,
      },
    });
  } catch (err: any) {
    console.error("[public/tests/stats] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch test statistics" });
  }
}
