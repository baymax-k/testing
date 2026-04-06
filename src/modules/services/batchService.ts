import { prisma } from "../../config/auth.js";

export interface CreateBatchInput {
  name: string;
  code: string;
  year: number;
  semester?: number;
  departmentId: string;
  mentorId?: string;
}

export interface UpdateBatchInput {
  name?: string;
  code?: string;
  year?: number;
  semester?: number;
  mentorId?: string;
}

export interface AssignStudentsToBatchInput {
  studentIds: string[];
}

/**
 * Helper: Validate mentor assignment for batch
 */
async function validateBatchMentorAssignment(
  mentorId: string,
  departmentId: string
): Promise<void> {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
  });

  if (!mentor) {
    throw new Error("Mentor not found");
  }

  if (mentor.role !== "mentor" && mentor.role !== "dept_admin" && mentor.role !== "hod") {
    throw new Error("Only mentors, dept_admin, or HOD can be assigned as batch mentors");
  }

  if (mentor.departmentId !== departmentId) {
    throw new Error("Mentor must belong to the same department as the batch");
  }
}

/**
 * Helper: Check batch code uniqueness within department
 */
async function checkBatchCodeUniqueness(
  code: string,
  departmentId: string,
  currentCode: string
): Promise<void> {
  if (code === currentCode) {
    return;
  }

  const existingBatch = await prisma.batch.findUnique({
    where: {
      code_departmentId: {
        code,
        departmentId,
      },
    },
  });

  if (existingBatch) {
    throw new Error("Batch with this code already exists in the department");
  }
}

export class BatchService {
  /**
   * Create a new batch
   */
  static async createBatch(data: CreateBatchInput) {
    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    // If mentorId provided, verify mentor exists and has correct role
    if (data.mentorId) {
      const mentor = await prisma.user.findUnique({
        where: { id: data.mentorId },
      });

      if (!mentor) {
        throw new Error("Mentor not found");
      }

      if (mentor.role !== "mentor" && mentor.role !== "dept_admin" && mentor.role !== "hod") {
        throw new Error("Only mentors, dept_admin, or HOD can be assigned as batch mentors");
      }

      // Verify mentor belongs to the same department
      if (mentor.departmentId !== data.departmentId) {
        throw new Error("Mentor must belong to the same department as the batch");
      }
    }

    // Check if batch with same code exists in the department
    const existingBatch = await prisma.batch.findUnique({
      where: {
        code_departmentId: {
          code: data.code,
          departmentId: data.departmentId,
        },
      },
    });

    if (existingBatch) {
      throw new Error("Batch with this code already exists in the department");
    }

    return await prisma.batch.create({
      data: {
        name: data.name,
        code: data.code,
        year: data.year,
        semester: data.semester,
        departmentId: data.departmentId,
        mentorId: data.mentorId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });
  }

  /**
   * Get all batches with optional filtering
   */
  static async getAllBatches(filters?: {
    departmentId?: string;
    year?: number;
    semester?: number;
    mentorId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.year) {
      where.year = filters.year;
    }

    if (filters?.semester) {
      where.semester = filters.semester;
    }

    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              students: true,
            },
          },
        },
        orderBy: [
          { year: 'desc' },
          { semester: 'desc' },
          { name: 'asc' },
        ],
      }),
      prisma.batch.count({ where }),
    ]);

    const batchesWithCounts = batches.map((batch) => ({
      ...batch,
      totalStudents: batch._count?.students ?? 0,
    }));

    return {
      batches: batchesWithCounts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get batch by ID
   */
  static async getBatchById(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    return batch;
  }

  /**
   * Update batch
   */
  static async updateBatch(batchId: string, data: UpdateBatchInput) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    // Validate mentor assignment using helper
    if (data.mentorId) {
      await validateBatchMentorAssignment(data.mentorId, batch.departmentId);
    }

    // Check code uniqueness using helper
    if (data.code) {
      await checkBatchCodeUniqueness(data.code, batch.departmentId, batch.code);
    }

    return await prisma.batch.update({
      where: { id: batchId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.semester !== undefined && { semester: data.semester }),
        ...(data.mentorId !== undefined && { mentorId: data.mentorId }),
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });
  }

  /**
   * Delete batch
   */
  static async deleteBatch(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    if (batch._count.students > 0) {
      throw new Error(`Cannot delete batch with ${batch._count.students} students assigned. Remove students first.`);
    }

    await prisma.batch.delete({
      where: { id: batchId },
    });

    return { message: "Batch deleted successfully" };
  }

  /**
   * Assign students to batch
   */
  static async assignStudentsToBatch(batchId: string, data: AssignStudentsToBatchInput) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    // Verify all students exist and have student role
    const students = await prisma.user.findMany({
      where: {
        id: {
          in: data.studentIds,
        },
      },
    });

    if (students.length !== data.studentIds.length) {
      throw new Error("One or more students not found");
    }

    const nonStudents = students.filter((user: any) => user.role !== "student");
    if (nonStudents.length > 0) {
      throw new Error("Only users with student role can be assigned to batches");
    }

    // Verify all students belong to the same department as the batch
    const wrongDepartment = students.filter(
      (student: any) => student.departmentId !== batch.departmentId
    );
    if (wrongDepartment.length > 0) {
      throw new Error("All students must belong to the same department as the batch");
    }

    // Assign students to batch
    await prisma.user.updateMany({
      where: {
        id: {
          in: data.studentIds,
        },
      },
      data: {
        batchId: batchId,
      },
    });

    return await this.getBatchById(batchId);
  }

  /**
   * Remove students from batch
   */
  static async removeStudentsFromBatch(batchId: string, studentIds: string[]) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    // Verify students are in this batch
    const students = await prisma.user.findMany({
      where: {
        id: {
          in: studentIds,
        },
        batchId: batchId,
      },
    });

    if (students.length !== studentIds.length) {
      throw new Error("One or more students not found in this batch");
    }

    // Remove students from batch
    await prisma.user.updateMany({
      where: {
        id: {
          in: studentIds,
        },
      },
      data: {
        batchId: null,
      },
    });

    return await this.getBatchById(batchId);
  }

  /**
   * Assign mentor to batch
   */
  static async assignMentorToBatch(batchId: string, mentorId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
    });

    if (!mentor) {
      throw new Error("Mentor not found");
    }

    if (mentor.role !== "mentor" && mentor.role !== "dept_admin" && mentor.role !== "hod") {
      throw new Error("Only mentors, dept_admin, or HOD can be assigned as batch mentors");
    }

    // Verify mentor belongs to the same department
    if (mentor.departmentId !== batch.departmentId) {
      throw new Error("Mentor must belong to the same department as the batch");
    }

    return await prisma.batch.update({
      where: { id: batchId },
      data: {
        mentorId: mentorId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });
  }

  /**
   * Remove mentor from batch
   */
  static async removeMentorFromBatch(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    return await prisma.batch.update({
      where: { id: batchId },
      data: {
        mentorId: null,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });
  }

  /**
   * Get batch statistics
   */
  static async getBatchStats(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    return {
      totalStudents: batch._count.students,
      hasMentor: !!batch.mentorId,
      year: batch.year,
      semester: batch.semester,
    };
  }

  /**
   * List students mentored by a specific mentor (through batch assignment)
   */
  static async getStudentsByMentor(mentorId: string, options?: { page?: number; limit?: number }) {
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
      },
    });

    if (!mentor) {
      throw new Error("Mentor not found");
    }

    if (mentor.role !== "mentor" && mentor.role !== "dept_admin" && mentor.role !== "hod") {
      throw new Error("Only mentors, dept_admin, or HOD can have assigned students");
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 20;
    const skip = (page - 1) * limit;

    const where = {
      role: "student" as const,
      batch: {
        mentorId,
      },
    };

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          batch: {
            select: {
              id: true,
              name: true,
              code: true,
              year: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      mentor,
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
