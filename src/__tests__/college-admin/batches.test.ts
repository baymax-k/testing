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
const { prisma } = await import("../../config/auth.js");
const app = (await import("../../app.js")).default;

describe("College Admin - Batch Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/college-admin/batches", () => {
    it("should create a new batch", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(mockDepartment as any);
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.batch, "create").mockResolvedValue({
        ...mockBatch,
        department: mockDepartment,
        mentor: null,
        _count: { students: 0 },
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/batches")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "2024 Batch A",
          code: "CSE2024A",
          year: 2,
          semester: 3,
          departmentId: "dept_test_id",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.batch).toBeDefined();
      expect(response.body.batch.code).toBe("CSE2024A");
    });

    it("should return 400 if batch code already exists in department", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(mockDepartment as any);
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(mockBatch as any);

      const response = await request(app as Express)
        .post("/api/college-admin/batches")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "2024 Batch B",
          code: "CSE2024A", // Already exists
          year: 2,
          departmentId: "dept_test_id",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already exists");
    });

    it("should return 400 for invalid year", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/batches")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "2024 Batch A",
          code: "CSE2024A",
          year: 5, // Invalid year (max 4)
          departmentId: "dept_test_id",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 if department not found", async () => {
      vi.spyOn(prisma.department, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .post("/api/college-admin/batches")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "2024 Batch A",
          code: "CSE2024A",
          year: 2,
          departmentId: "invalid_dept_id",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("not found");
    });
  });

  describe("GET /api/college-admin/batches", () => {
    it("should list all batches", async () => {
      vi.spyOn(prisma.batch, "findMany").mockResolvedValue([
        {
          ...mockBatch,
          department: mockDepartment,
          mentor: mockUsers.mentor,
          _count: { students: 25 },
        },
      ] as any);
      vi.spyOn(prisma.batch, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/batches")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.batches).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter batches by department", async () => {
      vi.spyOn(prisma.batch, "findMany").mockResolvedValue([
        {
          ...mockBatch,
          department: mockDepartment,
          mentor: null,
          _count: { students: 25 },
        },
      ] as any);
      vi.spyOn(prisma.batch, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/batches?departmentId=dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should filter batches by year", async () => {
      vi.spyOn(prisma.batch, "findMany").mockResolvedValue([
        {
          ...mockBatch,
          department: mockDepartment,
          mentor: null,
          _count: { students: 25 },
        },
      ] as any);
      vi.spyOn(prisma.batch, "count").mockResolvedValue(1);

      const response = await request(app as Express)
        .get("/api/college-admin/batches?year=2")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /api/college-admin/batches/:batchId", () => {
    it("should get batch by ID", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue({
        ...mockBatch,
        department: mockDepartment,
        mentor: mockUsers.mentor,
        students: [mockUsers.student],
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/batches/batch_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.batch.id).toBe("batch_test_id");
    });

    it("should return 404 for non-existent batch", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .get("/api/college-admin/batches/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/college-admin/batches/:batchId", () => {
    it("should update batch successfully", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(mockBatch as any);
      vi.spyOn(prisma.batch, "update").mockResolvedValue({
        ...mockBatch,
        name: "Updated Batch Name",
        department: mockDepartment,
        mentor: null,
        _count: { students: 0 },
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/batches/batch_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Batch Name",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.batch.name).toBe("Updated Batch Name");
    });

    it("should return 404 for non-existent batch", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .put("/api/college-admin/batches/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/college-admin/batches/:batchId", () => {
    it("should delete batch successfully", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue({
        ...mockBatch,
        _count: { students: 0 },
      } as any);
      vi.spyOn(prisma.batch, "delete").mockResolvedValue(mockBatch as any);

      const response = await request(app as Express)
        .delete("/api/college-admin/batches/batch_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 400 if batch has students", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue({
        ...mockBatch,
        _count: { students: 10 },
      } as any);

      const response = await request(app as Express)
        .delete("/api/college-admin/batches/batch_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("students assigned");
    });
  });

  describe("POST /api/college-admin/batches/:batchId/students", () => {
    it("should assign students to batch", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(mockBatch as any);
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.student] as any);
      vi.spyOn(prisma.user, "updateMany").mockResolvedValue({ count: 1 } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/batches/batch_test_id/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          studentIds: ["test_student_id"],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 400 for non-student users", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(mockBatch as any);
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockUsers.mentor] as any);

      const response = await request(app as Express)
        .post("/api/college-admin/batches/batch_test_id/students")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          studentIds: ["test_mentor_id"],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("student role");
    });
  });

  describe("PUT /api/college-admin/batches/:batchId/mentor", () => {
    it("should assign mentor to batch", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(mockBatch as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.mentor as any);
      vi.spyOn(prisma.batch, "update").mockResolvedValue({
        ...mockBatch,
        mentor: mockUsers.mentor,
        department: mockDepartment,
        _count: { students: 0 },
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/batches/batch_test_id/mentor")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          mentorId: "test_mentor_id",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 400 for non-mentor user", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue(mockBatch as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.student as any);

      const response = await request(app as Express)
        .put("/api/college-admin/batches/batch_test_id/mentor")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          mentorId: "test_student_id",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("mentor");
    });
  });

  describe("GET /api/college-admin/batches/:batchId/stats", () => {
    it("should get batch statistics", async () => {
      vi.spyOn(prisma.batch, "findUnique").mockResolvedValue({
        ...mockBatch,
        _count: { students: 25 },
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/batches/batch_test_id/stats")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.totalStudents).toBe(25);
    });
  });
});
