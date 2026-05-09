// ─── Student Test Controller ────────────────────────────────────────────────────

import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  listAssignedTests,
  getTestDetail,
  submitTestAttempt,
  getTestAttempt,
} from "../services/studentTest.service.js";
import {
  listTestsQuerySchema,
  submitTestSchema,
} from "../validators/studentTest.validator.js";
import { ZodError } from "zod";

/**
 * GET /api/v1/student/tests
 * List all tests assigned to the student
 */
export async function listTestsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;

    // Parse and validate query parameters
    const queryData = listTestsQuerySchema.parse(req.query);

    const { tests, total } = await listAssignedTests(
      userId,
      queryData.limit,
      queryData.offset,
      {
        difficulty: queryData.difficulty,
        tags: queryData.tags,
        status: queryData.status,
      }
    );

    res.json({
      data: {
        tests,
        pagination: {
          limit: queryData.limit,
          offset: queryData.offset,
          total,
          hasMore: queryData.offset + queryData.limit < total,
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.message === "Student not found") {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("[listTestsHandler]", error);
    res.status(500).json({ error: "Failed to fetch tests" });
  }
}

/**
 * GET /api/v1/student/tests/:id
 * Get detailed information about a specific test
 */
export async function getTestHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Invalid test ID" });
      return;
    }

    const test = await getTestDetail(userId, id);

    if (!test) {
      res.status(404).json({ error: "Test not found or not accessible" });
      return;
    }

    res.json({
      data: { test },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Student not found") {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("[getTestHandler]", error);
    res.status(500).json({ error: "Failed to fetch test" });
  }
}

/**
 * POST /api/v1/student/tests/:id/submit
 * Submit test attempt with answers
 */
export async function submitTestHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Invalid test ID" });
      return;
    }

    // Validate request body
    const bodyData = submitTestSchema.parse(req.body);

    const result = await submitTestAttempt(userId, id, bodyData.answers);

    res.json({
      data: { submission: result },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid submission data",
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message === "Test not found or not accessible") {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error.message === "Student not found") {
        res.status(404).json({ error: error.message });
        return;
      }

      if (
        error.message === "Test has not started yet" ||
        error.message === "Test submission period has ended"
      ) {
        res.status(409).json({ error: error.message });
        return;
      }

      if (error.message.startsWith("Maximum attempts")) {
        res.status(403).json({ error: error.message });
        return;
      }
    }

    console.error("[submitTestHandler]", error);
    res.status(500).json({ error: "Failed to submit test" });
  }
}

/**
 * GET /api/v1/student/tests/:id/attempts/:attemptNumber
 * Get details of a previous test attempt (optional endpoint)
 */
export async function getTestAttemptHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id, attemptNumber } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Invalid test ID" });
      return;
    }

    const attemptNum = attemptNumber ? parseInt(attemptNumber, 10) : undefined;

    const attempt = await getTestAttempt(userId, id, attemptNum);

    if (!attempt) {
      res.status(404).json({ error: "Test attempt not found" });
      return;
    }

    res.json({
      data: { attempt },
    });
  } catch (error) {
    console.error("[getTestAttemptHandler]", error);
    res.status(500).json({ error: "Failed to fetch test attempt" });
  }
}
