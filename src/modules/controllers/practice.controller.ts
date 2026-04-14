// ─── Practice Controller ──────────────────────────────────────────────────────
// Handles individual problem solving (MCQ + DSA) in practice mode.
// Like LeetCode's problem pages — no contest context.

import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import type { AuthRequest } from "../../middleware/auth.js";
import { generateRandomMcqSet } from "../services/practiceRandom.service.js";

// ─── MCQ Submission Schema ─────────────────────────────────────────────────────
const mcqSubmissionSchema = z.object({
  questionId: z.string(),
  selectedOption: z.number().int().min(0),
});

const mcqSessionSchema = z.object({
  topics: z.array(z.string().min(1)).min(1, "At least one topic is required"),
  // No manual `count` anymore — return all matching topic questions
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const randomRequestSchema = z.object({
  count: z.coerce.number().int().min(1).max(25).optional().default(10),
  topics: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  seed: z.string().optional(),
  excludeIds: z.array(z.string()).optional(),
});

const mcqBatchSubmitSchema = z.object({
  sessionId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOption: z.number().int().min(0),
    })
  ).min(1),
});

const mcqHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ─── List MCQ Topics ───────────────────────────────────────────────────────────
export async function listMcqTopics(req: Request, res: Response): Promise<void> {
  try {
    const tags = await prisma.tag.findMany({
      where: {
        questions: {
          some: {
            type: "mcq",
          },
        },
      },
      select: {
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json({
      topics: tags.map((tag) => tag.name),
    });
  } catch (error) {
    console.error("[listMcqTopics]", error);
    res.status(500).json({ error: "Failed to fetch MCQ topics" });
  }
}

// ─── Create MCQ Practice Session By Topics ───────────────────────────────────
export async function createMcqPracticeSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { topics, difficulty } = mcqSessionSchema.parse(req.body);
    const normalizedTopics = Array.from(
      new Set(topics.map((topic) => topic.trim().toLowerCase()).filter(Boolean))
    );

    const questions = await prisma.question.findMany({
      where: {
        type: "mcq",
        ...(difficulty ? { difficulty } : {}),
        tags: {
          some: {
            name: {
              in: normalizedTopics,
            },
          },
        },
      },
      include: {
        tags: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!questions.length) {
      res.status(404).json({
        error: "No MCQ questions found for selected topics",
      });
      return;
    }

    const selected = questions; // return all matching questions for the topics
    const questionIds = selected.map((question) => question.id);

    const session = await prisma.mCQPracticeSession.create({
      data: {
        userId,
        topics: normalizedTopics,
        difficulty: difficulty ?? null,
        requestedCount: selected.length,
        totalQuestions: selected.length,
        questionIds,
      },
    });

    res.json({
      session: {
        id: session.id,
        topics: normalizedTopics,
        requestedCount: session.requestedCount,
        returnedCount: selected.length,
        status: session.status,
        createdAt: session.createdAt,
      },
      questions: selected.map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        options: Array.isArray(question.options) ? question.options : [],
        tags: question.tags.map((tag) => tag.name),
        type: question.type,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[createMcqPracticeSession]", error);
    res.status(500).json({ error: "Failed to create MCQ practice session" });
  }
}

// POST /api/v1/student/practice/random — Generate non-persistent random MCQ set
export async function createRandomPractice(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const body = randomRequestSchema.parse(req.body);

    const result = await generateRandomMcqSet(userId, {
      count: body.count,
      topics: body.topics,
      difficulty: body.difficulty,
      seed: body.seed,
      excludeIds: body.excludeIds,
    });

    res.json({
      seed: result.seed,
      poolSize: result.poolSize,
      reset: result.reset,
      questions: result.questions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[createRandomPractice]", error);
    res.status(500).json({ error: "Failed to generate random MCQ set" });
  }
}

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
  try {
    const { questionId, selectedOption } = mcqSubmissionSchema.parse(req.body);

    // Get the question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { correctAnswer: true, type: true, options: true },
    });

    if (!question || question.type !== "mcq") {
      res.status(404).json({ error: "MCQ question not found" });
      return;
    }

    const options = Array.isArray(question.options) ? question.options : [];
    if (selectedOption >= options.length) {
      res.status(400).json({
        error: "Validation failed",
        details: [{ message: "selectedOption is out of range for this MCQ" }],
      });
      return;
    }

    const correctAnswer = Number(question.correctAnswer);
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      res.status(400).json({
        error: "MCQ question has invalid correctAnswer configuration",
      });
      return;
    }

    const isCorrect = selectedOption === correctAnswer;
    const points = isCorrect ? 10 : 0; // Simple scoring

    res.json({
      isCorrect,
      correctAnswer, // Show correct answer index
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

// ─── Submit Full MCQ Session (Batch) ─────────────────────────────────────────
export async function submitMcqPracticeSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { sessionId, answers } = mcqBatchSubmitSchema.parse(req.body);

    const session = await prisma.mCQPracticeSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      res.status(404).json({ error: "MCQ session not found" });
      return;
    }

    if (session.status === "submitted") {
      res.status(400).json({ error: "MCQ session already submitted" });
      return;
    }

    const sessionQuestionIdsRaw = session.questionIds as unknown;
    const sessionQuestionIds = Array.isArray(sessionQuestionIdsRaw)
      ? sessionQuestionIdsRaw.filter((value): value is string => typeof value === "string")
      : [];

    if (!sessionQuestionIds.length) {
      res.status(400).json({ error: "MCQ session has no question set" });
      return;
    }

    const answeredQuestionIds = answers.map((answer) => answer.questionId);
    const uniqueAnsweredQuestionIds = new Set(answeredQuestionIds);

    if (uniqueAnsweredQuestionIds.size !== answers.length) {
      res.status(400).json({ error: "Duplicate questionId in answers payload" });
      return;
    }

    if (answers.length !== sessionQuestionIds.length) {
      res.status(400).json({
        error: `All questions must be answered. Expected ${sessionQuestionIds.length}, received ${answers.length}`,
      });
      return;
    }

    const sessionIdSet = new Set(sessionQuestionIds);
    const hasInvalidQuestion = answers.some((answer) => !sessionIdSet.has(answer.questionId));
    if (hasInvalidQuestion) {
      res.status(400).json({ error: "Answers contain questionId not present in this session" });
      return;
    }

    const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.selectedOption]));

    const questionRows = await prisma.question.findMany({
      where: {
        id: {
          in: sessionQuestionIds,
        },
        type: "mcq",
      },
      select: {
        id: true,
        title: true,
        options: true,
        correctAnswer: true,
      },
    });

    if (questionRows.length !== sessionQuestionIds.length) {
      res.status(400).json({ error: "Some session questions are missing or invalid" });
      return;
    }

    const questionById = new Map(questionRows.map((question) => [question.id, question]));
    const reviewRows: Array<{
      questionId: string;
      title: string;
      selectedOption: number;
      selectedOptionText: string;
      correctAnswer: number;
      correctOptionText: string;
      isCorrect: boolean;
      points: number;
    }> = [];

    for (const questionId of sessionQuestionIds) {
      const question = questionById.get(questionId)!;
      const selectedOption = answerMap.get(questionId)!;
      const options = Array.isArray(question.options)
        ? question.options.filter((option): option is string => typeof option === "string")
        : [];

      if (selectedOption < 0 || selectedOption >= options.length) {
        res.status(400).json({ error: `selectedOption out of range for questionId: ${questionId}` });
        return;
      }

      const correctAnswer = Number(question.correctAnswer);
      if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
        res.status(400).json({ error: `MCQ correct answer missing for questionId: ${questionId}` });
        return;
      }

      const isCorrect = selectedOption === correctAnswer;
      reviewRows.push({
        questionId,
        title: question.title ?? "Untitled question",
        selectedOption,
        selectedOptionText: options[selectedOption] ?? `Option ${selectedOption}`,
        correctAnswer,
        correctOptionText: options[correctAnswer] ?? `Option ${correctAnswer}`,
        isCorrect,
        points: isCorrect ? 10 : 0,
      });
    }

    const score = reviewRows.reduce((sum, row) => sum + row.points, 0);
    const correctCount = reviewRows.filter((row) => row.isCorrect).length;

    const submittedSession = await prisma.mCQPracticeSession.update({
      where: { id: sessionId },
      data: {
        status: "submitted",
        score,
        correctCount,
        submittedAt: new Date(),
      },
    });

    res.json({
      session: {
        id: submittedSession.id,
        status: submittedSession.status,
        topics: submittedSession.topics,
        totalQuestions: submittedSession.totalQuestions,
        correctCount: submittedSession.correctCount,
        score: submittedSession.score,
        submittedAt: submittedSession.submittedAt,
      },
      review: reviewRows,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[submitMcqPracticeSession]", error);
    res.status(500).json({ error: "Failed to submit MCQ session" });
  }
}

// ─── MCQ Practice History ─────────────────────────────────────────────────────
export async function getMcqPracticeHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { page, limit } = mcqHistoryQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.mCQPracticeSession.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              answers: true,
            },
          },
        },
      }),
      prisma.mCQPracticeSession.count({ where: { userId } }),
    ]);

    res.json({
      history: sessions.map((session) => ({
        id: session.id,
        topics: session.topics,
        difficulty: session.difficulty,
        requestedCount: session.requestedCount,
        totalQuestions: session.totalQuestions,
        answeredCount: session._count.answers,
        status: session.status,
        correctCount: session.correctCount,
        score: session.score,
        submittedAt: session.submittedAt,
        createdAt: session.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[getMcqPracticeHistory]", error);
    res.status(500).json({ error: "Failed to fetch MCQ history" });
  }
}

export async function getMcqPracticeHistoryDetail(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const sessionId = req.params.sessionId as string;

    const session = await prisma.mCQPracticeSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        answers: {
          include: {
            question: {
              include: {
                tags: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: "MCQ session not found" });
      return;
    }

    res.json({
      session: {
        id: session.id,
        topics: session.topics,
        difficulty: session.difficulty,
        requestedCount: session.requestedCount,
        totalQuestions: session.totalQuestions,
        status: session.status,
        correctCount: session.correctCount,
        score: session.score,
        submittedAt: session.submittedAt,
        createdAt: session.createdAt,
      },
      review: session.answers.map((answer: any) => {
        const options = Array.isArray(answer.question.options)
          ? answer.question.options.filter((option: any): option is string => typeof option === "string")
          : [];

        return {
          questionId: answer.questionId,
          title: answer.question.title,
          difficulty: answer.question.difficulty,
          tags: answer.question.tags.map((tag: any) => tag.name),
          selectedOption: answer.selectedOption,
          selectedOptionText: options[answer.selectedOption] ?? `Option ${answer.selectedOption}`,
          correctAnswer: answer.correctAnswer,
          correctOptionText: options[answer.correctAnswer] ?? `Option ${answer.correctAnswer}`,
          isCorrect: answer.isCorrect,
          points: answer.points,
        };
      }),
    });
  } catch (error) {
    console.error("[getMcqPracticeHistoryDetail]", error);
    res.status(500).json({ error: "Failed to fetch MCQ history detail" });
  }
}

// ─── MCQ Practice Stats ───────────────────────────────────────────────────────
export async function getMcqStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;

    const sessions = await prisma.mCQPracticeSession.findMany({
      where: { userId, status: "submitted" },
      select: {
        id: true,
        topics: true,
        totalQuestions: true,
        correctCount: true,
        score: true,
        createdAt: true,
      },
    });

    const totalSessions = sessions.length;
    const totalQuestions = sessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
    const overallAccuracy = totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 10000) / 100
      : 0;

    // Topic-wise breakdown
    const topicMap = new Map<string, { total: number; correct: number }>();

    // TODO: Implement topic breakdown from session answers (stored as JSON)
    // const answers = await prisma.mcqPracticeAnswer.findMany({...});

    const topicBreakdown = Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        total: data.total,
        correct: data.correct,
        accuracy: Math.round((data.correct / data.total) * 10000) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      stats: {
        totalSessions,
        totalQuestions,
        totalCorrect,
        totalScore,
        overallAccuracy,
        topicBreakdown,
      },
    });
  } catch (error) {
    console.error("[getMcqStats]", error);
    res.status(500).json({ error: "Failed to fetch MCQ stats" });
  }
}

// ─── Get MCQ Session By ID (Resume) ───────────────────────────────────────────
export async function getMcqSessionById(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const sessionId = req.params.sessionId as string;

    const session = await prisma.mCQPracticeSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        answers: {
          select: {
            questionId: true,
            selectedOption: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: "MCQ session not found" });
      return;
    }

    const questionIds = Array.isArray(session.questionIds)
      ? (session.questionIds as string[])
      : [];

    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        options: true,
        tags: { select: { name: true } },
        type: true,
      },
    });

    // Preserve original question order
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionIds
      .map((id) => questionMap.get(id))
      .filter(Boolean)
      .map((q) => ({
        id: q!.id,
        title: q!.title,
        description: q!.description,
        difficulty: q!.difficulty,
        options: Array.isArray(q!.options) ? q!.options : [],
        tags: q!.tags.map((t) => t.name),
        type: q!.type,
      }));

    // Map already-answered questions from MCQSessionAnswer relation
    let answeredMap = new Map<string, number>();
    if (session.answers && Array.isArray(session.answers)) {
      answeredMap = new Map(
        session.answers.map((a) => [a.questionId, a.selectedOption])
      );
    }

    res.json({
      session: {
        id: session.id,
        topics: session.topics,
        difficulty: session.difficulty,
        requestedCount: session.requestedCount,
        totalQuestions: session.totalQuestions,
        status: session.status,
        createdAt: session.createdAt,
      },
      questions: orderedQuestions,
      answeredQuestions: Object.fromEntries(answeredMap),
    });
  } catch (error) {
    console.error("[getMcqSessionById]", error);
    res.status(500).json({ error: "Failed to fetch MCQ session" });
  }
}