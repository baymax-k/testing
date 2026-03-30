import { prisma } from "../../config/prisma.js";
import { getProblems } from "../../data/problems/index.js";

export interface DifficultyStats {
  easy: number;
  medium: number;
  hard: number;
}

export interface StudentProfileStats {
  problemsSolvedCount: number;
  difficultyBreakdown: DifficultyStats;
  topicMastery: Record<string, number>;
  mcqSessionsSolvedCount: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
}

export interface StudentProfileResult {
  profile: {
    id: string;
    name: string;
    username: string;
    email: string;
    image: string | null;
    phone: string | null;
    role: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  stats: StudentProfileStats;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastSolveDate: Date | null;
  } | null;
}

export async function getStudentProfile(userId: string): Promise<StudentProfileResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      phone: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const [
    totalSubmissions,
    acceptedSubmissions,
    acceptedProblemIds,
    mcqSessionsSolvedCount,
    streak,
  ] = await Promise.all([
    prisma.submission.count({ where: { userId } }),
    prisma.submission.count({ where: { userId, status: "accepted" } }),
    prisma.submission.findMany({
      where: { userId, status: "accepted" },
      distinct: ["problemId"],
      select: { problemId: true },
    }),
    prisma.mcqPracticeSession.count({
      where: { userId, status: "submitted" },
    }),
    prisma.userStreak.findUnique({
      where: { userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastSolveDate: true,
      },
    }),
  ]);

  const difficultyBreakdown: DifficultyStats = { easy: 0, medium: 0, hard: 0 };
  const topicMastery: Record<string, number> = {};

  const allProblems = getProblems();
  const problemMap = new Map(allProblems.map(p => [p.slug, p]));

  for (const { problemId } of acceptedProblemIds) {
    const problem = problemMap.get(problemId);
    if (problem) {
      const diff = problem.difficulty || "easy";
      if (diff in difficultyBreakdown) {
        difficultyBreakdown[diff as keyof DifficultyStats]++;
      }
      
      for (const tag of problem.tags || []) {
        topicMastery[tag] = (topicMastery[tag] || 0) + 1;
      }
    }
  }

  return {
    profile: user,
    stats: {
      problemsSolvedCount: acceptedProblemIds.length,
      difficultyBreakdown,
      topicMastery,
      mcqSessionsSolvedCount,
      totalSubmissions,
      acceptedSubmissions,
    },
    streak: streak
      ? {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastSolveDate: streak.lastSolveDate,
        }
      : null,
  };
}
