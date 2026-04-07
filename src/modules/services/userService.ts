import { prisma } from "../../config/auth.js";
import type { Role } from "../../generated/prisma/client.js";

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
  collegeId?: string;
  departmentId?: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  image?: string;
  role?: Role;
  collegeId?: string | null;
  departmentId?: string | null;
}

export interface BulkUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
  collegeId?: string;
  departmentId?: string;
}

export class UserService {
  /**
   * Get all users with optional filters
   */
  static async getAllUsers(filters?: {
    role?: Role;
    collegeId?: string;
    departmentId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { role, collegeId, departmentId, search, page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role) where.role = role;
    if (collegeId) where.collegeId = collegeId;
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: true,
          batch: {
            include: {
              mentor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    // Add mentorName for students
    const usersWithMentorName = users.map((user) => ({
      ...user,
      mentorName: user.batch?.mentor?.name || null,
    }));

    let usersWithExtras = usersWithMentorName;

    if (role === "mentor" && usersWithMentorName.length > 0) {
      const mentorIds = usersWithMentorName.map((user) => user.id);
      const mentorBatches = await prisma.batch.findMany({
        where: {
          mentorId: {
            in: mentorIds,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          mentorId: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      const studentsCountByMentorId = mentorBatches.reduce<Record<string, number>>((acc, batch) => {
        if (!batch.mentorId) return acc;
        acc[batch.mentorId] = (acc[batch.mentorId] || 0) + batch._count.students;
        return acc;
      }, {});

      const batchIdsByMentorId = mentorBatches.reduce<Record<string, string[]>>((acc, batch) => {
        if (!batch.mentorId) return acc;
        if (!acc[batch.mentorId]) {
          acc[batch.mentorId] = [];
        }
        acc[batch.mentorId].push(batch.id);
        return acc;
      }, {});

      usersWithExtras = usersWithMentorName.map((user) => ({
        ...user,
        // For mentors, return batchId based on Batch.mentorId relation.
        batchId: user.batchId || batchIdsByMentorId[user.id]?.[0] || null,
        assignedBatchIds: batchIdsByMentorId[user.id] || [],
        assignedStudentsCount: studentsCountByMentorId[user.id] || 0,
      }));
    }

    return {
      users: usersWithExtras,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        batch: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    let assignedStudentsCount: number | undefined;
    if (user.role === "mentor") {
      assignedStudentsCount = await prisma.user.count({
        where: {
          role: "student",
          batch: {
            mentorId: user.id,
          },
        },
      });
    }

    return {
      ...user,
      mentorName: user.batch?.mentor?.name || null,
      ...(assignedStudentsCount === undefined ? {} : { assignedStudentsCount }),
    };
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, data: UpdateUserInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      include: {
        department: true,
        batch: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      ...user,
      mentorName: user.batch?.mentor?.name || null,
    };
  }

  /**
   * Delete user
   */
  static async deleteUser(userId: string) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Don't allow deleting product admins
    if (user.role === "product_admin") {
      throw new Error("Cannot delete product admin users");
    }

    return prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Assign role to user
   */
  static async assignRole(userId: string, role: Role) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        department: true,
        batch: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      ...user,
      mentorName: user.batch?.mentor?.name || null,
    };
  }

  /**
   * Assign department to user
   */
  static async assignDepartment(userId: string, departmentId: string | null) {
    // Verify department exists if departmentId is provided
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        throw new Error("Department not found");
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { departmentId },
      include: {
        department: true,
        batch: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      ...user,
      mentorName: user.batch?.mentor?.name || null,
    };
  }

  /**
   * Get users by role
   */
  static async getUsersByRole(role: Role) {
    return prisma.user.findMany({
      where: { role },
      include: {
        department: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get users by department
   */
  static async getUsersByDepartment(departmentId: string) {
    return prisma.user.findMany({
      where: { departmentId },
      include: {
        department: true,
      },
      orderBy: { name: "asc" },
    });
  }
}
