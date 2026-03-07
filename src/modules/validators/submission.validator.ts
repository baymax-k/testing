// ─── Submission Validators (Zod Schemas) ────────────────────────────────────────

import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../services/judge0.service.js";

/**
 * POST /api/v1/submissions/run
 * Run code with custom stdin (playground mode)
 */
export const runCodeSchema = z.object({
  language: z
    .string()
    .refine((lang) => SUPPORTED_LANGUAGES.includes(lang), {
      message: `Unsupported language. Allowed: ${SUPPORTED_LANGUAGES.join(", ")}`,
    }),
  sourceCode: z
    .string()
    .min(1, "Source code is required")
    .max(100_000, "Source code too large (max 100KB)"),
  stdin: z.string().max(10_000, "stdin too large (max 10KB)").optional(),
});

export type RunCodeInput = z.infer<typeof runCodeSchema>;

/**
 * POST /api/v1/submissions
 * Submit code against a problem's test cases
 */
export const submitCodeSchema = z.object({
  problemId: z.string().min(1, "Problem ID is required"),
  language: z
    .string()
    .refine((lang) => SUPPORTED_LANGUAGES.includes(lang), {
      message: `Unsupported language. Allowed: ${SUPPORTED_LANGUAGES.join(", ")}`,
    }),
  sourceCode: z
    .string()
    .min(1, "Source code is required")
    .max(100_000, "Source code too large (max 100KB)"),
});

export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;

/**
 * GET /api/v1/submissions query params
 */
export const submissionQuerySchema = z.object({
  problemId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type SubmissionQueryInput = z.infer<typeof submissionQuerySchema>;
