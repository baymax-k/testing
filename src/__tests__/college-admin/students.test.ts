import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  mockUsers,
  mockDepartment,
  mockBatch,
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
const { prisma, auth } = await import("../../config/auth.js");
const app = (await import("../../app.js")).default;

describe("College Admin - Student Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/college-admin/students", () => {
    it("should create a new student", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(mockDepartment as any);
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
      
      const mockCreateUser = vi.fn().mockResolvedValue({
        user: {
          id: "new_student_id",
          email: "newstudent@test.com",
          name: "New Student",
          role: "student",
        },
      });
      vi.spyOn(auth.api, "signUpEmail").mockImplementation(mockCreateUser as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUsers.student,
        email: "newstudent@test.com",
        name: "New Student",
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "newstudent@test.com",
          name: "New Student",
          departmentId: "dept_test_id",
          password: "Student@123",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.student).toBeDefined();
    });

    it("should return 400 if email already exists", async () => {
      // Mock Better Auth to throw error for duplicate email
      vi.spyOn(auth.api, "signUpEmail").mockRejectedValue(
        new Error("Email already exists")
      );

      const response = await request(app as Express)
        .post("/api/college-admin/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "existing@test.com",
          name: "Existing Student",
          departmentId: "dept_test_id",
          password: "Student@123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already exists");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "invalid-email",
          name: "Student",
          departmentId: "dept_test_id",
          password: "Student@123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 if department not found", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

      const response = await request(app as Express)
        .post("/api/college-admin/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          email: "newstudent@test.com",
          name: "New Student",
          departmentId: "invalid_dept_id",
          password: "Student@123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("not found");
    });
  });

  describe("POST /api/college-admin/students/bulk", () => {
    it("should create multiple students", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(mockDepartment as any);
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const mockCreateUser = vi.fn()
        .mockResolvedValueOnce({
          user: { id: "student1_id", email: "student1@test.com", role: "student" },
        })
        .mockResolvedValueOnce({
          user: { id: "student2_id", email: "student2@test.com", role: "student" },
        });
      vi.spyOn(auth.api, "signUpEmail").mockImplementation(mockCreateUser as any);

      vi.spyOn(prisma.user, "update")
        .mockResolvedValueOnce({ ...mockUsers.student, email: "student1@test.com" } as any)
        .mockResolvedValueOnce({ ...mockUsers.student, email: "student2@test.com" } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/students/bulk")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          students: [
            {
              email: "student1@test.com",
              name: "Student One",
              password: "Student@123",
            },
            {
              email: "student2@test.com",
              name: "Student Two",
              password: "Student@123",
            },
          ],
          departmentId: "dept_test_id",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.students.length).toBe(2);
    });

    it("should return 400 if more than 100 students", async () => {
      const students = Array.from({ length: 101 }, (_, i) => ({
        email: `student${i}@test.com`,
        name: `Student ${i}`,
        password: "Student@123",
      }));

      const response = await request(app as Express)
        .post("/api/college-admin/students/bulk")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          students,
          departmentId: "dept_test_id",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 if duplicate emails in request", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(mockDepartment as any);
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const response = await request(app as Express)
        .post("/api/college-admin/students/bulk")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          students: [
            {
              email: "duplicate@test.com",
              name: "Student One",
              password: "Student@123",
            },
            {
              email: "duplicate@test.com",
              name: "Student Two",
              password: "Student@123",
            },
          ],
          departmentId: "dept_test_id",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain("duplicate");
    });
  });

  describe("GET /api/college-admin/students", () => {
    it("should list all students", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([
        {
          ...mockUsers.student,
          department: mockDepartment,
          batch: mockBatch,
        },
      ] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.students).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter students by department", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.student] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/students?departmentId=dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should filter students by batch", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.student] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/students?batchId=batch_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should search students by name or email", async () => {
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.student] as any);
      vi.spyOn(prisma.user, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/students?search=test")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /api/college-admin/students/:studentId", () => {
    it("should get student by ID", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUsers.student,
        department: mockDepartment,
        batch: mockBatch,
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/students/test_student_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.student).toBeDefined();
    });

    it("should return 404 for non-existent student", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .get("/api/college-admin/students/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });

    it("should return 400 if user is not a student", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.mentor as any);

      const response = await request(app as Express)
        .get("/api/college-admin/students/test_mentor_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("student");
    });
  });

  describe("PUT /api/college-admin/students/:studentId", () => {
    it("should update student successfully", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.student as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUsers.student,
        name: "Updated Student Name",
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/students/test_student_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Student Name",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.student.name).toBe("Updated Student Name");
    });

    it("should return 404 for non-existent student", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .put("/api/college-admin/students/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/college-admin/students/:studentId", () => {
    it("should delete student successfully", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.student as any);
      vi.spyOn(prisma.user, "delete").mockResolvedValue(mockUsers.student as any);

      const response = await request(app as Express)
        .delete("/api/college-admin/students/test_student_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 404 for non-existent student", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .delete("/api/college-admin/students/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });
  });
});
