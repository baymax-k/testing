import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { mockUsers } from "../helpers/mockData.js";

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
  },
}));

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
    refreshToken: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn(),
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

vi.mock("../../modules/auth/auth.service.js", () => ({
  generateAndStoreOTP: vi.fn().mockResolvedValue("123456"),
  sendOTPEmail: vi.fn().mockResolvedValue(undefined),
  validateOTP: vi.fn().mockResolvedValue({ valid: true }),
  verifyOTP: vi.fn().mockResolvedValue({ valid: true }),
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  issueTokens: vi.fn().mockResolvedValue({
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
  }),
  verifyRefreshToken: vi.fn().mockReturnValue({
    userId: mockUsers.collegeAdmin.id,
    jti: "mock_refresh_jti",
  }),
  ACCESS_TOKEN_COOKIE: "access_token",
  REFRESH_TOKEN_COOKIE: "refresh_token",
  accessCookieOptions: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
    path: "/",
  },
  refreshCookieOptions: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth/refresh",
  },
  clearCookieOptions: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  },
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
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
const { prisma: appPrisma } = await import("../../config/prisma.js");
const authService = await import("../../modules/auth/auth.service.js");
const app = (await import("../../app.js")).default;

describe("College Admin - Authentication Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/college-admin/auth/login", () => {
    it("should login successfully with valid college admin credentials", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUsers.collegeAdmin.id,
        email: mockUsers.collegeAdmin.email,
        name: mockUsers.collegeAdmin.name,
        role: mockUsers.collegeAdmin.role,
        emailVerified: true,
        image: null,
        passwordHash: "hashed-password",
      } as any);
      vi.spyOn(prisma.session, "create").mockResolvedValue({ id: "session_id" } as any);

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
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it("should reject login with student role", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUsers.student.id,
        email: mockUsers.student.email,
        name: mockUsers.student.name,
        role: mockUsers.student.role,
        emailVerified: true,
        image: null,
        passwordHash: "hashed-password",
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
      vi.spyOn(appPrisma.user, "findUnique").mockResolvedValue(mockUsers.collegeAdmin as any);

      const response = await request(app as Express)
        .post("/api/college-admin/auth/forgot-password")
        .send({
          email: "admin@college.test",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("sent");
      expect(authService.generateAndStoreOTP).toHaveBeenCalledWith("admin@college.test", "forget-password");
      expect(authService.sendOTPEmail).toHaveBeenCalled();
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

  describe("PUT /api/college-admin/auth/reset-password", () => {
    it("should reset password with valid payload", async () => {
      vi.spyOn(authService, "hashPassword").mockResolvedValue("hashed-password");
      vi.spyOn(authService, "verifyOTP").mockResolvedValue({ valid: true });
      vi.spyOn(appPrisma.user, "findUnique").mockResolvedValue(mockUsers.collegeAdmin as any);
      vi.spyOn(appPrisma.user, "update").mockResolvedValue(mockUsers.collegeAdmin as any);
      vi.spyOn(appPrisma.refreshToken, "deleteMany").mockResolvedValue({ count: 1 } as any);

      const response = await request(app as Express)
        .put("/api/college-admin/auth/reset-password")
        .send({
          email: "admin@college.test",
          otp: "123456",
          password: "NewSecurePassword123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("reset");
      expect(authService.verifyOTP).toHaveBeenCalledWith("admin@college.test", "forget-password", "123456");
      expect(appPrisma.user.update).toHaveBeenCalled();
    });

    it("should return 400 for invalid OTP", async () => {
      vi.spyOn(authService, "verifyOTP").mockResolvedValue({ valid: false, reason: "Incorrect OTP" });
      vi.spyOn(appPrisma.user, "findUnique").mockResolvedValue(mockUsers.collegeAdmin as any);

      const response = await request(app as Express)
        .put("/api/college-admin/auth/reset-password")
        .send({
          email: "admin@college.test",
          otp: "000000",
          password: "NewSecurePassword123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Incorrect OTP");
      expect(appPrisma.user.update).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid email", async () => {
      const response = await request(app as Express)
        .put("/api/college-admin/auth/reset-password")
        .send({
          email: "invalid-email",
          otp: "123456",
          password: "NewPassword123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for short password", async () => {
      const response = await request(app as Express)
        .put("/api/college-admin/auth/reset-password")
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
      vi.spyOn(authService, "verifyRefreshToken").mockReturnValue({
        userId: mockUsers.collegeAdmin.id,
        jti: "old_refresh_jti",
      } as any);
      vi.spyOn(appPrisma.refreshToken, "findUnique").mockResolvedValue({
        id: "refresh_id",
        jti: "old_refresh_jti",
        userId: mockUsers.collegeAdmin.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any);
      vi.spyOn(appPrisma.refreshToken, "deleteMany").mockResolvedValue({ count: 1 } as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUsers.collegeAdmin.id,
        email: mockUsers.collegeAdmin.email,
        name: mockUsers.collegeAdmin.name,
        role: mockUsers.collegeAdmin.role,
        emailVerified: true,
        image: null,
      } as any);
      vi.spyOn(authService, "issueTokens").mockResolvedValue({
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
      });

      const response = await request(app as Express)
        .post("/api/college-admin/auth/refresh-token")
        .set("Cookie", "refresh_token=old_refresh_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBe("new_access_token");
      expect(response.body.refreshToken).toBe("new_refresh_token");
    });
  });
});
