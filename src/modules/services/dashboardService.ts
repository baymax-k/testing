import { prisma } from "../../config/auth.js";

export interface DashboardMetrics {
  totalStudents: number;
  averageScore: number;
  activeTests: number;
  passRate: number;
  studentsTrend: number;
  performanceTrend: number;
  testsTrend: number;
  passRateTrend: number;
}

export class DashboardService {
  async getDashboardMetrics(
    userId?: string,
    role?: string,
    departmentId?: string
  ): Promise<DashboardMetrics> {
    const scopeDepartmentId =
      role === "hod" || role === "dept_admin" || role === "mentor"
        ? departmentId
        : undefined;

    const [
      totalStudents,
      activeTests,
      averageScore,
      passRate,
      studentsTrend,
      performanceTrend,
      testsTrend,
      passRateTrend,
    ] = await Promise.all([
      this.getTotalStudents(scopeDepartmentId),
      this.getActiveTests(scopeDepartmentId),
      this.getAverageScore(scopeDepartmentId),
      this.getPassRate(scopeDepartmentId),
      this.getStudentsTrend(scopeDepartmentId),
      this.getPerformanceTrend(scopeDepartmentId),
      this.getTestsTrend(scopeDepartmentId),
      this.getPassRateTrend(scopeDepartmentId),
    ]);

    return {
      totalStudents,
      averageScore,
      activeTests,
      passRate,
      studentsTrend,
      performanceTrend,
      testsTrend,
      passRateTrend,
    };
  }

  private getAttemptScope(departmentId?: string) {
    if (!departmentId) {
      return {};
    }

    return {
      OR: [
        { test: { departmentId } },
        { test: { batch: { departmentId } } },
      ],
    };
  }

  private getTestScope(departmentId?: string) {
    if (!departmentId) {
      return {};
    }

    return {
      OR: [{ departmentId }, { batch: { departmentId } }],
    };
  }

  private getWindows(days: number = 30) {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);

    const previousEnd = new Date(currentStart);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    return { now, currentStart, previousStart, previousEnd };
  }

  private getTrend(current: number, previous: number): number {
    if (previous === 0) {
      if (current === 0) return 0;
      return 100;
    }

    return Math.round((((current - previous) / previous) * 100) * 10) / 10;
  }

  private toPercentage(score: number | null, maxScore: number): number {
    if (!maxScore || maxScore <= 0) {
      return 0;
    }
    return ((score ?? 0) / maxScore) * 100;
  }

  private async getTotalStudents(departmentId?: string): Promise<number> {
    return prisma.user.count({
      where: {
        role: "student",
        ...(departmentId ? { departmentId } : {}),
      },
    });
  }

  private async getActiveTests(departmentId?: string): Promise<number> {
    return prisma.test.count({
      where: {
        status: "active",
        ...this.getTestScope(departmentId),
      },
    });
  }

  private async getAverageScore(departmentId?: string): Promise<number> {
    const attempts = await prisma.testAttempt.findMany({
      where: {
        status: { not: "in_progress" },
        ...this.getAttemptScope(departmentId),
      },
      select: {
        score: true,
        maxScore: true,
      },
    });

    if (attempts.length === 0) {
      return 0;
    }

    const avg =
      attempts.reduce(
        (sum, attempt) => sum + this.toPercentage(attempt.score, attempt.maxScore),
        0
      ) / attempts.length;

    return Math.round(avg);
  }

  private async getPassRate(departmentId?: string): Promise<number> {
    const attempts = await prisma.testAttempt.findMany({
      where: {
        status: { not: "in_progress" },
        ...this.getAttemptScope(departmentId),
      },
      select: {
        score: true,
        maxScore: true,
      },
    });

    if (attempts.length === 0) {
      return 0;
    }

    const passedAttempts = attempts.filter(
      (attempt) => this.toPercentage(attempt.score, attempt.maxScore) >= 60
    ).length;

    return Math.round((passedAttempts / attempts.length) * 100);
  }

  private async getStudentsTrend(departmentId?: string): Promise<number> {
    const { now, currentStart, previousStart, previousEnd } = this.getWindows();

    const [currentCount, previousCount] = await Promise.all([
      prisma.user.count({
        where: {
          role: "student",
          ...(departmentId ? { departmentId } : {}),
          createdAt: { gte: currentStart, lte: now },
        },
      }),
      prisma.user.count({
        where: {
          role: "student",
          ...(departmentId ? { departmentId } : {}),
          createdAt: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    return this.getTrend(currentCount, previousCount);
  }

  private async getPerformanceTrend(departmentId?: string): Promise<number> {
    const { now, currentStart, previousStart, previousEnd } = this.getWindows();

    const [currentAttempts, previousAttempts] = await Promise.all([
      prisma.testAttempt.findMany({
        where: {
          status: { not: "in_progress" },
          createdAt: { gte: currentStart, lte: now },
          ...this.getAttemptScope(departmentId),
        },
        select: { score: true, maxScore: true },
      }),
      prisma.testAttempt.findMany({
        where: {
          status: { not: "in_progress" },
          createdAt: { gte: previousStart, lt: previousEnd },
          ...this.getAttemptScope(departmentId),
        },
        select: { score: true, maxScore: true },
      }),
    ]);

    const currentAverage =
      currentAttempts.length > 0
        ? currentAttempts.reduce(
            (sum, attempt) => sum + this.toPercentage(attempt.score, attempt.maxScore),
            0
          ) / currentAttempts.length
        : 0;

    const previousAverage =
      previousAttempts.length > 0
        ? previousAttempts.reduce(
            (sum, attempt) => sum + this.toPercentage(attempt.score, attempt.maxScore),
            0
          ) / previousAttempts.length
        : 0;

    return this.getTrend(currentAverage, previousAverage);
  }

  private async getTestsTrend(departmentId?: string): Promise<number> {
    const { now, currentStart, previousStart, previousEnd } = this.getWindows();

    const [currentCount, previousCount] = await Promise.all([
      prisma.test.count({
        where: {
          createdAt: { gte: currentStart, lte: now },
          ...this.getTestScope(departmentId),
        },
      }),
      prisma.test.count({
        where: {
          createdAt: { gte: previousStart, lt: previousEnd },
          ...this.getTestScope(departmentId),
        },
      }),
    ]);

    return this.getTrend(currentCount, previousCount);
  }

  private async getPassRateTrend(departmentId?: string): Promise<number> {
    const { now, currentStart, previousStart, previousEnd } = this.getWindows();

    const [currentAttempts, previousAttempts] = await Promise.all([
      prisma.testAttempt.findMany({
        where: {
          status: { not: "in_progress" },
          createdAt: { gte: currentStart, lte: now },
          ...this.getAttemptScope(departmentId),
        },
        select: { score: true, maxScore: true },
      }),
      prisma.testAttempt.findMany({
        where: {
          status: { not: "in_progress" },
          createdAt: { gte: previousStart, lt: previousEnd },
          ...this.getAttemptScope(departmentId),
        },
        select: { score: true, maxScore: true },
      }),
    ]);

    const currentPassRate =
      currentAttempts.length > 0
        ? (currentAttempts.filter(
            (attempt) => this.toPercentage(attempt.score, attempt.maxScore) >= 60
          ).length /
            currentAttempts.length) *
          100
        : 0;

    const previousPassRate =
      previousAttempts.length > 0
        ? (previousAttempts.filter(
            (attempt) => this.toPercentage(attempt.score, attempt.maxScore) >= 60
          ).length /
            previousAttempts.length) *
          100
        : 0;

    return this.getTrend(currentPassRate, previousPassRate);
  }
}

export const dashboardService = new DashboardService();
