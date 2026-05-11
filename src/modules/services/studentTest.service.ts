// ─── Student Test Service ────────────────────────────────────────────────────────

import { prisma } from "../../config/prisma.js";
import type { Test, Question, TestAttempt, QuestionType } from "@prisma/client";

// Valid question types for formal tests (MCQ and DSA only)
const VALID_TEST_QUESTION_TYPES: QuestionType[] = ["mcq", "dsa", "multiple_choice", "true_false"];

interface AssignedTest {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: any; // TestStatus
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  totalMarks: number;
  difficulty: string | null;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  questions: Array<{
    id: string;
    title: string;
    marks: number | null;
    orderIndex: number | null;
  }>;
  questionCount: number;
}

interface TestDetail extends Test {
  questions: (Question & {
    correctAnswer?: number | null; // Include for MCQ scoring
  })[];
}

interface TestSubmitResult {
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  status: string;
}

/**
 * Get all tests assigned to the student based on batch, department, or public availability
 */
export async function listAssignedTests(
  userId: string,
  limit: number = 20,
  offset: number = 0,
  filters?: {
    difficulty?: string;
    tags?: string[];
    status?: string;
  }
): Promise<{ tests: AssignedTest[]; total: number }> {
  // Get student's batch and department
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { batchId: true, departmentId: true },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  // Build WHERE clause: tests assigned to student's batch/department OR public
  const orConditions: any[] = [];
  if (student.batchId) {
    orConditions.push({ batchId: student.batchId });
  }
  if (student.departmentId) {
    orConditions.push({ departmentId: student.departmentId });
  }
  orConditions.push({ isPublic: true });

  const whereClause: any = {
    OR: orConditions,
  };

  // Apply optional filters
  if (filters?.difficulty) {
    whereClause.difficulty = filters.difficulty;
  }

  if (filters?.tags && filters.tags.length > 0) {
    whereClause.tags = {
      hasSome: filters.tags,
    };
  }

  if (filters?.status) {
    whereClause.status = filters.status;
  }

  // Count total matching tests
  const total = await prisma.test.count({ where: whereClause });

  // Fetch tests with question counts
  const tests = await prisma.test.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      description: true,
      durationMinutes: true,
      status: true,
      scheduledStartTime: true,
      scheduledEndTime: true,
      totalMarks: true,
      difficulty: true,
      tags: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      questions: {
        where: {
          type: { in: VALID_TEST_QUESTION_TYPES },
        },
        select: {
          id: true,
          title: true,
          marks: true,
          orderIndex: true,
        },
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
    take: limit,
    skip: offset,
    orderBy: { scheduledStartTime: "desc" },
  });

  const enrichedTests: AssignedTest[] = tests.map((test) => ({
    ...test,
    questionCount: test.questions.length,
  }));

  return { tests: enrichedTests, total };
}

/**
 * Get detailed test information including all questions
 * Does NOT return correctAnswer for MCQs (prevent cheating via API inspection)
 */
export async function getTestDetail(
  userId: string,
  testId: string
): Promise<TestDetail | null> {
  // Verify student has access to this test
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { batchId: true, departmentId: true },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  // Build OR conditions for access
  const orConditions: any[] = [];
  if (student.batchId) {
    orConditions.push({ batchId: student.batchId });
  }
  if (student.departmentId) {
    orConditions.push({ departmentId: student.departmentId });
  }
  orConditions.push({ isPublic: true });

  // Check if test is accessible to student
  const test = await prisma.test.findFirst({
    where: {
      id: testId,
      OR: orConditions,
    },
    include: {
      questions: {
        where: {
          type: { in: VALID_TEST_QUESTION_TYPES },
        },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          description: true,
          marks: true,
          orderIndex: true,
          options: true,
          explanation: true,
          timeLimit: true,
          memoryLimit: true,
          sampleTestCases: true,
          difficulty: true,
          // DO NOT include correctAnswer here for student view
        },
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });

  return test as TestDetail | null;
}

/**
 * Submit test attempt with answers and calculate score
 * Creates TestAttempt record with evaluated answers
 */
export async function submitTestAttempt(
  userId: string,
  testId: string,
  answers: Array<{ questionId: string; selectedAnswer?: number | string }>
): Promise<TestSubmitResult> {
  // Get student info
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { batchId: true, departmentId: true },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  // Fetch test with access validation
  const orConditions2: any[] = [];
  if (student.batchId) {
    orConditions2.push({ batchId: student.batchId });
  }
  if (student.departmentId) {
    orConditions2.push({ departmentId: student.departmentId });
  }
  orConditions2.push({ isPublic: true });

  const test = await prisma.test.findFirst({
    where: {
      id: testId,
      OR: orConditions2,
    },
    include: {
      questions: {
        select: {
          id: true,
          type: true,
          marks: true,
          correctAnswer: true,
        },
      },
    },
  });

  if (!test) {
    throw new Error("Test not found or not accessible");
  }

  // Validate test timing (if scheduled)
  if (test.scheduledStartTime && test.scheduledEndTime) {
    const now = new Date();
    if (now < test.scheduledStartTime) {
      throw new Error("Test has not started yet");
    }
    if (now > test.scheduledEndTime) {
      throw new Error("Test submission period has ended");
    }
  }

  // Validate attempt count
  const existingAttempts = await prisma.testAttempt.count({
    where: { testId, studentId: userId },
  });

  if (existingAttempts >= test.maxAttempts) {
    throw new Error(
      `Maximum attempts (${test.maxAttempts}) reached for this test`
    );
  }

  // Calculate score by comparing answers with correct options
  let totalScore = 0;
  let correctCount = 0;
  const evaluatedAnswers: Record<
    string,
    { selectedAnswer?: number | string; isCorrect: boolean; marks: number }
  > = {};

  for (const answer of answers) {
    const question = test.questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const marks = question.marks ?? 0;

    // Evaluate based on question type
    const isCorrect =
      question.type === "multiple_choice" || question.type === "mcq"
        ? answer.selectedAnswer === question.correctAnswer
        : false; // Default: mark non-MCQ as incorrect (can be extended for other types)

    if (isCorrect) {
      totalScore += marks;
      correctCount += 1;
    }

    evaluatedAnswers[answer.questionId] = {
      selectedAnswer: answer.selectedAnswer,
      isCorrect,
      marks: isCorrect ? marks : 0,
    };
  }

  // Create TestAttempt record
  const attemptNumber = existingAttempts + 1;
  const testAttempt = await prisma.testAttempt.create({
    data: {
      testId,
      studentId: userId,
      attemptNumber,
      status: "submitted",
      score: totalScore,
      maxScore: test.totalMarks,
      submittedAt: new Date(),
      evaluatedAt: new Date(),
      answers: evaluatedAnswers,
    },
  });

  // Return result
  const percentage =
    test.totalMarks > 0 ? (totalScore / test.totalMarks) * 100 : 0;

  return {
    score: totalScore,
    maxScore: test.totalMarks,
    correctCount,
    totalQuestions: answers.length,
    percentage: Math.round(percentage * 100) / 100,
    status: "submitted",
  };
}

/**
 * Get student's previous attempt on a test
 */
export async function getTestAttempt(
  userId: string,
  testId: string,
  attemptNumber?: number
): Promise<TestAttempt | null> {
  const whereClause: any = {
    testId,
    studentId: userId,
  };

  if (attemptNumber !== undefined) {
    whereClause.attemptNumber = attemptNumber;
  }

  return prisma.testAttempt.findFirst({
    where: whereClause,
    orderBy: { attemptNumber: "desc" },
  });
}
