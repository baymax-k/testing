import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import nodemailer from "nodemailer";
import { getConfiguredOrigins, normalizeOrigin } from "./origins.js";
import { prisma } from "./prisma.js";
export { prisma } from "./prisma.js";

const trustedOrigins = getConfiguredOrigins();

const mailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number.parseInt(process.env.EMAIL_PORT || "2525", 10),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const auth = betterAuth({
  baseURL: normalizeOrigin(process.env.BETTER_AUTH_URL || "http://localhost:5000"),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  basePath: "/api/v1/auth",
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "student",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 10,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        let subject = "";
        let body = "";

        if (type === "email-verification") {
          subject = "Verify your email - CodeEthnics";
          body = `
            <h2>Email Verification</h2>
            <p>Your verification code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
            <p>This code expires in 10 minutes.</p>
          `;
        } else if (type === "forget-password") {
          subject = "Password Reset - CodeEthnics";
          body = `
            <h2>Password Reset Request</h2>
            <p>Your password reset code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
            <p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>
          `;
        } else {
          subject = "Sign-in Code - CodeEthnics";
          body = `
            <h2>Sign-in Code</h2>
            <p>Your sign-in code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
            <p>This code expires in 10 minutes.</p>
          `;
        }

        await mailTransporter.sendMail({
          from: `"CodeEthnics" <no-reply@codeethnics.local>`,
          to: email,
          subject,
          html: body,
        });
      },
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
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
