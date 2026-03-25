import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { mockUsers } from "../helpers/mockData.js";

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
const { prisma, auth } = await import("../../config/auth.js");
const app = (await import("../../app.js")).default;

describe("College Admin - Authentication Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/college-admin/auth/login", () => {
    it("should login successfully with valid college admin credentials", async () => {
      // Mock Better Auth sign-in (returns user directly, not nested in data)
      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        user: mockUsers.collegeAdmin,
        session: {
          id: "session_id",
          userId: mockUsers.collegeAdmin.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          token: "mock_token",
          ipAddress: "127.0.0.1",
          userAgent: "test",
        },
        token: "mock_token",
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/login")
        .send({
          email: "admin@college.test",
          password: "SecurePassword123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(mockUsers.collegeAdmin.email);
    });

    it("should reject login with student role", async () => {
      // Mock Better Auth sign-in returning a student
      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        user: mockUsers.student,
        session: {
          id: "session_id",
          userId: mockUsers.student.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          token: "mock_token",
          ipAddress: "127.0.0.1",
          userAgent: "test",
        },
        token: "mock_token",
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/login")
        .send({
          email: "student@college.test",
          password: "password123",
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/auth/login")
        .send({
          email: "invalid-email",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/auth/login")
        .send({
          email: "admin@college.test",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/college-admin/auth/logout", () => {
    it("should logout successfully", async () => {
      vi.spyOn(auth.api, "signOut").mockResolvedValue({
        data: { success: true },
        error: null,
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/logout")
        .set("Cookie", "better-auth.session_token=mock_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /api/college-admin/auth/forgot-password", () => {
    it("should send OTP for password reset", async () => {
      // Mock fetch for Better Auth email-otp endpoint
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUsers.collegeAdmin as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/forgot-password")
        .send({
          email: "admin@college.test",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("sent");
    });

    it("should return 400 for invalid email", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/auth/forgot-password")
        .send({
          email: "invalid-email",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/college-admin/auth/reset-password", () => {
    it("should reset password with valid OTP", async () => {
      // Mock fetch for Better Auth reset password endpoint
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/reset-password")
        .send({
          email: "admin@college.test",
          otp: "123456",
          password: "NewSecurePassword123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("reset");
    });

    it("should return 400 for invalid OTP length", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/auth/reset-password")
        .send({
          email: "admin@college.test",
          otp: "123",
          password: "NewPassword123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for short password", async () => {
      const response = await request(app as Express)
        .post("/api/college-admin/auth/reset-password")
        .send({
          email: "admin@college.test",
          otp: "123456",
          password: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/college-admin/auth/refresh-token", () => {
    it("should refresh session successfully", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: mockUsers.collegeAdmin,
        session: {
          id: "session_id",
          userId: mockUsers.collegeAdmin.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          token: "new_mock_token",
          ipAddress: "127.0.0.1",
          userAgent: "test",
        },
      } as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/refresh-token")
        .set("Cookie", "better-auth.session_token=mock_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.session).toBeDefined();
    });
  });
});
