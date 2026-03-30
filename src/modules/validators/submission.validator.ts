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
 * POST /api/v1/submissions/test
 * Pre-submit test against sample test cases only
 */
export const preSubmitCodeSchema = z.object({
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

export type PreSubmitCodeInput = z.infer<typeof preSubmitCodeSchema>;

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
const submissionStatusValues = [
  "processing",
  "accepted",
  "wrong_answer",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "runtime_error",
  "compilation_error",
  "internal_error",
] as const;

export const submissionQuerySchema = z.object({
  problemId: z.string().optional(),
  status: z.enum(submissionStatusValues).optional(),
  language: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export type SubmissionQueryInput = z.infer<typeof submissionQuerySchema>;
