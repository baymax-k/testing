import { prisma } from "../../config/prisma.js";

type TrendDirection = "improving" | "stable" | "declining";
type DifficultyLevel = "easy" | "moderate" | "hard";
type ProficiencyLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

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

export interface WeeklyPerformancePoint {
  week: string;
  score: number;
  date: string;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  email: string;
  metrics: PerformanceMetrics;
  performanceTrend: WeeklyPerformancePoint[];
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
  batchId?: string;
  batchName?: string;
  totalStudents: number;
  totalTests: number;
  averageClassScore: number;
  averageScore: number;
  avgScore: number;
  medianScore: number;
  classPassPercentage: number;
  passPercentage: number;
  passRate: number;
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
  scoreDistributionRanges: Array<{
    range: string;
    count: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  email: string;
  score: number;
  averageScore: number;
  totalTestsAttempted: number;
  passingRate: number;
  recentPerformance: TrendDirection;
}

export interface BatchLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface TestAnalysis {
  testId: string;
  testTitle: string;
  totalStudents: number;
  totalParticipants: number;
  attemptedCount: number;
  averageScore: number;
  medianScore: number;
  passingPercentage: number;
  passPercentage: number;
  difficulty: DifficultyLevel;
  questionAnalysis: Array<{
    questionNumber: number;
    successRate: number;
    averageTime: number;
    questionId: string;
    questionText: string;
    type: string;
    correctAnswerPercentage: number;
    averageScoreOnQuestion: number;
    difficulty: DifficultyLevel;
  }>;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    below_average: number;
    notAttempted: number;
  };
  highPerformers: Array<{
    studentName: string;
    batch: string;
    score: number;
    percentage: number;
  }>;
  needsImprovement: Array<{
    studentName: string;
    batch: string;
    score: number;
    percentage: number;
  }>;
}

export interface SkillsetSummary {
  studentId: string;
  studentName: string;
  skills: Array<{
    skill: string;
    testsCompleted: number;
    value: number;
    proficiency: ProficiencyLevel;
  }>;
  topicsCovered: Array<{
    topic: string;
    testsCompleted: number;
    averageScore: number;
    proficiency: ProficiencyLevel;
  }>;
  overallProficiency: {
    level: ProficiencyLevel;
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

    const performanceTrend = this.calculateWeeklyPerformance(
      testAttempts.map((attempt) => ({
        submittedAt: attempt.submittedAt,
        percentage: this.toPercentage(attempt.score, attempt.maxScore),
      }))
    );

    return {
      studentId: student.id,
      studentName: student.name,
      email: student.email || "",
      metrics,
      recentTests,
      performanceTrend,
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

    const averageClassScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const classPassPercentage =
      scores.length > 0
        ? (scores.filter((s) => s >= 40).length / scores.length) * 100
        : 0;

    const scoreDistributionRanges = [
      { range: "90-100", count: scoreDistribution.excellent },
      { range: "80-89", count: scores.filter((s) => s >= 80 && s < 90).length },
      { range: "70-79", count: scores.filter((s) => s >= 70 && s < 80).length },
      { range: "60-69", count: scores.filter((s) => s >= 60 && s < 70).length },
      { range: "Below 60", count: scoreDistribution.below_average },
    ];

    return {
      batchId: batch.id,
      batchName: batch.name,
      totalStudents: batch.students.length,
      totalTests: batch.tests.length,
      averageClassScore,
      averageScore: averageClassScore,
      avgScore: averageClassScore,
      medianScore: this.calculateMedian(scores),
      classPassPercentage,
      passPercentage: classPassPercentage,
      passRate: classPassPercentage,
      topStudents,
      bottomStudents,
      scoreDistribution,
      scoreDistributionRanges,
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

      const recentPerformance = this.calculateRecentPerformanceTrend(scores);

      leaderboard.push({
        rank: 0, // Will be set below
        studentId: student.id,
        studentName: student.name,
        email: student.email || "",
        score: averageScore,
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

  async getBatchLeaderboard(
    batchId: string,
    limit: number = 50
  ): Promise<BatchLeaderboardResponse> {
    const leaderboard = await this.getLeaderboard(batchId, limit);
    return { leaderboard };
  }

  /**
   * Get detailed analysis of a test
   */
  async getTestAnalysis(testId: string): Promise<TestAnalysis> {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        batch: { include: { students: true } },
        attempts: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                batch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          where: { status: { not: "in_progress" } },
        },
      },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    const questions = await this.getQuestionsForAnalysis(testId);

    const correctAnswerByQuestionId = new Map(
      questions.map((row) => [row.id, row.correctAnswerText])
    );

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
    let difficulty: DifficultyLevel = "moderate";
    if (passPercentage > 75) difficulty = "easy";
    else if (passPercentage < 40) difficulty = "hard";

    const averageTimePerQuestion =
      questions.length > 0
        ? Math.round(
            attempts
              .filter((attempt) => attempt.submittedAt)
              .reduce((sum, attempt) => {
                if (!attempt.submittedAt) return sum;
                const durationInSeconds =
                  Math.max(
                    0,
                    attempt.submittedAt.getTime() - attempt.startedAt.getTime()
                  ) / 1000;
                return sum + durationInSeconds / questions.length;
              }, 0) / Math.max(test.attempts.filter((attempt) => attempt.submittedAt).length, 1)
          )
        : 0;

    // Analyze each question
    const questionAnalysis = questions.map((question, index) => {
      const correctAnswer = correctAnswerByQuestionId.get(question.id);

      const correctAttempts = test.attempts.filter((attempt) => {
        const answers = attempt.answers as Record<string, any> | null;
        if (!answers) return false;
        const answer = answers[question.id];
        return this.answersMatch(answer, correctAnswer);
      });

      const correctAnswerPercentage =
        attempts.length > 0
          ? ((correctAttempts.length / attempts.length) * 100)
          : 0;

      let questionDifficulty: DifficultyLevel = "moderate";
      if (correctAnswerPercentage > 75) questionDifficulty = "easy";
      else if (correctAnswerPercentage < 40) questionDifficulty = "hard";

      const normalizedDifficulty = (question.difficulty || "").toLowerCase();
      let normalizedQuestionDifficulty: DifficultyLevel = questionDifficulty;
      if (normalizedDifficulty === "medium") {
        normalizedQuestionDifficulty = "moderate";
      } else if (normalizedDifficulty === "easy") {
        normalizedQuestionDifficulty = "easy";
      } else if (normalizedDifficulty === "hard") {
        normalizedQuestionDifficulty = "hard";
      }

      return {
        questionNumber: index + 1,
        successRate: Math.round(correctAnswerPercentage),
        averageTime: averageTimePerQuestion,
        questionId: question.id,
        questionText: (question.content || "").substring(0, 100),
        type: question.type,
        correctAnswerPercentage,
        averageScoreOnQuestion: (correctAnswerPercentage / 100) * (question.marks ?? 0),
        difficulty: normalizedQuestionDifficulty,
      };
    });

    const bestAttemptByStudent = new Map<
      string,
      {
        studentName: string;
        batch: string;
        score: number;
        percentage: number;
      }
    >();

    for (const attempt of attempts) {
      const percentage = this.toPercentage(attempt.score, attempt.maxScore);
      const existing = bestAttemptByStudent.get(attempt.studentId);

      if (!existing || percentage > existing.percentage) {
        bestAttemptByStudent.set(attempt.studentId, {
          studentName: attempt.student.name,
          batch: attempt.student.batch?.name || "N/A",
          score: Math.round((attempt.score ?? 0) * 100) / 100,
          percentage: Math.round(percentage * 100) / 100,
        });
      }
    }

    const rankedAttempts = Array.from(bestAttemptByStudent.values()).sort(
      (a, b) => b.percentage - a.percentage
    );

    const highPerformers = rankedAttempts
      .filter((attempt) => attempt.percentage >= 90)
      .slice(0, 3);

    const needsImprovement = [...rankedAttempts]
      .filter((attempt) => attempt.percentage < 60)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);

    const scoreDistribution = this.calculateScoreDistribution(scores, totalStudents);

    return {
      testId: test.id,
      testTitle: test.title,
      totalStudents,
      totalParticipants: attemptedCount,
      attemptedCount,
      averageScore:
        scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
      medianScore: this.calculateMedian(scores),
      passingPercentage: passPercentage,
      passPercentage,
      difficulty,
      questionAnalysis,
      scoreDistribution,
      highPerformers,
      needsImprovement,
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

      let proficiency: ProficiencyLevel = "beginner";
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

    let overallProficiency: ProficiencyLevel = "beginner";
    if (overallScore >= 90) overallProficiency = "expert";
    else if (overallScore >= 75) overallProficiency = "advanced";
    else if (overallScore >= 60) overallProficiency = "intermediate";

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      topicsCovered,
      overallScore
    );

    const skills = topicsCovered.map((topic) => ({
      skill: topic.topic,
      testsCompleted: topic.testsCompleted,
      value: topic.averageScore,
      proficiency: topic.proficiency,
    }));

    return {
      studentId,
      studentName: student.name,
      skills,
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
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        batches: {
          include: {
            mentor: {
              select: {
                name: true,
              },
            },
            students: {
              select: {
                id: true,
              },
            },
            tests: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    const batchPerformances = await Promise.all(
      department.batches.map((batch) => this.getBatchPerformance(batch.id))
    );

    const batches = department.batches.map((batch, index) => {
      const performance = batchPerformances[index];
      return {
        batchId: batch.id,
        batchName: batch.name,
        studentCount: batch.students.length,
        year: batch.year,
        averageScore: performance.averageScore,
        avgScore: performance.avgScore,
        passPercentage: performance.passPercentage,
        passRate: performance.passRate,
        mentor: batch.mentor?.name || "N/A",
      };
    });

    const attempts = await prisma.testAttempt.findMany({
      where: {
        status: { not: "in_progress" },
        OR: [
          { test: { departmentId } },
          { test: { batch: { departmentId } } },
        ],
      },
      select: {
        score: true,
        maxScore: true,
        submittedAt: true,
      },
    });

    const performanceTrend = this.calculateWeeklyPerformance(
      attempts.map((attempt) => ({
        submittedAt: attempt.submittedAt,
        percentage: this.toPercentage(attempt.score, attempt.maxScore),
      }))
    );

    const totalStudents = batches.reduce(
      (sum: number, batch) => sum + batch.studentCount,
      0
    );
    const totalTests = department.batches.reduce(
      (sum: number, batch) => sum + batch.tests.length,
      0
    );

    const averageDepartmentScore =
      batchPerformances.length > 0
        ? batchPerformances.reduce((sum, batch) => sum + batch.averageScore, 0) /
          batchPerformances.length
        : 0;

    const departmentPassPercentage =
      batchPerformances.length > 0
        ? batchPerformances.reduce((sum, batch) => sum + batch.passPercentage, 0) /
          batchPerformances.length
        : 0;

    return {
      departmentId: department.id,
      departmentName: department.name,
      totalBatches: department.batches.length,
      totalStudents,
      totalTests,
      averageDepartmentScore,
      averageScore: averageDepartmentScore,
      avgScore: averageDepartmentScore,
      departmentPassPercentage,
      passPercentage: departmentPassPercentage,
      passRate: departmentPassPercentage,
      batches,
      performanceTrend,
      batchPerformances: batchPerformances.map(
        (batchPerformance: BatchPerformanceStats, index: number) => ({
          batchId: department.batches[index].id,
          ...batchPerformance,
        })
      ),
    };
  }

  // Helper methods
  private async getQuestionsForAnalysis(testId: string): Promise<Array<{
    id: string;
    content: string | null;
    difficulty: string | null;
    type: string;
    marks: number;
    correctAnswerText: string | null;
  }>> {
    const columnRows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'question'
    `;

    const availableColumns = new Set(columnRows.map((row) => row.column_name));
    if (!availableColumns.has("testId")) {
      return [];
    }

    const contentExpr = availableColumns.has("content")
      ? "COALESCE(\"content\", '')"
      : "''";
    const typeExpr = availableColumns.has("type")
      ? '"type"::text'
      : "'multiple_choice'";
    const marksExpr = availableColumns.has("marks")
      ? 'COALESCE("marks", 1)'
      : "1";
    const difficultyExpr = availableColumns.has("difficulty")
      ? '"difficulty"'
      : "NULL::text";
    const correctAnswerExpr = availableColumns.has("correctAnswer")
      ? '"correctAnswer"::text'
      : "NULL::text";
    const orderExpr = availableColumns.has("orderIndex")
      ? '"orderIndex"'
      : '"id"';

    const sql = `
      SELECT
        "id",
        ${contentExpr} AS "content",
        ${typeExpr} AS "type",
        ${marksExpr}::int AS "marks",
        ${difficultyExpr} AS "difficulty",
        ${correctAnswerExpr} AS "correctAnswerText"
      FROM "question"
      WHERE "testId" = $1
      ORDER BY ${orderExpr} ASC, "id" ASC
    `;

    const questionRows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      content: string | null;
      difficulty: string | null;
      type: string | null;
      marks: number | null;
      correctAnswerText: string | null;
    }>>(sql, testId);

    return questionRows.map((row) => ({
      id: row.id,
      content: row.content ?? "",
      difficulty: row.difficulty,
      type: row.type ?? "multiple_choice",
      marks: row.marks ?? 1,
      correctAnswerText: row.correctAnswerText,
    }));
  }

  private toPercentage(score: number | null, maxScore: number): number {
    if (!maxScore || maxScore <= 0) {
      return 0;
    }

    return ((score ?? 0) / maxScore) * 100;
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private calculateWeeklyPerformance(
    entries: Array<{ submittedAt: Date | null; percentage: number }>
  ): WeeklyPerformancePoint[] {
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const currentWeekStart = this.getWeekStart(new Date());
    const firstWeekStart = new Date(currentWeekStart);
    firstWeekStart.setDate(firstWeekStart.getDate() - 7 * 7);

    const buckets = Array.from({ length: 8 }, (_, index) => {
      const start = new Date(firstWeekStart);
      start.setDate(start.getDate() + index * 7);
      return {
        start,
        scores: [] as number[],
      };
    });

    for (const entry of entries) {
      if (!entry.submittedAt) continue;
      const submittedAt = new Date(entry.submittedAt);
      const index = Math.floor(
        (submittedAt.getTime() - firstWeekStart.getTime()) / weekInMs
      );
      if (index >= 0 && index < buckets.length) {
        buckets[index].scores.push(entry.percentage);
      }
    }

    return buckets.map((bucket, index) => ({
      week: `W${index + 1}`,
      score:
        bucket.scores.length > 0
          ? Math.round(
              bucket.scores.reduce((sum, score) => sum + score, 0) /
                bucket.scores.length
            )
          : 0,
      date: this.formatDate(bucket.start),
    }));
  }

  private calculateRecentPerformanceTrend(
    scores: number[]
  ): TrendDirection {
    const recentScores = scores.slice(0, 5);
    const olderScores = scores.slice(5, 10);

    if (recentScores.length === 0) {
      return "stable";
    }

    const recentAvg =
      recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const olderAvg =
      olderScores.length > 0
        ? olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length
        : recentAvg;

    if (recentAvg > olderAvg + 2) {
      return "improving";
    }
    if (recentAvg < olderAvg - 2) {
      return "declining";
    }
    return "stable";
  }

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
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  private normalizeAnswerValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value).toLowerCase();
    }

    return null;
  }

  private buildAnswerAliases(normalized: string): Set<string> {
    const aliases = new Set<string>([normalized]);

    const letterToIndex: Record<string, string> = {
      a: "0",
      b: "1",
      c: "2",
      d: "3",
      e: "4",
      f: "5",
    };

    const mappedIndex = letterToIndex[normalized];
    if (mappedIndex !== undefined) {
      aliases.add(mappedIndex);
    }

    const numericValue = Number.parseInt(normalized, 10);
    if (!Number.isNaN(numericValue) && String(numericValue) === normalized && numericValue >= 0 && numericValue < 26) {
      aliases.add(String.fromCharCode(97 + numericValue));
    }

    return aliases;
  }

  private answersMatch(submittedAnswer: unknown, correctAnswer: string | null | undefined): boolean {
    const normalizedSubmitted = this.normalizeAnswerValue(submittedAnswer);
    const normalizedCorrect = this.normalizeAnswerValue(correctAnswer);

    if (!normalizedSubmitted || !normalizedCorrect) {
      return false;
    }

    const submittedAliases = this.buildAnswerAliases(normalizedSubmitted);
    const correctAliases = this.buildAnswerAliases(normalizedCorrect);

    for (const alias of submittedAliases) {
      if (correctAliases.has(alias)) {
        return true;
      }
    }

    return false;
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
      proficiency: ProficiencyLevel;
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
