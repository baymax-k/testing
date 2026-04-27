import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productAdminSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return { prisma };
});

vi.mock("../../modules/auth/auth.service.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  issueTokens: vi.fn().mockResolvedValue({ accessToken: "access-token", refreshToken: "refresh-token" }),
  verifyRefreshToken: vi.fn().mockReturnValue("user-1"),
  generateAccessToken: vi.fn().mockResolvedValue("new-access-token"),
  generateAndStoreOTP: vi.fn().mockResolvedValue("123456"),
  verifyOTP: vi.fn().mockResolvedValue(true),
  sendOTPEmail: vi.fn().mockResolvedValue(undefined),
  accessCookieOptions: {},
  refreshCookieOptions: {},
  clearCookieOptions: {},
  ACCESS_TOKEN_COOKIE: "access_token",
  REFRESH_TOKEN_COOKIE: "refresh_token",
}));

const { prisma } = await import("../../config/prisma.js");
const authService = await import("../../modules/auth/auth.service.js");
const {
  signUp,
  signIn,
  verifyEmail,
  sendOtp,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  changePassword,
  signOut,
  refresh,
  getCurrentUser,
  updateProfile,
  getSettings,
  updateSettings,
} = await import("../../modules/product-admin/auth.controller.js");

function createMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as any;
}

describe("Product Admin Auth Controller - Unit Tests", () => {
  const now = new Date("2026-01-01T10:00:00.000Z");
  const user = {
    id: "user-1",
    email: "product.admin@example.com",
    username: "product_admin",
    name: "Product Admin",
    role: "product_admin",
    emailVerified: true,
    passwordHash: "hashed-password",
    phone: null,
    collegeId: null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);
    vi.mocked(prisma.user.create).mockResolvedValue(user as any);
    vi.mocked(prisma.user.update).mockResolvedValue(user as any);

    vi.mocked(prisma.productAdminSettings.findUnique).mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      emailNotifications: true,
      notifyOnCollegeCreation: true,
      notifyOnAdminAssignment: true,
      notifyOnUserRegistration: false,
      theme: "light",
      language: "en",
      itemsPerPage: 20,
      twoFactorEnabled: false,
      sessionTimeout: 3600,
      updatedAt: now,
    } as any);

    vi.mocked(prisma.productAdminSettings.create).mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      emailNotifications: true,
      notifyOnCollegeCreation: true,
      notifyOnAdminAssignment: true,
      notifyOnUserRegistration: false,
      theme: "light",
      language: "en",
      itemsPerPage: 20,
      twoFactorEnabled: false,
      sessionTimeout: 3600,
      updatedAt: now,
    } as any);

    vi.mocked(prisma.productAdminSettings.update).mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      emailNotifications: true,
      notifyOnCollegeCreation: true,
      notifyOnAdminAssignment: true,
      notifyOnUserRegistration: false,
      theme: "light",
      language: "en",
      itemsPerPage: 20,
      twoFactorEnabled: false,
      sessionTimeout: 3600,
      updatedAt: now,
    } as any);
  });

  it("signUp creates product admin account", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce(null as any);

    const req = {
      body: {
        email: "new.product.admin@example.com",
        username: "new_product_admin",
        password: "StrongPass@123",
        name: "New Product Admin",
        companyName: "CodeEthnics",
      },
    } as Request;
    const res = createMockRes();

    await signUp(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.sendOTPEmail).toHaveBeenCalled();
  });

  it("signIn returns tokens", async () => {
    const req = {
      body: { identifier: "product.admin@example.com", password: "StrongPass@123" },
    } as Request;
    const res = createMockRes();

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(authService.issueTokens).toHaveBeenCalled();
  });

  it("verifyEmail marks account as verified", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...user, emailVerified: false } as any);

    const req = { body: { email: "product.admin@example.com", otp: "123456" } } as Request;
    const res = createMockRes();

    await verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("sendOtp sends verification code", async () => {
    const req = { body: { email: "product.admin@example.com" } } as Request;
    const res = createMockRes();

    await sendOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(authService.generateAndStoreOTP).toHaveBeenCalled();
  });

  it("forgotPassword triggers reset flow", async () => {
    const req = { body: { email: "product.admin@example.com" } } as Request;
    const res = createMockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(authService.sendOTPEmail).toHaveBeenCalled();
  });

  it("verifyForgotPasswordOtp validates reset OTP", async () => {
    const req = {
      body: {
        email: "product.admin@example.com",
        otp: "123456",
      },
    } as Request;
    const res = createMockRes();

    await verifyForgotPasswordOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(authService.verifyOTP).toHaveBeenCalledWith("product.admin@example.com", "forget-password", "123456");
  });

  it("resetPassword updates password", async () => {
    const req = {
      body: {
        email: "product.admin@example.com",
        otp: "123456",
        newPassword: "AnotherStrongPass@123",
      },
    } as Request;
    const res = createMockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("changePassword validates current password and updates", async () => {
    const req = {
      user: { userId: "user-1" },
      body: {
        currentPassword: "StrongPass@123",
        newPassword: "AnotherStrongPass@123",
      },
    } as any;
    const res = createMockRes();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(authService.verifyPassword).toHaveBeenCalled();
  });

  it("signOut clears auth cookies", async () => {
    const req = {} as Request;
    const res = createMockRes();

    await signOut(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it("refresh issues new access token", async () => {
    const req = {
      cookies: {
        refresh_token: "refresh-token",
      },
    } as unknown as Request;
    const res = createMockRes();

    await refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(authService.generateAccessToken).toHaveBeenCalled();
  });

  it("getCurrentUser returns authenticated user", async () => {
    const req = {
      user: { userId: "user-1" },
    } as any;
    const res = createMockRes();

    await getCurrentUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateProfile updates profile fields", async () => {
    const req = {
      user: { userId: "user-1" },
      body: { name: "Updated Product Admin", phone: "+91-9000000000" },
    } as any;
    const res = createMockRes();

    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("getSettings returns user settings", async () => {
    const req = {
      user: { userId: "user-1" },
    } as any;
    const res = createMockRes();

    await getSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.productAdminSettings.findUnique).toHaveBeenCalled();
  });

  it("updateSettings persists settings", async () => {
    const req = {
      user: { userId: "user-1" },
      body: {
        emailNotifications: true,
        itemsPerPage: 25,
      },
    } as any;
    const res = createMockRes();

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.productAdminSettings.update).toHaveBeenCalled();
  });
});
