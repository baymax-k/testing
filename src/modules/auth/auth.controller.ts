// ─── Auth Controller ──────────────────────────────────────────────────────────

import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  hashPassword,
  verifyPassword,
  issueTokens,
  verifyRefreshToken,
  generateAccessToken,
  generateAndStoreOTP,
  verifyOTP,
  sendOTPEmail,
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./auth.service.js";

// ─── Validators ───────────────────────────────────────────────────────────────

const signUpSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().min(1, "Name is required").max(100),
});

// identifier = email address OR username
const signInSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const sendOtpSchema = z.object({
  email: z.string().email("Invalid email"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...clearCookieOptions, path: "/api/v1/auth/refresh" });
}

function safeUser(user: { id: string; email: string; username: string; name: string; role: string; emailVerified: boolean }) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/sign-up
 * Creates a new student account and sends a verification OTP.
 * Account is not usable until email is verified.
 */
export async function signUp(req: Request, res: Response): Promise<void> {
  try {
    const data = signUpSchema.parse(req.body);

    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) {
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: data.username } });
    if (existingUsername) {
      res.status(400).json({ error: "That username is already taken" });
      return;
    }

    const passwordHash = await hashPassword(data.password);

    await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        name: data.name,
        passwordHash,
        emailVerified: false,
        role: "student",
      },
    });

    const otp = await generateAndStoreOTP(data.email, "email-verification");
    await sendOTPEmail(data.email, otp, "email-verification");

    res.status(201).json({
      message: "Account created. Check your email for the verification code.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[signUp]", err);
    res.status(500).json({ error: "Failed to create account" });
  }
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/sign-in
 * Verifies credentials, issues JWT cookies.
 */
export async function signIn(req: Request, res: Response): Promise<void> {
  try {
    const data = signInSchema.parse(req.body);

    // Accept email address or username as identifier
    const isEmail = data.identifier.includes("@");
    const user = isEmail
      ? await prisma.user.findUnique({ where: { email: data.identifier } })
      : await prisma.user.findUnique({ where: { username: data.identifier } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const passwordValid = await verifyPassword(data.password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        error: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
      });
      return;
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Signed in", user: safeUser(user) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[signIn]", err);
    res.status(500).json({ error: "Failed to sign in" });
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/sign-out
 * Revokes the refresh token and clears both cookies.
 */
export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await prisma.refreshToken.deleteMany({ where: { jti: payload.jti } });
      } catch {
        // Token already invalid — still clear cookies
      }
    }

    clearAuthCookies(res);
    res.json({ message: "Signed out" });
  } catch (err) {
    console.error("[signOut]", err);
    res.status(500).json({ error: "Failed to sign out" });
  }
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/refresh
 * Reads the refresh_token cookie, validates it, issues a new access token.
 * Rotates the refresh token (old one is deleted, new one issued).
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!refreshToken) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.expiresAt < new Date()) {
      clearAuthCookies(res);
      res.status(401).json({ error: "Refresh token expired or revoked" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      clearAuthCookies(res);
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Rotate: delete old token and issue new pair
    await prisma.refreshToken.delete({ where: { jti: payload.jti } });
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({ message: "Token refreshed" });
  } catch (err) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Invalid refresh token" });
  }
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/verify-email
 * Verifies the OTP sent on sign-up, marks email as verified, and signs user in.
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const data = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: "Email is already verified" });
      return;
    }

    const result = await verifyOTP(data.email, "email-verification", data.otp);
    if (!result.valid) {
      res.status(400).json({ error: result.reason });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Auto sign-in after verification
    const { accessToken, refreshToken } = await issueTokens(updatedUser);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Email verified", user: safeUser(updatedUser) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[verifyEmail]", err);
    res.status(500).json({ error: "Failed to verify email" });
  }
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/send-otp
 * Resends the email verification OTP.
 */
export async function sendOtp(req: Request, res: Response): Promise<void> {
  try {
    const { email } = sendOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether the email exists
      res.json({ message: "If an account exists, a verification code has been sent." });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: "Email is already verified" });
      return;
    }

    const otp = await generateAndStoreOTP(email, "email-verification");
    await sendOTPEmail(email, otp, "email-verification");

    res.json({ message: "Verification code sent. Check your email." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[sendOtp]", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/forgot-password
 * Sends a password reset OTP to the given email.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to avoid email enumeration
    if (user) {
      const otp = await generateAndStoreOTP(email, "forget-password");
      await sendOTPEmail(email, otp, "forget-password");
    }

    res.json({ message: "If an account with that email exists, a reset code has been sent." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[forgotPassword]", err);
    res.status(500).json({ error: "Failed to process request" });
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/reset-password
 * Verifies OTP and sets a new password. Forces re-login on all devices.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const result = await verifyOTP(data.email, "forget-password", data.otp);
    if (!result.valid) {
      res.status(400).json({ error: result.reason });
      return;
    }

    const passwordHash = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke all refresh tokens — forces re-login on all devices
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    clearAuthCookies(res);

    res.json({ message: "Password reset successfully. Please sign in again." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[resetPassword]", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
}

// ─── Change Password ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/change-password
 * Changes password for the currently authenticated user.
 * Requires requireAuth middleware.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const authUser = (req as AuthRequest).user!;

  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordValid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!passwordValid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    if (data.currentPassword === data.newPassword) {
      res.status(400).json({ error: "New password must be different from current password" });
      return;
    }

    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Revoke all other refresh tokens, keep current session active
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (currentRefreshToken) {
      try {
        const payload = verifyRefreshToken(currentRefreshToken);
        await prisma.refreshToken.deleteMany({
          where: { userId: user.id, jti: { not: payload.jti } },
        });
      } catch {
        // If refresh token is invalid, revoke all
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      }
    }

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[changePassword]", err);
    res.status(500).json({ error: "Failed to change password" });
  }
}
