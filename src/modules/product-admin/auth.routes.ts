// ─── Product Admin Auth Routes ────────────────────────────────────────────────

import { Router } from "express";
import { loginLimiter, authLimiter } from "../../config/index.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  signUp,
  signIn,
  signOut,
  refresh,
  verifyEmail,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  getCurrentUser,
  updateProfile,
  getSettings,
  updateSettings,
} from "./auth.controller.js";

const router: Router = Router();

// Apply broad rate limit to all product admin auth routes
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

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtp);
router.post("/reset-password", resetPassword);

// ─── Authenticated routes ─────────────────────────────────────────────────────

router.get("/me", requireAuth, getCurrentUser);

// ─── Profile & Settings ───────────────────────────────────────────────────────

router.patch("/profile", requireAuth, updateProfile);
router.get("/settings", requireAuth, getSettings);
router.patch("/settings", requireAuth, updateSettings);

export default router;
