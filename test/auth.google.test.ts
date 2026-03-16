import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAuthService } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockAuthService: {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    issueTokens: vi.fn(),
    verifyRefreshToken: vi.fn(),
    generateAccessToken: vi.fn(),
    generateAndStoreOTP: vi.fn(),
    verifyOTP: vi.fn(),
    sendOTPEmail: vi.fn(),
    accessCookieOptions: {
      httpOnly: true,
      secure: false,
      sameSite: "lax" as const,
      maxAge: 15 * 60 * 1000,
      path: "/",
    },
    refreshCookieOptions: {
      httpOnly: true,
      secure: false,
      sameSite: "lax" as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth/refresh",
    },
    clearCookieOptions: {
      httpOnly: true,
      secure: false,
      sameSite: "lax" as const,
      path: "/",
    },
    ACCESS_TOKEN_COOKIE: "access_token",
    REFRESH_TOKEN_COOKIE: "refresh_token",
    verifyGoogleIdToken: vi.fn(),
  },
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("../src/modules/auth/auth.service.js", () => mockAuthService);

import { signInWithGoogle } from "../src/modules/auth/auth.controller.js";

const app = express();
app.use(express.json());
app.post("/api/v1/auth/sign-in/google", signInWithGoogle);

describe("Google auth endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.issueTokens.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("signs in an existing user and sets auth cookies", async () => {
    mockAuthService.verifyGoogleIdToken.mockResolvedValue({
      email: "student@codeethnics.com",
      name: "Student",
      emailVerified: true,
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "student@codeethnics.com",
      username: "student",
      name: "Student",
      role: "student",
      emailVerified: true,
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in/google")
      .send({ idToken: "valid-google-token" });

    expect(res.status).toBe(200);
    expect(res.body?.message).toBe("Signed in with Google");
    expect(res.body?.user?.email).toBe("student@codeethnics.com");

    const rawSetCookie = res.headers["set-cookie"];
    const setCookie = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
        ? [rawSetCookie]
        : [];
    expect(setCookie.some((c: string) => c.includes("access_token=access-token"))).toBe(true);
    expect(setCookie.some((c: string) => c.includes("refresh_token=refresh-token"))).toBe(true);
  });

  it("creates a new user when Google email does not exist", async () => {
    mockAuthService.verifyGoogleIdToken.mockResolvedValue({
      email: "newuser@codeethnics.com",
      name: "New User",
      emailVerified: true,
    });

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockAuthService.hashPassword.mockResolvedValue("generated-password-hash");

    mockPrisma.user.create.mockResolvedValue({
      id: "user_2",
      email: "newuser@codeethnics.com",
      username: "newuser",
      name: "New User",
      role: "student",
      emailVerified: true,
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in/google")
      .send({ idToken: "valid-google-token" });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "newuser@codeethnics.com",
          role: "student",
          emailVerified: true,
        }),
      })
    );
  });

  it("returns 403 when Google email is not verified", async () => {
    mockAuthService.verifyGoogleIdToken.mockResolvedValue({
      email: "student@codeethnics.com",
      name: "Student",
      emailVerified: false,
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in/google")
      .send({ idToken: "valid-google-token" });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("Google account email is not verified");
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockAuthService.issueTokens).not.toHaveBeenCalled();
  });
});
