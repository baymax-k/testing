import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { PrismaClient } from "../generated/prisma/client.js";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── SSL config for AWS RDS (local dev uses cert file, Vercel uses system certs)
function buildDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  // On Vercel (production), system certs handle SSL — no extra config needed
  if (process.env.NODE_ENV === "production") return base;
  // Locally, use the downloaded RDS cert bundle if available
  const certPath = process.env.RDS_SSL_CERT
    ? path.resolve(__dirname, "../../..", process.env.RDS_SSL_CERT)
    : null;
  if (certPath && fs.existsSync(certPath)) {
    const ca = fs.readFileSync(certPath).toString();
    // Prisma reads ssl cert from NODE_EXTRA_CA_CERTS — set it at runtime
    process.env.NODE_EXTRA_CA_CERTS = certPath;
    console.log("[prisma] Using RDS SSL cert:", certPath);
  }
  return base;
}

// ─── Prisma singleton (serverless-safe) ──────────────────────────────────────
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: buildDatasourceUrl(),
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── Startup: warn about missing email env vars ──────────────────────────────
const requiredEmailEnv = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];
for (const key of requiredEmailEnv) {
  if (!process.env[key]) {
    console.warn(`[auth] WARNING: Missing environment variable: ${key} — email sending will fail`);
  }
}

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
  basePath: "/api/v1/auth",
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

  // ─── Email Verification (basic disabled, using OTP instead) ────────────────
  emailVerification: {
    sendOnSignUp: false, // Disabled: we use OTPs instead of links now
    autoSignInAfterVerification: true,
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
      sendVerificationOnSignUp: true, // Send a 6-digit OTP code on sign-up instead of a link
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

        try {
          await mailTransporter.sendMail({
            from: `"CodeEthnics" <no-reply@codeethnics.local>`,
            to: email,
            subject,
            html: body,
          });
        } catch (err) {
          console.error("[auth] Failed to send OTP email to", email, err);
          throw err; // re-throw so Better Auth can surface a 500 to the caller
        }
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
