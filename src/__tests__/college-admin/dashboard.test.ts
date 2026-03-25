import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type{ Express } from "express";
import {
  mockUsers,
  mockDepartment,
  mockBatch,
  createAuthHeaders,
} from "../helpers/mockData.js";

// Shared variable for controlling which user the mock auth middleware returns
let currentMockUser: any = mockUsers.collegeAdmin;

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

// Mock auth middleware - references currentMockUser variable
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = currentMockUser;
    next();
  },
  requireCollegeAdminAuth: (req: any, res: any, next: any) => {
    req.user = currentMockUser;
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

describe("College Admin - Dashboard Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock user
    currentMockUser = mockUsers.collegeAdmin;
  });

  describe("GET /api/college-admin/dashboard", () => {
    it("should return college admin dashboard stats", async () => {
      // Mock counts for college admin
      vi.spyOn(prisma.user, "count")
        .mockResolvedValueOnce(150) // Total users
        .mockResolvedValueOnce(100) // Students
        .mockResolvedValueOnce(20) // Mentors
        .mockResolvedValueOnce(15) // Instructors
        .mockResolvedValueOnce(10); // Dept admins

      vi.spyOn(prisma.department, "count").mockResolvedValue(5);
      vi.spyOn(prisma.batch, "count").mockResolvedValue(12);

      vi.spyOn(prisma.department, "findMany").mockResolvedValue([
        {
          ...mockDepartment,
          _count: { users: 30, batches: 3 },
        },
      ] as any);

      const response = await request(app as Express)
        .get("/api/college-admin/dashboard")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.dashboard.title).toContain("College Administrator");
      expect(response.body.dashboard.role).toBe("college_admin");
      expect(response.body.dashboard.sections).toBeDefined();
      expect(Array.isArray(response.body.dashboard.sections)).toBe(true);
    });

    it("should return principal dashboard stats", async () => {
      // Override middleware to return principal user
      vi.doMock("../../middleware/auth.js", () => ({
        requireAuth: (req: any, res: any, next: any) => {
          req.user = mockUsers.principal;
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

      vi.spyOn(prisma.department, "findMany").mockResolvedValue([
        {
          ...mockDepartment,
          _count: { users: 30, batches: 3 },
        },
      ] as any);

      const response = await request(app as Express)
        .get("/api/college-admin/dashboard")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.panel).toBe("college-admin");
    });

    it("should return HOD dashboard stats for specific department", async () => {
      // Set the current mock user to HOD
      currentMockUser = mockUsers.hod;

      const response = await request(app as Express)
        .get("/api/college-admin/dashboard")
        .set(createAuthHeaders(mockUsers.hod));

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.dashboard.role).toBe("hod");
      expect(response.body.dashboard.sections).toBeDefined();
    });

    it("should return department admin dashboard stats", async () => {
      // Set the current mock user to dept admin
      currentMockUser = mockUsers.deptAdmin;

      const response = await request(app as Express)
        .get("/api/college-admin/dashboard")
        .set(createAuthHeaders(mockUsers.deptAdmin));

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.dashboard.role).toBe("dept_admin");
    });

    it("should return college admin dashboard with all departments", async () => {
      vi.spyOn(prisma.user, "count")
        .mockResolvedValueOnce(30) // Dept students
        .mockResolvedValueOnce(5) // Dept mentors
        .mockResolvedValueOnce(3); // Dept instructors

      vi.spyOn(prisma.batch, "count").mockResolvedValue(3);

      vi.spyOn(prisma.batch, "findMany").mockResolvedValue([
        {
          ...mockBatch,
          _count: { students: 25 },
        },
      ] as any);

      const response = await request(app as Express)
        .get("/api/college-admin/dashboard")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.panel).toBe("college-admin");
    });

    it("should return mentor dashboard stats", async () => {
      // Set the current mock user to mentor
      currentMockUser = mockUsers.mentor;

      const response = await request(app as Express)
        .get("/api/college-admin/dashboard")
        .set(createAuthHeaders(mockUsers.mentor));

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.dashboard.role).toBe("mentor");
    });
  });
});
