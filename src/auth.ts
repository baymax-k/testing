import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { PrismaClient } from "./generated/prisma/client.js";
import nodemailer from "nodemailer";

export const prisma = new PrismaClient();

// ─── Reusable email transporter (Mailtrap for dev, swap to SES for prod) ──────
const mailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "2525", 10),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  basePath: "/auth",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:5000",
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],

  // ─── Email + Password ───────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // ─── Email Verification (link-based, sent on sign-up) ──────────────────────
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600, // 1 hour
    sendVerificationEmail: async ({ user, url, token }) => {
      const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email?token=${token}`;
      void mailTransporter.sendMail({
        from: `"CodeEthnics" <no-reply@codeethnics.local>`,
        to: user.email,
        subject: "Verify your email – CodeEthnics",
        html: `
          <h2>Welcome to CodeEthnics!</h2>
          <p>Hi ${user.name || "there"},</p>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${verifyUrl}" style="padding:10px 20px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
          <p>Or copy this link: ${verifyUrl}</p>
          <p>This link expires in 1 hour.</p>
        `,
      });
    },
  },

  // ─── User schema ────────────────────────────────────────────────────────────
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "student",
        input: false, // public sign-up cannot set role; only admin can
      },
    },
  },

  // ─── Session ────────────────────────────────────────────────────────────────
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // refresh every 24 h
  },

  // ─── Plugins ────────────────────────────────────────────────────────────────
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      allowedAttempts: 10,
      sendVerificationOnSignUp: false, // we use link-based verification on sign-up
      async sendVerificationOTP({ email, otp, type }) {
        let subject = "";
        let body = "";

        if (type === "email-verification") {
          subject = "Verify your email – CodeEthnics";
          body = `
            <h2>Email Verification</h2>
            <p>Your verification code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
            <p>This code expires in 10 minutes.</p>
          `;
        } else if (type === "forget-password") {
          subject = "Password Reset – CodeEthnics";
          body = `
            <h2>Password Reset Request</h2>
            <p>Your password reset code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
            <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          `;
        } else {
          // sign-in OTP
          subject = "Sign-in Code – CodeEthnics";
          body = `
            <h2>Sign-in Code</h2>
            <p>Your sign-in code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
            <p>This code expires in 10 minutes.</p>
          `;
        }

        void mailTransporter.sendMail({
          from: `"CodeEthnics" <no-reply@codeethnics.local>`,
          to: email,
          subject,
          html: body,
        });
      },
    }),
  ],

  // ─── Database hooks ─────────────────────────────────────────────────────────
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Single-device enforcement: delete all other sessions for this user
          await prisma.session.deleteMany({
            where: {
              userId: session.userId,
              id: { not: session.id },
            },
          });
        },
      },
    },
  },
});
