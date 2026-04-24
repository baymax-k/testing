import { prisma } from "../../config/auth.js";
import { TestStatus, QuestionType } from "../../generated/prisma/client.js";

export interface CreateTestInput {
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes?: number;
  maxAttempts?: number;
  maximumMarks?: number;
  passingMarks?: number;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  departmentId?: string;
  batchId?: string;
  createdById: string;
}

export interface UpdateTestInput {
  title?: string;
  description?: string;
  instructions?: string;
  status?: TestStatus;
  durationMinutes?: number;
  maxAttempts?: number;
  totalMarks?: number;
  passingMarks?: number;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  departmentId?: string;
  batchId?: string;
}

export interface CreateQuestionInput {
  type: QuestionType;
  content: string;
  marks: number;
  options?: string[] | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  orderIndex?: number;
}

export interface UpdateQuestionInput {
  type?: QuestionType;
  content?: string;
  marks?: number;
  options?: string[] | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  orderIndex?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface TestFilters {
  status?: TestStatus;
  departmentId?: string;
  batchId?: string;
  createdById?: string;
  search?: string;
  timeFilter?: "upcoming" | "active" | "past" | "all"; // New time-based filter
}

/**
 * Helper: Validate test scheduling
 */
async function validateTestSchedule(
  scheduledStartTime?: Date,
  scheduledEndTime?: Date
): Promise<void> {
  if (scheduledStartTime && scheduledEndTime) {
    if (scheduledEndTime <= scheduledStartTime) {
      throw new Error("Scheduled end time must be after start time");
    }
  }

  if (scheduledStartTime && scheduledStartTime < new Date()) {
    throw new Error("Scheduled start time cannot be in the past");
  }
}

/**
 * Helper: Check if user has permission to manage test
 */
async function checkTestManagementPermission(
  userId: string,
  testId: string,
  allowedRoles: string[]
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Super admins and college admins can manage all tests
  if (allowedRoles.includes(user.role) || user.role === "product_admin" || user.role === "college_admin") {
    return true;
  }

  // Check if user created the test
  const test = await prisma.test.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new Error("Test not found");
  }

  if (test.createdById === userId) {
    return true;
  }

  // Check if test belongs to user's department (for HOD/dept_admin)
  if ((user.role === "hod" || user.role === "dept_admin") && user.departmentId === test.departmentId) {
    return true;
  }

  return false;
}

/**
 * Helper: Calculate total marks for test
 */
async function calculateTotalMarks(testId: string): Promise<number> {
  const questions = await prisma.question.findMany({
    where: { testId },
    select: { marks: true },
  });

  return questions.reduce((total, question) => total + question.marks, 0);
}

/**
 * Helper: Update test status based on schedule
 */
function determineTestStatus(
  currentStatus: TestStatus,
  scheduledStartTime?: Date | null,
  scheduledEndTime?: Date | null
): TestStatus {
  const now = new Date();

  // If test is manually archived or completed, keep that status
  if (currentStatus === "archived" || currentStatus === "completed") {
    return currentStatus;
  }

  // If no schedule, keep current status
  if (!scheduledStartTime || !scheduledEndTime) {
    return currentStatus;
  }

  // Auto-transition based on schedule
  if (now < scheduledStartTime) {
    return "scheduled";
  } else if (now >= scheduledStartTime && now <= scheduledEndTime) {
    return "active";
  } else {
    return "completed";
  }
}

export class TestService {
  /**
   * Create a new test
   */
  static async createTest(data: CreateTestInput) {
    // Validate scheduling
    await validateTestSchedule(data.scheduledStartTime, data.scheduledEndTime);

    // Verify creator exists
    const creator = await prisma.user.findUnique({
      where: { id: data.createdById },
    });

    if (!creator) {
      throw new Error("Creator not found");
    }

    // Verify department if provided
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error("Department not found");
      }
    }

    // Verify batch if provided
    if (data.batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: data.batchId },
      });

      if (!batch) {
        throw new Error("Batch not found");
      }
    }

    // Determine initial status
    let status: TestStatus = "draft";
    if (data.scheduledStartTime && data.scheduledEndTime) {
      status = determineTestStatus("draft", data.scheduledStartTime, data.scheduledEndTime);
    }

    const test = await prisma.test.create({
      data: {
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        status,
        durationMinutes: data.durationMinutes || 60,
        maxAttempts: data.maxAttempts || 1,
        totalMarks: data.maximumMarks ?? 0, // Provided cap or will be calculated as questions are added
        passingMarks: data.passingMarks,
        scheduledStartTime: data.scheduledStartTime,
        scheduledEndTime: data.scheduledEndTime,
        departmentId: data.departmentId,
        batchId: data.batchId,
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        questions: true,
      },
    });

    return test;
  }

  /**
   * Update a test
   */
  static async updateTest(testId: string, data: UpdateTestInput) {
    // Verify test exists
    const existingTest = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!existingTest) {
      throw new Error("Test not found");
    }

    // Validate scheduling if provided
    if (data.scheduledStartTime || data.scheduledEndTime) {
      await validateTestSchedule(
        data.scheduledStartTime || existingTest.scheduledStartTime || undefined,
        data.scheduledEndTime || existingTest.scheduledEndTime || undefined
      );
    }

    // Verify department if changing
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error("Department not found");
      }
    }

    // Verify batch if changing
    if (data.batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: data.batchId },
      });

      if (!batch) {
        throw new Error("Batch not found");
      }
    }

    // Update status based on schedule if time fields are being updated
    let status = data.status || existingTest.status;
    if (data.scheduledStartTime || data.scheduledEndTime) {
      status = determineTestStatus(
        status,
        data.scheduledStartTime || existingTest.scheduledStartTime,
        data.scheduledEndTime || existingTest.scheduledEndTime
      );
    }

    const test = await prisma.test.update({
      where: { id: testId },
      data: {
        ...data,
        status,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return test;
  }

  /**
   * Delete a test
   */
  static async deleteTest(testId: string) {
    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        attempts: true,
      },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    // Prevent deletion if test has attempts
    if (test.attempts.length > 0) {
      throw new Error(
        `Cannot delete test with ${test.attempts.length} student attempts. Archive it instead.`
      );
    }

    await prisma.test.delete({
      where: { id: testId },
    });

    return { message: "Test deleted successfully" };
  }

  /**
   * Get test by ID
   */
  static async getTestById(testId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        _count: {
          select: {
            attempts: true,
          },
        },
      },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    return test;
  }

  /**
   * Get all tests with pagination and filters
   */
  static async getTests(
    filters: TestFilters = {},
    options: PaginationOptions = {}
  ) {
    const rawPage = options.page ?? 1;
    const rawLimit = options.limit ?? 20;
    const rawSortBy = options.sortBy ?? "createdAt";
    const rawSortOrder = options.sortOrder ?? "desc";

    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 20;

    const allowedSortFields = new Set([
      "createdAt",
      "updatedAt",
      "title",
      "status",
      "scheduledStartTime",
      "scheduledEndTime",
      "totalMarks",
    ]);
    const sortBy = allowedSortFields.has(rawSortBy) ? rawSortBy : "createdAt";
    const sortOrder: "asc" | "desc" = rawSortOrder === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.batchId) {
      where.batchId = filters.batchId;
    }

    if (filters.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Time-based filtering
    const now = new Date();
    if (filters.timeFilter) {
      switch (filters.timeFilter) {
        case "upcoming":
          // Tests scheduled to start in the future
          where.scheduledStartTime = { gt: now };
          where.status = { in: ["draft", "scheduled"] };
          break;
        case "active":
          // Tests currently running
          where.scheduledStartTime = { lte: now };
          where.scheduledEndTime = { gte: now };
          where.status = { notIn: ["archived"] };
          break;
        case "past":
          // Tests that have ended
          where.OR = [
            { scheduledEndTime: { lt: now } },
            { status: "completed" },
          ];
          break;
        // "all" means no time filter
      }
    }

    // Get total count
    const total = await prisma.test.count({ where });

    // Get tests
    const tests = await prisma.test.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            questions: true,
            attempts: true,
          },
        },
      },
    });

    // Auto-update stale test statuses
    const updatedTests = await Promise.all(
      tests.map(async (test) => {
        const currentStatus = determineTestStatus(
          test.status,
          test.scheduledStartTime,
          test.scheduledEndTime
        );

        // Update in database if status changed
        if (currentStatus !== test.status) {
          await prisma.test.update({
            where: { id: test.id },
            data: { status: currentStatus },
          });

          return { ...test, status: currentStatus };
        }

        return test;
      })
    );

    return {
      tests: updatedTests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add question to test
   */
  static async addQuestion(testId: string, data: CreateQuestionInput) {
    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    // Don't allow adding questions to active or completed tests
    if (test.status === "active" || test.status === "completed") {
      throw new Error(`Cannot add questions to ${test.status} test`);
    }

    // Get current question count for order index
    const questionCount = await prisma.question.count({
      where: { testId },
    });

    const question = await prisma.question.create({
      data: {
        testId,
        type: data.type,
        content: data.content,
        marks: data.marks,
        options: data.options ?? undefined,
        correctAnswer: data.correctAnswer ?? undefined,
        explanation: data.explanation ?? undefined,
        orderIndex: data.orderIndex ?? questionCount,
      },
    });

    // Update test total marks
    const totalMarks = await calculateTotalMarks(testId);
    await prisma.test.update({
      where: { id: testId },
      data: { totalMarks },
    });

    return question;
  }

  /**
   * Update question
   */
  static async updateQuestion(questionId: string, data: UpdateQuestionInput) {
    // Verify question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
      include: { test: true },
    });

    if (!existingQuestion) {
      throw new Error("Question not found");
    }

    if (!existingQuestion.test || !existingQuestion.testId) {
      throw new Error("Question is not associated with a test");
    }

    const questionTest = existingQuestion.test;
    const questionTestId = existingQuestion.testId;

    // Don't allow editing questions in active or completed tests
    if (
      questionTest.status === "active" ||
      questionTest.status === "completed"
    ) {
      throw new Error(`Cannot edit questions in ${questionTest.status} test`);
    }

    const updateData: any = { ...data };
    if (data.options === null) {
      updateData.options = undefined;
    }
    if (data.correctAnswer === null) {
      updateData.correctAnswer = undefined;
    }
    if (data.explanation === null) {
      updateData.explanation = undefined;
    }

    const question = await prisma.question.update({
      where: { id: questionId },
      data: updateData,
    });

    // Update test total marks if marks changed
    if (data.marks !== undefined) {
      const totalMarks = await calculateTotalMarks(questionTestId);
      await prisma.test.update({
        where: { id: questionTestId },
        data: { totalMarks },
      });
    }

    return question;
  }

  /**
   * Delete question
   */
  static async deleteQuestion(questionId: string) {
    // Verify question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { test: true },
    });

    if (!question) {
      throw new Error("Question not found");
    }

    if (!question.test || !question.testId) {
      throw new Error("Question is not associated with a test");
    }

    const questionTest = question.test;
    const questionTestId = question.testId;

    // Don't allow deleting questions from active or completed tests
    if (questionTest.status === "active" || questionTest.status === "completed") {
      throw new Error(`Cannot delete questions from ${questionTest.status} test`);
    }

    await prisma.question.delete({
      where: { id: questionId },
    });

    // Update test total marks
    const totalMarks = await calculateTotalMarks(questionTestId);
    await prisma.test.update({
      where: { id: questionTestId },
      data: { totalMarks },
    });

    return { message: "Question deleted successfully" };
  }

  /**
   * Get test questions
   */
  static async getTestQuestions(testId: string) {
    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    const questions = await prisma.question.findMany({
      where: { testId },
      orderBy: { orderIndex: "asc" },
    });

    return questions;
  }

  /**
   * Reorder questions
   */
  static async reorderQuestions(testId: string, questionIds: string[]) {
    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    // Don't allow reordering questions in active or completed tests
    if (test.status === "active" || test.status === "completed") {
      throw new Error(`Cannot reorder questions in ${test.status} test`);
    }

    // Verify all questions belong to this test
    const questions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        testId,
      },
    });

    if (questions.length !== questionIds.length) {
      throw new Error("Some questions do not belong to this test");
    }

    // Update order indices
    const updatePromises = questionIds.map((questionId, index) =>
      prisma.question.update({
        where: { id: questionId },
        data: { orderIndex: index },
      })
    );

    await Promise.all(updatePromises);

    return { message: "Questions reordered successfully" };
  }

  /**
   * Get test status with real-time calculation
   */
  static async getTestStatus(testId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
          },
        },
      },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    // Calculate real-time status based on schedule
    const currentStatus = determineTestStatus(
      test.status,
      test.scheduledStartTime,
      test.scheduledEndTime
    );

    // Update if status changed
    if (currentStatus !== test.status) {
      await prisma.test.update({
        where: { id: testId },
        data: { status: currentStatus },
      });
    }

    return {
      id: test.id,
      title: test.title,
      status: currentStatus,
      durationMinutes: test.durationMinutes,
      maxAttempts: test.maxAttempts,
      totalMarks: test.totalMarks,
      passingMarks: test.passingMarks,
      questionCount: test._count.questions,
      attemptCount: test._count.attempts,
      scheduledStartTime: test.scheduledStartTime,
      scheduledEndTime: test.scheduledEndTime,
      isEditable: currentStatus === "draft" || currentStatus === "scheduled",
      isActive: currentStatus === "active",
      isCompleted: currentStatus === "completed",
      isArchived: currentStatus === "archived",
    };
  }

  /**
   * Assign a test to a batch
   */
  static async assignTestToBatch(testId: string, batchId: string) {
    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        department: true,
      },
    });

    if (!test) {
      throw new Error("Test not found");
    }

    // Verify batch exists
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        department: true,
      },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    // Verify batch and test are in the same department (if test has a department)
    if (test.departmentId && batch.departmentId !== test.departmentId) {
      throw new Error("Batch and test must be in the same department");
    }

    // Update test with new batch
    const updatedTest = await prisma.test.update({
      where: { id: testId },
      data: { batchId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return updatedTest;
  }
}

