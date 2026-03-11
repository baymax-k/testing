// ─── Auth Service ─────────────────────────────────────────────────────────────
// Pure utility functions for password hashing, JWT generation, OTP handling,
// and email sending. No Express types here — only business logic.

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createId } from "@paralleldrive/cuid2";
import nodemailer from "nodemailer";
import { prisma } from "../../config/prisma.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 10;

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

// ─── Email transporter ────────────────────────────────────────────────────────

const requiredEmailEnv = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];
for (const key of requiredEmailEnv) {
  if (!process.env[key]) {
    console.warn(`[auth] WARNING: Missing env var: ${key} — email sending will fail`);
  }
}

const mailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "2525", 10),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");
  return secret;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"],
  });
}

export function generateRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { userId, jti };
  return jwt.sign(payload, getJwtRefreshSecret(), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getJwtRefreshSecret()) as RefreshTokenPayload;
}

// ─── Cookie options ───────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";

export const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  maxAge: 15 * 60 * 1000, // 15 minutes in ms
  path: "/",
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: "/api/v1/auth/refresh", // only sent to the refresh endpoint
};

export const clearCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

// ─── Token issuance (generates + stores refresh token in DB) ─────────────────

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export async function issueTokens(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}): Promise<IssuedTokens> {
  const jti = createId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Single-device enforcement: delete all previous refresh tokens for this user
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  await prisma.refreshToken.create({
    data: { jti, userId: user.id, expiresAt },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  });

  const refreshToken = generateRefreshToken(user.id, jti);

  return { accessToken, refreshToken };
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export type OtpType = "email-verification" | "forget-password";

function otpIdentifier(email: string, type: OtpType): string {
  return `${email}:${type}`;
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function generateAndStoreOTP(email: string, type: OtpType): Promise<string> {
  const otp = String(crypto.randomInt(100000, 999999));
  const identifier = otpIdentifier(email, type);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const hashedValue = hashOtp(otp);

  // Replace any existing OTP for this email+type
  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.create({
    data: {
      id: createId(),
      identifier,
      value: hashedValue,
      expiresAt,
    },
  });

  return otp;
}

export async function verifyOTP(
  email: string,
  type: OtpType,
  otp: string
): Promise<{ valid: boolean; reason?: string }> {
  const identifier = otpIdentifier(email, type);

  const record = await prisma.verification.findFirst({ where: { identifier } });

  if (!record) return { valid: false, reason: "Invalid or expired OTP" };
  if (record.expiresAt < new Date()) {
    await prisma.verification.delete({ where: { id: record.id } });
    return { valid: false, reason: "OTP has expired" };
  }

  const inputHash = hashOtp(otp);
  if (inputHash !== record.value) {
    return { valid: false, reason: "Incorrect OTP" };
  }

  // Consume the OTP — one-time use
  await prisma.verification.delete({ where: { id: record.id } });
  return { valid: true };
}

// ─── Email sending ────────────────────────────────────────────────────────────

export async function sendOTPEmail(
  email: string,
  otp: string,
  type: OtpType
): Promise<void> {
  const templates: Record<OtpType, { subject: string; heading: string; label: string }> = {
    "email-verification": {
      subject: "Verify your email – CodeEthnics",
      heading: "Email Verification",
      label: "Your verification code is:",
    },
    "forget-password": {
      subject: "Password Reset – CodeEthnics",
      heading: "Password Reset Request",
      label: "Your password reset code is:",
    },
  };

  const { subject, heading, label } = templates[type];

  await mailTransporter.sendMail({
    from: process.env.EMAIL_FROM || `"CodeEthnics" <no-reply@codeethnics.com>`,
    to: email,
    subject,
    html: `
      <h2>${heading}</h2>
      <p>${label}</p>
      <p><strong style="font-size:28px;letter-spacing:6px;">${otp}</strong></p>
      <p>This code expires in 10 minutes.</p>
      ${type === "forget-password" ? "<p>If you did not request this, ignore this email.</p>" : ""}
    `,
  });
}
