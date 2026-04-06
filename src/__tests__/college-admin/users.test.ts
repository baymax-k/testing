import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  mockUsers,
  mockDepartment,
  createAuthHeaders,
} from "../helpers/mockData.js";

// Mock Prisma and Auth
vi.mock("../../config/auth.js", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    batch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    test: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    handler: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = mockUsers.collegeAdmin;
    next();
  },
  requireCollegeAdminAuth: (req: any, res: any, next: any) => {
    req.user = mockUsers.collegeAdmin;
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ error: "Forbidden" });
    }
  },
}));

// Import after mocks
const { prisma, auth } = await import("../../config/auth");
const app = (await import("../../app.js")).default;

describe("College Admin - User Management Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/college-admin/users", () => {
    it("should create a new user", async () => {
      const mockCreateUser = vi.fn().mockResolvedValue({
        user: {
          id: "new_user_id",
          email: "newuser@test.com",
          name: "New User",
          role: "student",
        },
      });
      vi.spyOn(auth.api, "signUpEmail").mockImplementation(mockCreateUser as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({
        id: "new_user_id",
        email: "newuser@test.com",
        name: "New User",
        role: "mentor",
        emailVerified: true,
        image: null,
        phone: null,
        batchId: null,
        departmentId: null,
        collegeId: "college_test_id",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/users")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "newuser@test.com",
          name: "New User",
          password: "User@123",
          role: "mentor",
          collegeId: "college_test_id",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            collegeId: "college_test_id",
          }),
        })
      );

      expect(response.body.user.collegeId).toBe("college_test_id");

      const updateCall = (prisma.user.update as any).mock.calls[0]?.[0];
      expect(updateCall?.data?.passwordHash).not.toBe("");
    });

    it("should return 400 if email already exists", async () => {
      // Mock Better Auth to throw error for duplicate email
      vi.spyOn(auth.api, "signUpEmail").mockRejectedValue(
        new Error("Email already exists")
      );

      const response = await request(app as Express)
        .post("/api/college-admin/users")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "existing@test.com",
          name: "Existing User",
          password: "User@123",
          role: "mentor",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already exists");
    });

    it("should return 400 for invalid role", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/users")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "newuser@test.com",
          name: "New User",
          password: "User@123",
          role: "invalid_role",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/college-admin/users/bulk", () => {
    it("should create multiple users", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const mockCreateUser = vi.fn()
        .mockResolvedValueOnce({
          user: { id: "user1_id", email: "user1@test.com", role: "mentor" },
        })
        .mockResolvedValueOnce({
          user: { id: "user2_id", email: "user2@test.com", role: "instructor_staff" },
        });
      vi.spyOn(auth.api, "signUpEmail").mockImplementation(mockCreateUser as any);

      vi.spyOn(prisma.user, "update")
        .mockResolvedValueOnce({
          id: "user1_id",
          email: "user1@test.com",
          name: "User One",
          role: "mentor",
          emailVerified: true,
          image: null,
          phone: null,
          batchId: null,
          departmentId: null,
          collegeId: "college_test_id",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: "user2_id",
          email: "user2@test.com",
          name: "User Two",
          role: "instructor_staff",
          emailVerified: true,
          image: null,
          phone: null,
          batchId: null,
          departmentId: null,
          collegeId: "college_test_id",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/users/bulk")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          users: [
            {
              email: "user1@test.com",
              name: "User One",
              password: "User@123",
              role: "mentor",
              collegeId: "college_test_id",
            },
            {
              email: "user2@test.com",
              name: "User Two",
              password: "User@123",
              role: "instructor_staff",
              collegeId: "college_test_id",
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.results.success.length).toBe(2);

      const updateCalls = (prisma.user.update as any).mock.calls;
      expect(updateCalls).toHaveLength(2);
      for (const [callArg] of updateCalls) {
        expect(callArg?.data?.passwordHash).toEqual(expect.any(String));
        expect(callArg?.data?.passwordHash).not.toBe("");
        expect(callArg?.data?.collegeId).toBe("college_test_id");
      }

      expect(response.body.results.success[0].user.collegeId).toBe("college_test_id");
      expect(response.body.results.success[1].user.collegeId).toBe("college_test_id");
    });

    it("should return 400 if more than 100 users", async () => {
      const users = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@test.com`,
        name: `User ${i}`,
        password: "User@123",
        role: "mentor",
      }));

      const response = await request(app as Express)
        .post("/api/college-admin/users/bulk")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({ users });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("GET /api/college-admin/users", () => {
    it("should list all users", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([
        mockUsers.mentor,
        mockUsers.student,
      ] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(2);

      const response = await request(app as Express)
        .get("/api/college-admin/users")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter users by role", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.mentor] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(1);
      vi.spyOn(prisma.batch, "findMany").mockResolvedValue([
        {
          id: "mentor_assigned_batch_1",
          mentorId: mockUsers.mentor.id,
          _count: {
            students: 12,
          },
        },
      ] as any);

      const response = await request(app as Express)
        .get("/api/college-admin/users?role=mentor")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users[0].assignedStudentsCount).toBe(12);
      expect(response.body.users[0].batchId).toBe("mentor_assigned_batch_1");
      expect(response.body.users[0].assignedBatchIds).toEqual(["mentor_assigned_batch_1"]);
    });

    it("should filter users by department", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.student] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/users?departmentId=dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /api/college-admin/users/:userId", () => {
    it("should get user by ID", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUsers.mentor,
        department: mockDepartment,
      } as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(12);

      const response = await request(app as Express)
        .get("/api/college-admin/users/test_mentor_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.assignedStudentsCount).toBe(12);
    });

    it("should return 404 for non-existent user", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .get("/api/college-admin/users/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/college-admin/users/:userId", () => {
    it("should update user successfully", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.mentor as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUsers.mentor,
        name: "Updated Name",
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/users/test_mentor_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe("Updated Name");
    });

    it("should update user role", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.mentor as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUsers.mentor,
        role: "instructor_staff",
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/users/test_mentor_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          role: "instructor_staff",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("DELETE /api/college-admin/users/:userId", () => {
    it("should delete user successfully", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.mentor as any);
      vi.spyOn(prisma.user, "delete").mockResolvedValue(mockUsers.mentor as any);

      const response = await request(app as Express)
        .delete("/api/college-admin/users/test_mentor_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 404 for non-existent user", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .delete("/api/college-admin/users/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });
  });
});
