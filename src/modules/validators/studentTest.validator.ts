// ─── Student Test Validators (Zod Schemas) ──────────────────────────────────────

import { z } from "zod";

/**
 * GET /api/v1/student/tests
 * Query parameters for listing assigned tests with pagination and filtering
 */
export const listTestsQuerySchema = z.object({
  limit: z
    .string()
    .default("20")
    .transform((v) => {
      const num = parseInt(v, 10);
      if (isNaN(num) || num < 1) return 20;
      if (num > 100) return 100;
      return num;
    }),
  offset: z
    .string()
    .default("0")
    .transform((v) => {
      const num = parseInt(v, 10);
      if (isNaN(num) || num < 0) return 0;
      return num;
    }),
  difficulty: z
    .string()
    .optional()
    .refine(
      (v) => !v || ["easy", "medium", "hard"].includes(v),
      "Difficulty must be 'easy', 'medium', or 'hard'"
    ),
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((t) => t.trim()) : undefined)),
  status: z
    .string()
    .optional()
    .refine(
      (v) =>
        !v || ["draft", "scheduled", "active", "completed", "archived"].includes(v),
      "Invalid test status"
    ),
});

export type ListTestsQueryInput = z.infer<typeof listTestsQuerySchema>;

/**
 * POST /api/v1/student/tests/:id/submit
 * Test submission payload with student answers
 */
export const submitTestSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1, "Question ID is required"),
        selectedAnswer: z
          .union([
            z.number().int().min(0).max(3), // MCQ: option index 0-3
            z.string(), // Short/long answer text
          ])
          .optional(), // Optional for cases where student skipped
      })
    )
    .min(1, "At least one answer is required"),
});

export type SubmitTestInput = z.infer<typeof submitTestSchema>;
