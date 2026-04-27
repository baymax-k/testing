// ─── Problem of the Day Service ──────────────────────────────────────────────
// Business logic for daily challenges, solving, and streak tracking.

import { prisma } from "../../config/prisma.js";
import { executeTestCases } from "./judge0.service.js";

function parseCorrectAnswerIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

/**
 * Get today's daily challenge. If none exists, auto-select one from the
 * question pool (preferring questions not used in the last 30 days).
 */
export async function getTodaysChallenge(userId: string) {
  const today = getDateOnly(new Date());

  let challenge = await prisma.dailyChallenge.findUnique({
    where: { date: today },
    include: {
      question: {
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          difficulty: true,
          options: true,
          // DSA fields
          sampleTestCases: true,
          hiddenTestCases: true,
          timeLimit: true,
          memoryLimit: true,
          tags: { select: { name: true } },
        },
      },
    },
  });

  // Auto-select if no challenge scheduled for today
  if (!challenge) {
    challenge = await autoSelectChallenge(today);
  }

  if (!challenge) {
    return null;
  }

  // Check if user already solved today's challenge
  const solve = await prisma.dailyChallengeSolve.findUnique({
    where: {
      userId_dailyChallengeId: {
        userId,
        dailyChallengeId: challenge.id,
      },
    },
  });

  // Get streak info
  const streak = await getUserStreak(userId);

  return {
    challenge: {
      id: challenge.id,
      date: challenge.date,
      question: {
        ...challenge.question,
        tags: challenge.question.tags.map((t) => t.name),
        options: Array.isArray(challenge.question.options)
          ? challenge.question.options
          : [],
      },
    },
    solved: !!solve,
    solveResult: solve
      ? {
          isCorrect: solve.isCorrect,
          selectedOption: solve.selectedOption,
          solvedAt: solve.solvedAt,
        }
      : null,
    streak,
  };
}

/**
 * Solve today's POTD (MCQ only for now).
 */
export async function solveDailyChallenge(
  userId: string,
  dailyChallengeId: string,
  payload: { selectedOption?: number; languageId?: number; sourceCode?: string }
) {
  // Verify challenge exists
  const challenge = await prisma.dailyChallenge.findUnique({
    where: { id: dailyChallengeId },
    include: {
      question: {
        select: {
          id: true,
          type: true,
          correctAnswer: true,
          options: true,
          sampleTestCases: true,
          hiddenTestCases: true,
          timeLimit: true,
          memoryLimit: true,
        },
      },
    },
  });

  if (!challenge) {
    throw new NotFoundError("Daily challenge not found");
  }

  // Check if already solved
  const existing = await prisma.dailyChallengeSolve.findUnique({
    where: {
      userId_dailyChallengeId: { userId, dailyChallengeId },
    },
  });

  // MCQ flow
  if (challenge.question.type === "mcq") {
    if (existing) {
      throw new ValidationError("You have already solved today's challenge");
    }

    const options = Array.isArray(challenge.question.options)
      ? challenge.question.options
      : [];

    const selectedOption = typeof payload.selectedOption === "number" ? payload.selectedOption : -1;

    if (selectedOption < 0 || selectedOption >= options.length) {
      throw new ValidationError("Selected option out of range");
    }

    const correctAnswer = Number(challenge.question.correctAnswer);
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      throw new ValidationError("Challenge has invalid correct answer configuration");
    }

    const isCorrect = selectedOption === correctAnswer;

    await prisma.dailyChallengeSolve.create({
      data: {
        userId,
        dailyChallengeId,
        // @ts-ignore - selectedOption column exists in DB/migrations
        selectedOption,
        isCorrect,
      },
    });

    const streak = await updateStreak(userId, challenge.date);

    return {
      isCorrect,
      correctAnswer,
      selectedOption,
      streak,
    };
  }

  // DSA flow
  if (challenge.question.type === "dsa") {
    const languageId = payload.languageId;
    const sourceCode = payload.sourceCode;

    if (!languageId || !sourceCode) {
      throw new ValidationError("languageId and sourceCode are required for DSA submissions");
    }

    if (existing && existing.isCorrect) {
      // Already solved correctly
      return {
        isCorrect: true,
        message: "Already solved",
      };
    }

    // Build test cases from sample + hidden
    const sample = Array.isArray(challenge.question.sampleTestCases)
      ? challenge.question.sampleTestCases
      : [];
    const hidden = Array.isArray(challenge.question.hiddenTestCases)
      ? challenge.question.hiddenTestCases
      : [];

    const testCases = [
      ...sample.map((t: any) => ({ input: t.input, output: t.output })),
      ...hidden.map((t: any) => ({ input: t.input, output: t.output })),
    ];

    if (testCases.length === 0) {
      throw new ValidationError("No test cases configured for this DSA problem");
    }

    const { results, allPassed, firstFailure } = await executeTestCases(
      sourceCode,
      languageId,
      testCases,
      challenge.question.timeLimit || undefined,
      challenge.question.memoryLimit || undefined
    );

    const isCorrect = !!allPassed;

    if (!existing) {
      await prisma.dailyChallengeSolve.create({
        data: {
          userId,
          dailyChallengeId,
          languageId,
          sourceCode,
          isCorrect,
        },
      });
    } else {
      await prisma.dailyChallengeSolve.update({
        where: { id: existing.id },
        data: {
          languageId,
          sourceCode,
          isCorrect,
          attempts: { increment: 1 } as any,
          solvedAt: new Date(),
        },
      });
    }

    let streak = null;
    if (isCorrect) {
      streak = await updateStreak(userId, challenge.date);
    }

    return {
      isCorrect,
      testCaseResults: results,
      firstFailure: firstFailure ?? null,
      streak,
    };
  }

  throw new ValidationError("Unsupported daily challenge type");
}

/**
 * Get user's streak information.
 */
export async function getUserStreak(userId: string) {
  const streak = await prisma.userStreak.findUnique({
    where: { userId },
  });

  if (!streak) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastSolveDate: null,
    };
  }

  // Check if streak is still valid (not broken)
  const today = getDateOnly(new Date());
  const yesterday = getDateOnly(new Date(Date.now() - 86400000));

  let currentStreak = streak.currentStreak;
  if (
    streak.lastSolveDate &&
    streak.lastSolveDate.getTime() !== today.getTime() &&
    streak.lastSolveDate.getTime() !== yesterday.getTime()
  ) {
    // Streak is broken but not yet updated in DB — show 0
    currentStreak = 0;
  }

  return {
    currentStreak,
    longestStreak: streak.longestStreak,
    lastSolveDate: streak.lastSolveDate,
  };
}

/**
 * Get paginated history of past daily challenges with solve status.
 */
export async function getPotdHistory(
  userId: string,
  page: number,
  limit: number
) {
  const skip = (page - 1) * limit;

  const [challenges, total] = await Promise.all([
    prisma.dailyChallenge.findMany({
      where: {
        date: { lte: new Date() },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
      include: {
        question: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            type: true,
            tags: { select: { name: true } },
          },
        },
        solves: {
          where: { userId },
          select: {
            isCorrect: true,
            solvedAt: true,
          },
        },
      },
    }),
    prisma.dailyChallenge.count({
      where: { date: { lte: new Date() } },
    }),
  ]);

  return {
    history: challenges.map((c) => ({
      id: c.id,
      date: c.date,
      question: {
        id: c.question.id,
        title: c.question.title,
        difficulty: c.question.difficulty,
        type: c.question.type,
        tags: c.question.tags.map((t) => t.name),
      },
      solved: c.solves.length > 0,
      isCorrect: c.solves[0]?.isCorrect ?? null,
      solvedAt: c.solves[0]?.solvedAt ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Auto-select a question for today's POTD.
 * Prefers questions not used in the last 30 days.
 */
async function autoSelectChallenge(today: Date) {
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  // Get question IDs used in the last 30 days
  const recentChallenges = await prisma.dailyChallenge.findMany({
    where: { date: { gte: thirtyDaysAgo } },
    select: { questionId: true },
  });
  const recentIds = recentChallenges.map((c) => c.questionId);

  // Find an MCQ question not used recently
  const candidates = await prisma.question.findMany({
    where: {
      type: "mcq",
      ...(recentIds.length > 0 ? { id: { notIn: recentIds } } : {}),
    },
    select: { id: true },
  });

  if (candidates.length === 0) {
    // Fallback: pick any MCQ question
    const fallback = await prisma.question.findFirst({
      where: { type: "mcq" },
      select: { id: true },
    });
    if (!fallback) return null;
    candidates.push(fallback);
  }

  // Random pick
  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  return prisma.dailyChallenge.create({
    data: {
      questionId: picked.id,
      date: today,
      createdBy: "system",
    },
    include: {
      question: {
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          difficulty: true,
          options: true,
          // DSA fields
          sampleTestCases: true,
          hiddenTestCases: true,
          timeLimit: true,
          memoryLimit: true,
          tags: { select: { name: true } },
        },
      },
    },
  });
}

/**
 * Update streak after a successful solve.
 */
export async function updateStreak(userId: string, challengeDate: Date) {
  const today = getDateOnly(challengeDate);
  const yesterday = getDateOnly(new Date(today.getTime() - 86400000));

  const existing = await prisma.userStreak.findUnique({
    where: { userId },
  });

  let currentStreak: number;
  let longestStreak: number;

  if (!existing) {
    currentStreak = 1;
    longestStreak = 1;
  } else if (
    existing.lastSolveDate &&
    existing.lastSolveDate.getTime() === today.getTime()
  ) {
    // Already counted today
    return {
      currentStreak: existing.currentStreak,
      longestStreak: existing.longestStreak,
      lastSolveDate: existing.lastSolveDate,
    };
  } else if (
    existing.lastSolveDate &&
    existing.lastSolveDate.getTime() === yesterday.getTime()
  ) {
    // Consecutive day — extend streak
    currentStreak = existing.currentStreak + 1;
    longestStreak = Math.max(existing.longestStreak, currentStreak);
  } else {
    // Streak broken — start fresh
    currentStreak = 1;
    longestStreak = Math.max(existing.longestStreak, 1);
  }

  const streak = await prisma.userStreak.upsert({
    where: { userId },
    update: {
      currentStreak,
      longestStreak,
      lastSolveDate: today,
    },
    create: {
      userId,
      currentStreak,
      longestStreak,
      lastSolveDate: today,
    },
  });

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastSolveDate: streak.lastSolveDate,
  };
}

/**
 * Strip time from a Date, returning midnight UTC on that calendar date.
 */
function getDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
