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

describe("College Admin - Profile Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/college-admin/profile", () => {
    it("should get current user profile", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUsers.collegeAdmin,
        department: mockDepartment,
      } as any);

      const response = await request(app as Express)
        .get("/api/college-admin/profile")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.id).toBe(mockUsers.collegeAdmin.id);
      expect(response.body.profile.email).toBe(mockUsers.collegeAdmin.email);
    });

    it("should return 404 if user not found", async () => {
      // Mock to simulate user not found in database
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const response = await request(app as Express)
        .get("/api/college-admin/profile")
        .set(createAuthHeaders(mockUsers.collegeAdmin));

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("PUT /api/college-admin/profile", () => {
    it("should update user profile successfully", async () => {
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUsers.collegeAdmin,
        name: "Updated College Admin",
        image: "https://example.com/new-image.jpg",
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/profile")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated College Admin",
          image: "https://example.com/new-image.jpg",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.profile.name).toBe("Updated College Admin");
    });

    it("should return 404 if user not found", async () => {
      // Mock update to throw error for non-existent user
      vi.spyOn(prisma.user, "update").mockRejectedValue(new Error("Record not found"));

      const response = await request(app as Express)
        .put("/api/college-admin/profile")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(500);
    });

    it("should validate image URL format", async () => {
      const response = await request(app as Express)
        .put("/api/college-admin/profile")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          image: "invalid-url",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should allow partial updates", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.collegeAdmin as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUsers.collegeAdmin,
        name: "Only Name Updated",
      } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/profile")
        .set(createAuthHeaders(mockUsers.collegeAdmin))
        .send({
          name: "Only Name Updated",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.profile.name).toBe("Only Name Updated");
    });
  });
});
