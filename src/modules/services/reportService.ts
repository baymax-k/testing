import { prisma } from "../../config/auth.js";

export interface PerformanceMetrics {
  totalTests: number;
  attempted: number;
  passed: number;
  failed: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passPercentage: number;
  scoreDistribution: {
    excellent: number; // 90-100
    good: number; // 75-89
    average: number; // 60-74
    below_average: number; // < 60
    notAttempted: number;
  };
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  email: string;
  metrics: PerformanceMetrics;
  recentTests: Array<{
    testId: string;
    testTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
    status: string;
    submittedAt: Date | null;
  }>;
}

export interface BatchPerformanceStats {
  totalStudents: number;
  totalTests: number;
  averageClassScore: number;
  medianScore: number;
  classPassPercentage: number;
  topStudents: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
  }>;
  bottomStudents: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
  }>;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    below_average: number;
    notAttempted: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  email: string;
  averageScore: number;
  totalTestsAttempted: number;
  passingRate: number;
  recentPerformance: "improving" | "stable" | "declining";
}

export interface TestAnalysis {
  testId: string;
  testTitle: string;
  totalStudents: number;
  attemptedCount: number;
  averageScore: number;
  medianScore: number;
  passingPercentage: number;
  difficulty: "easy" | "moderate" | "hard";
  questionAnalysis: Array<{
    questionId: string;
    questionText: string;
    type: string;
    correctAnswerPercentage: number;
    averageScoreOnQuestion: number;
    difficulty: "easy" | "moderate" | "hard";
  }>;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    below_average: number;
    notAttempted: number;
  };
}

export interface SkillsetSummary {
  studentId: string;
  studentName: string;
  topicsCovered: Array<{
    topic: string;
    testsCompleted: number;
    averageScore: number;
    proficiency: "beginner" | "intermediate" | "advanced" | "expert";
  }>;
  overallProficiency: {
    level: "beginner" | "intermediate" | "advanced" | "expert";
    score: number;
  };
  recommendations: string[];
}

export class ReportService {
  /**
   * Get performance report for a single student
   */
  async getStudentPerformance(studentId: string): Promise<StudentPerformance> {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const testAttempts = await prisma.testAttempt.findMany({
      where: { studentId },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            passingMarks: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    // Get all tests accessible to this student for total count
    const allTests = await prisma.test.findMany({
      where: {
        OR: [
          { batchId: student.id },
          { batch: { students: { some: { id: studentId } } } },
        ],
      },
      select: { id: true, totalMarks: true, passingMarks: true },
    });

    // Calculate metrics
    const metrics = this.calculatePerformanceMetrics(testAttempts, allTests);

    // Get recent tests
    const recentTests = testAttempts.slice(0, 5).map((attempt: any) => ({
      testId: attempt.test.id,
      testTitle: attempt.test.title,
      score: attempt.score ?? 0,
      maxScore: attempt.maxScore,
      percentage: ((attempt.score ?? 0) / attempt.maxScore) * 100,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
    }));

    return {
      studentId: student.id,
      studentName: student.name,
      email: student.email || "",
      metrics,
      recentTests,
    };
  }

  /**
   * Get batch-wise performance statistics
   */
  async getBatchPerformance(batchId: string): Promise<BatchPerformanceStats> {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { students: true, tests: true },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    const testAttempts = await prisma.testAttempt.findMany({
      where: {
        student: { batchId },
      },
      include: {
        test: { select: { totalMarks: true, passingMarks: true } },
      },
    });

    const studentPerformances = new Map<string, PerformanceMetrics>();

    for (const student of batch.students) {
      const studentAttempts = testAttempts.filter(
        (a: any) => a.studentId === student.id
      );
      const allBatchTests = batch.tests.map((t: any) => ({
        id: t.id,
        totalMarks: t.totalMarks,
        passingMarks: t.passingMarks,
      }));

      const metrics = this.calculatePerformanceMetrics(
        studentAttempts,
        allBatchTests
      );
      studentPerformances.set(student.id, metrics);
    }

    // Calculate batch-wide stats
    const scores = testAttempts
      .filter((a) => a.score !== null)
      .map((a) => ((a.score ?? 0) / a.maxScore) * 100);

    const topStudents = Array.from(studentPerformances.entries())
      .map(([id, metrics]) => ({
        studentId: id,
        studentName:
          batch.students.find((s) => s.id === id)?.name || "Unknown",
        averageScore: metrics.averageScore,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);

    const bottomStudents = Array.from(studentPerformances.entries())
      .map(([id, metrics]) => ({
        studentId: id,
        studentName:
          batch.students.find((s) => s.id === id)?.name || "Unknown",
        averageScore: metrics.averageScore,
      }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    const scoreDistribution = this.calculateScoreDistribution(
      testAttempts.map((a: any) => ((a.score ?? 0) / a.maxScore) * 100),
      batch.students.length * batch.tests.length
    );

    return {
      totalStudents: batch.students.length,
      totalTests: batch.tests.length,
      averageClassScore:
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      medianScore: this.calculateMedian(scores),
      classPassPercentage:
        scores.length > 0
          ? (scores.filter((s) => s >= 40).length / scores.length) * 100
          : 0,
      topStudents,
      bottomStudents,
      scoreDistribution,
    };
  }

  /**
   * Get leaderboard for a batch
   */
  async getLeaderboard(
    batchId: string,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { students: true },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    const leaderboard: LeaderboardEntry[] = [];

    for (const student of batch.students as any) {
      const attempts = await prisma.testAttempt.findMany({
        where: { studentId: student.id },
        include: { test: true },
        orderBy: { submittedAt: "desc" },
      });

      if (attempts.length === 0) continue;

      const scores = attempts
        .filter((a) => a.score !== null)
        .map((a) => ((a.score ?? 0) / a.maxScore) * 100);

      const averageScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const passingTests = attempts.filter((a) => (a.score ?? 0) >= (a.test.passingMarks ?? 40));
      const passingRate =
        attempts.length > 0 ? (passingTests.length / attempts.length) * 100 : 0;

      // Determine performance trend
      const recentScores = scores.slice(0, 3);
      const olderScores = scores.slice(3, 6);
      let recentPerformance: "improving" | "stable" | "declining" = "stable";

      if (recentScores.length > 0 && olderScores.length > 0) {
        const recentAvg =
          recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        const olderAvg =
          olderScores.reduce((a, b) => a + b, 0) / olderScores.length;

        if (recentAvg > olderAvg + 5) recentPerformance = "improving";
        else if (recentAvg < olderAvg - 5) recentPerformance = "declining";
      }

      leaderboard.push({
        rank: 0, // Will be set below
        studentId: student.id,
        studentName: student.name,
        email: student.email || "",
        averageScore,
        totalTestsAttempted: attempts.length,
        passingRate,
        recentPerformance,
      });
    }

    // Sort by average score and assign ranks
    leaderboard.sort((a, b) => b.averageScore - a.averageScore);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard.slice(0, limit);
  }

  /**
   * Get detailed analysis of a test
   */
  async getTestAnalysis(testId: string): Promise<TestAnalysis> {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { orderIndex: "asc" } },
        batch: { include: { students: true } },
        attempts: {
          include: { student: true },
          where: { status: { not: "in_progress" } },
        },
      },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    const totalStudents = test.batch?.students.length || 0;
    const attemptedCount = test.attempts.length;
    const scores = test.attempts
      .filter((a: any) => a.score !== null)
      .map((a: any) => ((a.score ?? 0) / a.maxScore) * 100);

    // Determine test difficulty based on pass rate
    const passPercentage =
      scores.length > 0
        ? (scores.filter((s) => s >= 40).length / scores.length) * 100
        : 0;
    let difficulty: "easy" | "moderate" | "hard" = "moderate";
    if (passPercentage > 75) difficulty = "easy";
    else if (passPercentage < 40) difficulty = "hard";

    // Analyze each question
    const questionAnalysis = test.questions.map((question) => {
      const correctAttempts = test.attempts.filter((attempt) => {
        const answers = attempt.answers as Record<string, any> | null;
        if (!answers) return false;
        const answer = answers[question.id];
        return answer === question.correctAnswer;
      });

      const correctAnswerPercentage =
        test.attempts.length > 0
          ? ((correctAttempts.length / test.attempts.length) * 100)
          : 0;

      let questionDifficulty: "easy" | "moderate" | "hard" = "moderate";
      if (correctAnswerPercentage > 75) questionDifficulty = "easy";
      else if (correctAnswerPercentage < 40) questionDifficulty = "hard";

      return {
        questionId: question.id,
        questionText: question.content.substring(0, 100),
        type: question.type,
        correctAnswerPercentage,
        averageScoreOnQuestion: (correctAnswerPercentage / 100) * question.marks,
        difficulty: questionDifficulty,
      };
    });

    const scoreDistribution = this.calculateScoreDistribution(scores, totalStudents);

    return {
      testId: test.id,
      testTitle: test.title,
      totalStudents,
      attemptedCount,
      averageScore:
        scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
      medianScore: this.calculateMedian(scores),
      passingPercentage: passPercentage,
      difficulty,
      questionAnalysis,
      scoreDistribution,
    };
  }

  /**
   * Get skillset summary for a student
   */
  async getSkillsetSummary(studentId: string): Promise<SkillsetSummary> {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const attempts = await prisma.testAttempt.findMany({
      where: { 
        studentId,
        status: { not: "in_progress" }
      },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            description: true,
            totalMarks: true,
          },
        },
      },
    });

    // Parse topics from test titles/descriptions
    const topicMap = new Map<
      string,
      { scores: number[]; tests: string[] }
    >();

    for (const attempt of attempts) {
      // Extract topic from test title (simple heuristic)
      const testTitle = attempt.test.title.toLowerCase();
      const topic = this.extractTopic(testTitle, attempt.test.description || "");

      if (!topicMap.has(topic)) {
        topicMap.set(topic, { scores: [], tests: [] });
      }

      const data = topicMap.get(topic)!;
      data.scores.push(((attempt.score ?? 0) / attempt.maxScore) * 100);
      data.tests.push(attempt.test.id);
    }

    // Convert to skillset summary
    const topicsCovered = Array.from(topicMap.entries()).map(([topic, data]: any) => {
      const avgScore =
        data.scores.length > 0
          ? data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length
          : 0;

      let proficiency: "beginner" | "intermediate" | "advanced" | "expert" =
        "beginner";
      if (avgScore >= 90) proficiency = "expert";
      else if (avgScore >= 75) proficiency = "advanced";
      else if (avgScore >= 60) proficiency = "intermediate";

      return {
        topic,
        testsCompleted: data.tests.length,
        averageScore: avgScore,
        proficiency,
      };
    });

    // Calculate overall proficiency
    const allScores = attempts
      .filter((a) => a.score !== null)
      .map((a) => ((a.score ?? 0) / a.maxScore) * 100);
    const overallScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;

    let overallProficiency: "beginner" | "intermediate" | "advanced" | "expert" =
      "beginner";
    if (overallScore >= 90) overallProficiency = "expert";
    else if (overallScore >= 75) overallProficiency = "advanced";
    else if (overallScore >= 60) overallProficiency = "intermediate";

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      topicsCovered,
      overallScore
    );

    return {
      studentId,
      studentName: student.name,
      topicsCovered,
      overallProficiency: {
        level: overallProficiency,
        score: overallScore,
      },
      recommendations,
    };
  }

  /**
   * Get department-wide performance report
   */
  async getDepartmentPerformance(departmentId: string) {
    const batches = await prisma.batch.findMany({
      where: { departmentId },
      select: { id: true },
    });

    const batchPerformances = await Promise.all(
      batches.map((b: any) => this.getBatchPerformance(b.id))
    );

    const departmentMetrics = {
      totalBatches: batches.length,
      totalStudents: batchPerformances.reduce(
        (sum: number, b: BatchPerformanceStats) => sum + b.totalStudents,
        0
      ),
      totalTests: batchPerformances.reduce(
        (sum: number, b: BatchPerformanceStats) => sum + b.totalTests,
        0
      ),
      averageDepartmentScore: this.calculateMedian(
        batchPerformances.map((b: BatchPerformanceStats) => b.averageClassScore)
      ),
      departmentPassPercentage:
        batchPerformances.length > 0
          ? batchPerformances.reduce(
              (sum: number, b: BatchPerformanceStats) => sum + b.classPassPercentage,
              0
            ) / batchPerformances.length
          : 0,
      batchPerformances: batchPerformances.map((bp: BatchPerformanceStats, idx: number) => ({
        batchId: batches[idx].id,
        ...bp,
      })),
    };

    return departmentMetrics;
  }

  // Helper methods
  private calculatePerformanceMetrics(
    testAttempts: any[],
    allTests: any[]
  ): PerformanceMetrics {
    const attempted = testAttempts.length;
    const scores = testAttempts
      .filter((a) => a.score !== null)
      .map((a) => ((a.score ?? 0) / a.maxScore) * 100);

    const passed = testAttempts.filter((a) => (a.score ?? 0) >= (a.test.passingMarks ?? 40)).length;

    return {
      totalTests: allTests.length,
      attempted,
      passed,
      failed: attempted - passed,
      averageScore:
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      passPercentage:
        attempted > 0 ? ((passed / attempted) * 100) : 0,
      scoreDistribution: this.calculateScoreDistribution(scores, allTests.length),
    };
  }

  private calculateScoreDistribution(
    scores: number[],
    totalTests: number
  ): PerformanceMetrics["scoreDistribution"] {
    return {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 75 && s < 90).length,
      average: scores.filter((s) => s >= 60 && s < 75).length,
      below_average: scores.filter((s) => s < 60).length,
      notAttempted: totalTests - scores.length,
    };
  }

  private calculateMedian(scores: number[]): number {
    if (scores.length === 0) return 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private extractTopic(
    testTitle: string,
    description: string
  ): string {
    // Simple topic extraction from title/description
    const keywords = [
      "python",
      "javascript",
      "database",
      "web",
      "dsa",
      "algorithm",
      "data structures",
      "oop",
      "functional programming",
      "html",
      "css",
      "rest",
      "api",
      "testing",
      "git",
    ];

    const combined = (testTitle + " " + description).toLowerCase();
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
    }

    // Default: use first few words of title
    return testTitle.split(" ").slice(0, 2).join(" ");
  }

  private generateRecommendations(
    topics: Array<{
      topic: string;
      proficiency: "beginner" | "intermediate" | "advanced" | "expert";
    }>,
    overallScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Find weak areas
    const weakTopics = topics.filter((t) => t.proficiency === "beginner");
    if (weakTopics.length > 0) {
      recommendations.push(
        `Focus on improving ${weakTopics
          .map((t) => t.topic)
          .join(", ")} to strengthen your foundation`
      );
    }

    // Overall improvement suggestion
    if (overallScore < 60) {
      recommendations.push(
        "Consider additional study sessions and practice tests to improve overall performance"
      );
    } else if (overallScore < 75) {
      recommendations.push(
        "You're doing well! Try challenging problems to reach advanced proficiency"
      );
    }

    // Advanced topics
    const advancedTopics = topics.filter((t) =>
      ["advanced", "expert"].includes(t.proficiency)
    );
    if (advancedTopics.length > 0) {
      recommendations.push(
        `You excel in ${advancedTopics
          .map((t) => t.topic)
          .join(", ")}. Consider mentoring others in these areas`
      );
    }

    return recommendations.length > 0
      ? recommendations
      : ["Continue your current learning path - you're on track!"];
  }
}

export const reportService = new ReportService();
