import { prisma } from "../../config/auth.js";
import type { Role } from "../../generated/prisma/client.js";

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
  departmentId?: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  image?: string;
  role?: Role;
  departmentId?: string | null;
}

export interface BulkUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
  departmentId?: string;
}

export class UserService {
  /**
   * Get all users with optional filters
   */
  static async getAllUsers(filters?: {
    role?: Role;
    departmentId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { role, departmentId, search, page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role) where.role = role;
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
          batch: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
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
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        batch: true,
      },
    });
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, data: UpdateUserInput) {
    return prisma.user.update({
      where: { id: userId },
      data,
      include: {
        department: true,
        batch: true,
      },
    });
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
    return prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        department: true,
        batch: true,
      },
    });
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

    return prisma.user.update({
      where: { id: userId },
      data: { departmentId },
      include: {
        department: true,
        batch: true,
      },
    });
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
