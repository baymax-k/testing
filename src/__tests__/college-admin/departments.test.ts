import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { mockUsers, mockDepartment, createAuthHeaders } from "../helpers/mockData.js";

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

// Mock DepartmentService
vi.mock("../../modules/services/departmentService.js", () => ({
  DepartmentService: {
    getAllDepartments: vi.fn(),
    getDepartmentById: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
  },
}));

// Import after mocks
const { prisma } = await import("../../config/auth.js");
const { DepartmentService } = await import("../../modules/services/departmentService.js");
const app = (await import("../../app.js")).default;

describe("College Admin - Department Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/college-admin/departments", () => {
    it("should create a new department", async () => {
      vi.spyOn(DepartmentService, "createDepartment").mockResolvedValue(mockDepartment as any);

      const response = await request(app as Express)
        .post("/api/college-admin/departments")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Computer Science",
          code: "CSE",
          description: "Department of Computer Science",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.department).toBeDefined();
      expect(response.body.department.code).toBe("CSE");
    });

    it("should return 400 if department code already exists", async () => {
      vi.spyOn(DepartmentService, "createDepartment").mockRejectedValue(
        new Error("Department code already exists")
      );

      const response = await request(app as Express)
        .post("/api/college-admin/departments")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "New Department",
          code: "CSE",
          description: "Test",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already exists");
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/departments")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Computer Science",
          // Missing code
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for invalid code length", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/departments")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Computer Science",
          code: "C", // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("GET /api/college-admin/departments", () => {
    it("should list all departments for college admin", async () => {
      vi.spyOn(DepartmentService, "getAllDepartments").mockResolvedValue({
        departments: [mockDepartment],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/departments")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.departments).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter departments by search query", async () => {
      vi.spyOn(DepartmentService, "getAllDepartments").mockResolvedValue({
        departments: [mockDepartment],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/departments?search=Computer")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should support pagination", async () => {
      vi.spyOn(DepartmentService, "getAllDepartments").mockResolvedValue({
        departments: [mockDepartment],
        pagination: {
          total: 10,
          page: 2,
          limit: 5,
          totalPages: 2,
        },
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/departments?page=2&limit=5")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe("GET /api/college-admin/departments/:deptId", () => {
    it("should get department by ID", async () => {
      vi.spyOn(DepartmentService, "getDepartmentById").mockResolvedValue(mockDepartment as any);

      const response = await request(app as Express)
        .get("/api/college-admin/departments/dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.department.id).toBe("dept_test_id");
    });

    it("should return 404 for non-existent department", async () => {
      vi.spyOn(DepartmentService, "getDepartmentById").mockResolvedValue(null as any);

      const response = await request(app as Express)
        .get("/api/college-admin/departments/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/college-admin/departments/:deptId", () => {
    it("should update department successfully", async () => {
      vi.spyOn(DepartmentService, "updateDepartment").mockResolvedValue({
        ...mockDepartment,
        name: "Updated Name",
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/departments/dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.department.name).toBe("Updated Name");
    });

    it("should return 404 for non-existent department", async () => {
      vi.spyOn(DepartmentService, "updateDepartment").mockRejectedValue(
        new Error("Department not found")
      );

      const response = await request(app as Express)
        .put("/api/college-admin/departments/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/college-admin/departments/:deptId", () => {
    it("should delete department successfully", async () => {
      vi.spyOn(DepartmentService, "deleteDepartment").mockResolvedValue(mockDepartment as any);

      const response = await request(app as Express)
        .delete("/api/college-admin/departments/dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 400 if department has users", async () => {
      vi.spyOn(DepartmentService, "deleteDepartment").mockRejectedValue(
        new Error("Cannot delete department with users assigned")
      );

      const response = await request(app as Express)
        .delete("/api/college-admin/departments/dept_test_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("users assigned");
    });

    it("should return 404 for non-existent department", async () => {
      vi.spyOn(DepartmentService, "deleteDepartment").mockRejectedValue(
        new Error("Department not found")
      );

      const response = await request(app as Express)
        .delete("/api/college-admin/departments/invalid_id")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
    });
  });
});
