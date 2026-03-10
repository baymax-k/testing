import type { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";

// Zod schemas for validation
const joinContestSchema = z.object({
  contestId: z.string(),
});

const submitContestDsaSchema = z.object({
  contestId: z.string(),
  problemId: z.string(),
  code: z.string().min(1),
  language: z.string().min(1),
});

// List contests with pagination and filters
export const listContests = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status = "all" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const now = new Date();
    let whereClause: any = {};
    if (status === "upcoming") {
      whereClause.startTime = { gt: now };
    } else if (status === "active") {
      whereClause.startTime = { lte: now };
      whereClause.endTime = { gt: now };
    } else if (status === "past") {
      whereClause.endTime = { lte: now };
    }

    const contests = await prisma.contest.findMany({
      where: whereClause,
      include: {
        questions: {
          include: {
            question: {
              select: {
                id: true,
                title: true,
                type: true,
                difficulty: true,
                tags: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
        _count: {
          select: { participations: true },
        },
      },
      skip: offset,
      take: limitNum,
      orderBy: { startTime: "desc" },
    });

    const total = await prisma.contest.count({ where: whereClause });

    res.json({
      contests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error listing contests:", error);
    res.status(500).json({ error: "Failed to list contests" });
  }
};

// Get contest details
export const getContest = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req as AuthRequest).user?.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            question: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                difficulty: true,
                tags: true,
                options: true,
                sampleTestCases: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    // Check if contest is active
    const now = new Date();
    if (contest.startTime && now < contest.startTime) {
      return res.status(403).json({ error: "Contest has not started yet" });
    }
    if (contest.endTime && now > contest.endTime) {
      return res.status(403).json({ error: "Contest has ended" });
    }

    // Check if user has joined
    const participation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId: userId!,
          contestId: id,
        },
      },
    });

    if (!participation) {
      return res.status(403).json({ error: "You have not joined this contest" });
    }

    // Calculate time left
    const timeLeft = contest.endTime
      ? Math.max(0, contest.endTime.getTime() - now.getTime())
      : null;

    res.json({
      ...contest,
      timeLeft,
      startedAt: participation.startedAt,
    });
  } catch (error) {
    console.error("Error getting contest:", error);
    res.status(500).json({ error: "Failed to get contest" });
  }
};

// Join contest
export const joinContest = async (req: Request, res: Response) => {
  try {
    const { contestId } = joinContestSchema.parse(req.body);
    const userId = (req as AuthRequest).user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    const now = new Date();
    if (contest.startTime && now < contest.startTime) {
      return res.status(403).json({ error: "Contest has not started yet" });
    }
    if (contest.endTime && now > contest.endTime) {
      return res.status(403).json({ error: "Contest has ended" });
    }

    // Check if already joined
    const existingParticipation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId,
        },
      },
    });

    if (existingParticipation) {
      return res.status(400).json({ error: "Already joined this contest" });
    }

    // Create participation
    const participation = await prisma.contestParticipation.create({
      data: {
        contestId,
        userId,
        score: 0,
      },
    });

    res.json({
      message: "Successfully joined contest",
      participation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error("Error joining contest:", error);
    res.status(500).json({ error: "Failed to join contest" });
  }
};

// Submit DSA in contest context
export const submitContestDsa = async (req: Request, res: Response) => {
  try {
    const { contestId, problemId, code, language } = submitContestDsaSchema.parse(req.body);
    const userId = (req as AuthRequest).user!.userId;

    // Verify contest participation
    const participation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId,
        },
      },
    });

    if (!participation) {
      return res.status(403).json({ error: "You have not joined this contest" });
    }

    // Check if contest is still active
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest || (contest.endTime && new Date() > contest.endTime)) {
      return res.status(403).json({ error: "Contest has ended" });
    }

    // Check if problem is in contest
    const contestQuestion = await prisma.contestQuestion.findFirst({
      where: {
        contestId,
        questionId: problemId,
      },
    });

    if (!contestQuestion) {
      return res.status(404).json({ error: "Problem not found in this contest" });
    }

    // Create submission linked to contest participation
    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        sourceCode: code,
        language,
        status: "processing",
        contestParticipationId: participation.id,
      },
    });

    // TODO: Send to Judge0 service

    res.json({
      message: "Submission received",
      submission: {
        id: submission.id,
        status: submission.status,
        submittedAt: submission.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error("Error submitting contest DSA:", error);
    res.status(500).json({ error: "Failed to submit solution" });
  }
};

// Get contest leaderboard
export const getContestLeaderboard = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const participations = await prisma.contestParticipation.findMany({
      where: { contestId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { score: "desc" },
    });

    res.json({
      leaderboard: participations.map((p, index) => ({
        rank: index + 1,
        user: p.user,
        score: p.score,
        startedAt: p.startedAt,
      })),
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
};
