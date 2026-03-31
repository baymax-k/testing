import { prisma } from "../../config/auth.js";

export interface CreateDepartmentInput {
  name: string;
  code: string;
  description?: string;
  hodId?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  description?: string;
  hodId?: string | null;
}

/**
 * Helper: Check if department name or code already exists
 */
async function checkDepartmentUniqueness(
  deptId: string,
  data: UpdateDepartmentInput
): Promise<void> {
  if (!data.name && !data.code) {
    return;
  }

  const orConditions = [];
  if (data.name) orConditions.push({ name: data.name });
  if (data.code) orConditions.push({ code: data.code });

  const existing = await prisma.department.findFirst({
    where: {
      AND: [
        { id: { not: deptId } },
        { OR: orConditions },
      ],
    },
  });

  if (existing) {
    const conflictField = existing.code === data.code ? "code" : "name";
    throw new Error(`Department ${conflictField} already exists`);
  }
}

/**
 * Helper: Validate HOD user assignment
 */
async function validateHodAssignment(hodId: string | null | undefined): Promise<void> {
  if (hodId === undefined || hodId === null) {
    return;
  }

  const hod = await prisma.user.findUnique({
    where: { id: hodId },
  });

  if (!hod) {
    throw new Error("HOD user not found");
  }

  if (hod.role !== "hod" && hod.role !== "college_admin") {
    throw new Error("Assigned user must have HOD or College Admin role");
  }
}

/**
 * Helper: Update HOD user's department assignment
 * When a HOD is assigned to a department, ensure the HOD user's departmentId matches the department ID
 */
async function updateHodDepartmentAssignment(
  hodId: string | null | undefined,
  departmentId: string
): Promise<void> {
  if (!hodId) {
    return;
  }

  await prisma.user.update({
    where: { id: hodId },
    data: { departmentId },
  });
}

export class DepartmentService {
  /**
   * Create a new department
   */
  static async createDepartment(data: CreateDepartmentInput) {
    // Check if code or name already exists
    const existing = await prisma.department.findFirst({
      where: {
        OR: [{ code: data.code }, { name: data.name }],
      },
    });

    if (existing) {
      throw new Error(
        existing.code === data.code
          ? "Department code already exists"
          : "Department name already exists"
      );
    }

    // If hodId is provided, verify the user exists and has appropriate role
    if (data.hodId) {
      const hod = await prisma.user.findUnique({
        where: { id: data.hodId },
      });

      if (!hod) {
        throw new Error("HOD user not found");
      }

      if (hod.role !== "hod" && hod.role !== "college_admin") {
        throw new Error("Assigned user must have HOD or College Admin role");
      }
    }

    // Create department first to get its ID
    const department = await prisma.department.create({
      data,
      include: {
        users: true,
      },
    });

    // Update HOD's departmentId to match this department's ID
    if (data.hodId) {
      await updateHodDepartmentAssignment(data.hodId, department.id);
    }

    // Return updated department (refetch to ensure we have latest data)
    return prisma.department.findUnique({
      where: { id: department.id },
      include: {
        users: true,
      },
    });
  }

  /**
   * Get all departments with optional filters
   */
  static async getAllDepartments(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.department.count({ where }),
    ]);

    const departmentIds = departments.map((dept) => dept.id);

    const [studentCounts, batchCounts] = await Promise.all([
      prisma.user.groupBy({
        by: ["departmentId"],
        where: {
          departmentId: { in: departmentIds },
          role: "student",
        },
        _count: { _all: true },
      }),
      prisma.batch.groupBy({
        by: ["departmentId"],
        where: {
          departmentId: { in: departmentIds },
        },
        _count: { _all: true },
      }),
    ]);

    const studentCountMap = studentCounts.reduce<Record<string, number>>((acc, curr) => {
      if (curr.departmentId) acc[curr.departmentId] = curr._count._all;
      return acc;
    }, {});

    const batchCountMap = batchCounts.reduce<Record<string, number>>((acc, curr) => {
      if (curr.departmentId) acc[curr.departmentId] = curr._count._all;
      return acc;
    }, {});

    const departmentsWithCounts = departments.map((dept) => ({
      ...dept,
      totalStudents: studentCountMap[dept.id] || 0,
      totalBatches: batchCountMap[dept.id] || 0,
    }));

    return {
      departments: departmentsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get department by ID
   */
  static async getDepartmentById(deptId: string) {
    const department = await prisma.department.findUnique({
      where: { id: deptId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            image: true,
          },
        },
      },
    });

    if (!department) return null;

    const [totalStudents, totalBatches] = await Promise.all([
      prisma.user.count({ where: { departmentId: deptId, role: "student" } }),
      prisma.batch.count({ where: { departmentId: deptId } }),
    ]);

    return {
      ...department,
      totalStudents,
      totalBatches,
    };
  }

  /**
   * Update department
   */
  static async updateDepartment(deptId: string, data: UpdateDepartmentInput) {
    const department = await prisma.department.findUnique({
      where: { id: deptId },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    // Check for unique constraint violations using helper
    await checkDepartmentUniqueness(deptId, data);

    // Validate HOD assignment using helper
    await validateHodAssignment(data.hodId);

    // If hodId is being changed, update the new HOD's departmentId
    if (data.hodId !== undefined && data.hodId !== department.hodId) {
      if (data.hodId) {
        // New HOD is being assigned - update their departmentId
        await updateHodDepartmentAssignment(data.hodId, deptId);
      }
      // Note: If hodId is being set to null, we don't clear the previous HOD's departmentId
      // as they might have other roles or responsibilities in that department
    }

    return prisma.department.update({
      where: { id: deptId },
      data,
      include: {
        users: true,
      },
    });
  }

  /**
   * Delete department
   */
  static async deleteDepartment(deptId: string) {
    const department = await prisma.department.findUnique({
      where: { id: deptId },
      include: {
        users: true,
      },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    // Check if department has users
    if (department.users.length > 0) {
      throw new Error(
        `Cannot delete department with ${department.users.length} assigned users. Please reassign or remove users first.`
      );
    }

    return prisma.department.delete({
      where: { id: deptId },
    });
  }

  /**
   * Get department statistics
   */
  static async getDepartmentStats(deptId: string) {
    const department = await prisma.department.findUnique({
      where: { id: deptId },
      include: {
        users: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    const roleCount = department.users.reduce(
      (acc: Record<string, number>, user: any) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      departmentId: department.id,
      departmentName: department.name,
      totalUsers: department.users.length,
      roleBreakdown: roleCount,
    };
  }
}
