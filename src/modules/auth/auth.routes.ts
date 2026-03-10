// ─── Auth Routes ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { loginLimiter, authLimiter } from "../../config/index.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  signUp,
  signIn,
  signOut,
  refresh,
  verifyEmail,
  sendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
} from "./auth.controller.js";

const router: Router = Router();

// Apply broad rate limit to all auth routes
router.use(authLimiter);

// ─── Public routes ────────────────────────────────────────────────────────────

// Credential endpoints — tighter rate limit (brute-force protection)
router.post("/sign-up", loginLimiter, signUp);
router.post("/sign-in", loginLimiter, signIn);

// Token management
router.post("/sign-out", signOut);
router.post("/refresh", refresh);

// Email verification
router.post("/verify-email", verifyEmail);
router.post("/send-otp", sendOtp);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ─── Authenticated routes ─────────────────────────────────────────────────────

router.post("/change-password", requireAuth, changePassword);

export default router;
