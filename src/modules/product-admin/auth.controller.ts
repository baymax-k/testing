// ─── Product Admin Auth Controller ────────────────────────────────────────────

import type { Request, Response } from "express";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
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
} from "../auth/auth.service.js";
import { generateAvatarReadUrl, generateAvatarUploadUrl, getAvatarPublicUrl, uploadAvatarToS3 } from "../../utils/avatarUpload.js";

// ─── Product Admin Validators ─────────────────────────────────────────────────

const productAdminSignUpSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().min(1, "Name is required").max(100),
  companyName: z.string().min(1, "Company name is required").max(200),
});

// identifier = email address OR username
const productAdminSignInSchema = z.object({
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

const verifyForgotPasswordOtpSchema = z.object({
  email: z.string().email("Invalid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
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

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  companyName: z.string().max(200).optional(),
  avatarKey: z.string().min(1, "Avatar key is required").optional(),
});

const avatarPresignSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp"], {
    message: "Unsupported avatar mime type",
  }),
});

const avatarConfirmSchema = z.object({
  key: z.string().min(1, "Avatar key is required"),
});

const updateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  notifyOnCollegeCreation: z.boolean().optional(),
  notifyOnAdminAssignment: z.boolean().optional(),
  notifyOnUserRegistration: z.boolean().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  language: z.string().max(10).optional(),
  itemsPerPage: z.number().min(5).max(100).optional(),
  twoFactorEnabled: z.boolean().optional(),
  sessionTimeout: z.number().min(300).max(86400).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...refreshCookieOptions,
    path: "/api/product-admin/auth/refresh",
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...clearCookieOptions,
    path: "/api/product-admin/auth/refresh",
  });
}

function safeUser(user: {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  emailVerified: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

function sanitizeUsernameBase(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized.length >= 3) {
    return normalized.slice(0, 24);
  }

  return `user_${normalized || "acct"}`.slice(0, 24);
}

async function generateUniqueUsername(seed: string): Promise<string> {
  const base = sanitizeUsernameBase(seed);
  const baseCandidate = base.slice(0, 30);

  const existingBase = await prisma.user.findUnique({ where: { username: baseCandidate } });
  if (!existingBase) {
    return baseCandidate;
  }

  for (let i = 0; i < 20; i++) {
    const suffix = createId().slice(0, 5);
    const trimmed = base.slice(0, Math.max(3, 30 - (suffix.length + 1)));
    const candidate = `${trimmed}_${suffix}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) {
      return candidate;
    }
  }

  return `user_${createId().slice(0, 8)}`;
}

// ─── Product Admin Sign Up ────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/sign-up
 * Creates a new product admin account and sends a verification OTP.
 * Account is not usable until email is verified.
 */
export async function signUp(req: Request, res: Response): Promise<void> {
  try {
    const data = productAdminSignUpSchema.parse(req.body);

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

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        name: data.name,
        passwordHash,
        emailVerified: false,
        role: "product_admin",
      },
    });

    const otp = await generateAndStoreOTP(data.email, "email-verification");
    await sendOTPEmail(data.email, otp, "email-verification");

    res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      user: safeUser(user),
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

// ─── Product Admin Sign In ────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/sign-in
 * Authenticates a product admin with email/username and password.
 * Returns access & refresh tokens.
 */
export async function signIn(req: Request, res: Response): Promise<void> {
  try {
    const data = productAdminSignInSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.identifier }, { username: data.identifier }],
        role: "product_admin",
      },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email/username or password" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "Invalid email/username or password" });
      return;
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email/username or password" });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({ error: "Email not verified. Check your inbox for the verification code." });
      return;
    }

    const { accessToken, refreshToken } = await issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    });
    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      message: "Signed in successfully",
      user: safeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[signIn]", err);
    res.status(500).json({ error: "Failed to sign in" });
  }
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/verify-email
 * Verifies email with OTP and activates the account.
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const data = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: "Email is already verified" });
      return;
    }

    const otpResult = await verifyOTP(data.email, "email-verification", data.otp);
    const isOtpValid = typeof otpResult === "boolean" ? otpResult : otpResult.valid;
    if (!isOtpValid) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    res.status(200).json({
      message: "Email verified successfully",
      user: safeUser({
        ...user,
        emailVerified: true,
      }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[verifyEmail]", err);
    res.status(500).json({ error: "Email verification failed" });
  }
}

// ─── Send OTP ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/send-otp
 * Sends a new OTP to email (for resending verification code or password reset flow).
 */
export async function sendOtp(req: Request, res: Response): Promise<void> {
  try {
    const data = sendOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const otp = await generateAndStoreOTP(data.email, "email-verification");
    await sendOTPEmail(data.email, otp, "email-verification");

    res.status(200).json({
      message: "OTP sent to email",
    });
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
 * POST /api/v1/product-admin/auth/forgot-password
 * Initiates password reset flow by sending OTP to email.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      // Don't reveal if email exists (security best practice)
      res.status(200).json({
        message: "If this email exists, a password reset code has been sent",
      });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(200).json({
        message: "If this email exists, a password reset code has been sent",
      });
      return;
    }

    const otp = await generateAndStoreOTP(data.email, "forget-password");
    await sendOTPEmail(data.email, otp, "forget-password");

    res.status(200).json({
      message: "If this email exists, a password reset code has been sent",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[forgotPassword]", err);
    res.status(500).json({ error: "Failed to initiate password reset" });
  }
}

// ─── Verify Forgot Password OTP ──────────────────────────────────────────────

/**
 * POST /api/product-admin/auth/verify-forgot-password-otp
 * Verifies password reset OTP before allowing password reset.
 */
export async function verifyForgotPasswordOtp(req: Request, res: Response): Promise<void> {
  try {
    const data = verifyForgotPasswordOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const otpResult = await verifyOTP(data.email, "forget-password", data.otp);
    const isOtpValid = typeof otpResult === "boolean" ? otpResult : otpResult.valid;
    if (!isOtpValid) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    res.status(200).json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[verifyForgotPasswordOtp]", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/reset-password
 * Resets password with OTP verification.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const otpResult = await verifyOTP(data.email, "forget-password", data.otp);
    const isOtpValid = typeof otpResult === "boolean" ? otpResult : otpResult.valid;
    if (!isOtpValid) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.status(200).json({
      message: "Password reset successfully",
    });
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
 * POST /api/v1/product-admin/auth/change-password
 * Changes password for authenticated product admin user.
 * Requires valid current password.
 */
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = changePasswordSchema.parse(req.body);

    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const isCurrentPasswordValid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("[changePassword]", err);
    res.status(500).json({ error: "Failed to change password" });
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/sign-out
 * Clears authentication cookies.
 */
export async function signOut(_req: AuthRequest, res: Response): Promise<void> {
  try {
    clearAuthCookies(res);
    res.status(200).json({
      message: "Signed out successfully",
    });
  } catch (err) {
    console.error("[signOut]", err);
    res.status(500).json({ error: "Failed to sign out" });
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/product-admin/auth/refresh
 * Refreshes access token using refresh token cookie.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token not found" });
      return;
    }

    try {
      const refreshPayload = verifyRefreshToken(refreshToken);
      const userId = typeof refreshPayload === "string" ? refreshPayload : refreshPayload.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      if (user.role !== "product_admin") {
        res.status(403).json({ error: "This endpoint is for product admins only" });
        return;
      }

      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      });
      res.cookie(ACCESS_TOKEN_COOKIE, newAccessToken, accessCookieOptions);

      res.status(200).json({
        message: "Token refreshed successfully",
        accessToken: newAccessToken,
      });
    } catch {
      res.status(401).json({ error: "Invalid refresh token" });
    }
  } catch (err) {
    console.error("[refresh]", err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
}

// ─── Get Current User ─────────────────────────────────────────────────────────

/**
 * GET /api/product-admin/auth/me
 * Returns the current authenticated product admin's profile.
 */
export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    res.status(200).json({
      user: safeUser(user),
    });
  } catch (err) {
    console.error("[getCurrentUser]", err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

// ─── Update Profile ───────────────────────────────────────────────────────────

/**
 * PATCH /api/product-admin/profile
 * PUT /api/product-admin/profile
 * Updates product admin's profile (name, phone, company info, avatar).
 */
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const data = validation.data;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const updateData: { name?: string; phone?: string | null; image?: string } = {
      ...(data.name && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
    };

    let signedImage: string | undefined;

    if (req.file) {
      const uploadedAvatar = await uploadAvatarToS3({
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        userId: user.id,
        scope: "product-admin",
      });
      updateData.image = uploadedAvatar.url;
      signedImage = await generateAvatarReadUrl(uploadedAvatar.key);
    } else if (data.avatarKey) {
      const expectedPrefix = `avatars/product-admin/${user.id}/`;
      if (!data.avatarKey.startsWith(expectedPrefix)) {
        res.status(403).json({ error: "Invalid avatar key" });
        return;
      }
      updateData.image = getAvatarPublicUrl(data.avatarKey);
      signedImage = await generateAvatarReadUrl(data.avatarKey);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
      },
    });

    const responseImage =
      signedImage ??
      (updated.image ? await generateAvatarReadUrl(updated.image) : updated.image);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: { ...safeUser(updated), image: responseImage },
    });
  } catch (err: any) {
    console.error("[updateProfile]", err);
    res.status(500).json({ error: err.message || "Failed to update profile" });
  }
}

/**
 * POST /api/product-admin/avatar
 * Upload and set profile avatar for authenticated product admin.
 */
export async function uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Avatar file is required (field name: avatar)" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const uploadedAvatar = await uploadAvatarToS3({
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      userId: user.id,
      scope: "product-admin",
    });

    const signedAvatarUrl = await generateAvatarReadUrl(uploadedAvatar.key);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { image: uploadedAvatar.url },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      avatarUrl: signedAvatarUrl,
      user: {
        ...updated,
        image: signedAvatarUrl,
      },
    });
  } catch (err: any) {
    console.error("[uploadAvatar]", err);
    res.status(500).json({ error: err.message || "Failed to upload avatar" });
  }
}

/**
 * POST /api/product-admin/avatar/presign
 * Generate a presigned S3 upload URL for avatar uploads.
 */
export async function presignAvatar(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = avatarPresignSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: "Validation failed", details: validation.error.issues });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const presign = await generateAvatarUploadUrl({
      userId: user.id,
      scope: "product-admin",
      mimeType: validation.data.mimeType,
    });

    res.status(200).json({
      success: true,
      uploadUrl: presign.uploadUrl,
      key: presign.key,
      publicUrl: presign.publicUrl,
      expiresIn: presign.expiresIn,
      headers: { "Content-Type": validation.data.mimeType },
    });
  } catch (err: any) {
    console.error("[presignAvatar]", err);
    res.status(500).json({ error: err.message || "Failed to generate upload URL" });
  }
}

/**
 * POST /api/product-admin/avatar/confirm
 * Persist avatar URL after the client uploads to S3.
 */
export async function confirmAvatarUpload(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = avatarConfirmSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: "Validation failed", details: validation.error.issues });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    const key = validation.data.key;
    const expectedPrefix = `avatars/product-admin/${user.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      res.status(403).json({ error: "Invalid avatar key" });
      return;
    }

    const publicUrl = getAvatarPublicUrl(key);
    const signedAvatarUrl = await generateAvatarReadUrl(key);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { image: publicUrl },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      avatarUrl: signedAvatarUrl,
      user: {
        ...updated,
        image: signedAvatarUrl,
      },
    });
  } catch (err: any) {
    console.error("[confirmAvatarUpload]", err);
    res.status(500).json({ error: err.message || "Failed to confirm avatar upload" });
  }
}

// ─── Get Settings ─────────────────────────────────────────────────────────────

/**
 * GET /api/product-admin/settings
 * Retrieves current product admin's settings
 */
export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    let settings = await prisma.productAdminSettings.findUnique({
      where: { userId: req.user.userId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.productAdminSettings.create({
        data: {
          userId: req.user.userId,
        },
      });
    }

    res.status(200).json({
      success: true,
      settings: {
        id: settings.id,
        emailNotifications: settings.emailNotifications,
        notifyOnCollegeCreation: settings.notifyOnCollegeCreation,
        notifyOnAdminAssignment: settings.notifyOnAdminAssignment,
        notifyOnUserRegistration: settings.notifyOnUserRegistration,
        theme: settings.theme,
        language: settings.language,
        itemsPerPage: settings.itemsPerPage,
        twoFactorEnabled: settings.twoFactorEnabled,
        sessionTimeout: settings.sessionTimeout,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[getSettings]", err);
    res.status(500).json({ error: err.message || "Failed to fetch settings" });
  }
}

// ─── Update Settings ──────────────────────────────────────────────────────────

/**
 * PATCH /api/product-admin/settings
 * Updates product admin's settings
 */
export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validation = updateSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const data = validation.data;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== "product_admin") {
      res.status(403).json({ error: "This endpoint is for product admins only" });
      return;
    }

    // Get or create settings
    let settings = await prisma.productAdminSettings.findUnique({
      where: { userId: req.user.userId },
    });

    if (!settings) {
      settings = await prisma.productAdminSettings.create({
        data: { userId: req.user.userId },
      });
    }

    // Update settings
    const updated = await prisma.productAdminSettings.update({
      where: { userId: req.user.userId },
      data: {
        ...(data.emailNotifications !== undefined && { emailNotifications: data.emailNotifications }),
        ...(data.notifyOnCollegeCreation !== undefined && {
          notifyOnCollegeCreation: data.notifyOnCollegeCreation,
        }),
        ...(data.notifyOnAdminAssignment !== undefined && {
          notifyOnAdminAssignment: data.notifyOnAdminAssignment,
        }),
        ...(data.notifyOnUserRegistration !== undefined && {
          notifyOnUserRegistration: data.notifyOnUserRegistration,
        }),
        ...(data.theme && { theme: data.theme }),
        ...(data.language && { language: data.language }),
        ...(data.itemsPerPage && { itemsPerPage: data.itemsPerPage }),
        ...(data.twoFactorEnabled !== undefined && { twoFactorEnabled: data.twoFactorEnabled }),
        ...(data.sessionTimeout && { sessionTimeout: data.sessionTimeout }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        id: updated.id,
        emailNotifications: updated.emailNotifications,
        notifyOnCollegeCreation: updated.notifyOnCollegeCreation,
        notifyOnAdminAssignment: updated.notifyOnAdminAssignment,
        notifyOnUserRegistration: updated.notifyOnUserRegistration,
        theme: updated.theme,
        language: updated.language,
        itemsPerPage: updated.itemsPerPage,
        twoFactorEnabled: updated.twoFactorEnabled,
        sessionTimeout: updated.sessionTimeout,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[updateSettings]", err);
    res.status(500).json({ error: err.message || "Failed to update settings" });
  }
}
