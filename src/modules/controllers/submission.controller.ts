// ─── Submission Controller ──────────────────────────────────────────────────────

import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  runCodeSchema,
  submitCodeSchema,
  submissionQuerySchema,
} from "../validators/submission.validator.js";
import {
  runCode,
  submitCode,
  getSubmissions,
  getSubmissionById,
} from "../services/submission.service.js";
import { isJudge0Healthy, getJudge0Info } from "../services/judge0.service.js";

/**
 * POST /api/v1/submissions/run
 * Run code with custom stdin (playground mode, no save)
 */
export async function runCodeHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = runCodeSchema.parse(req.body);

    const result = await runCode(data.language, data.sourceCode, data.stdin);

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[run] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run code",
    });
  }
}

/**
 * POST /api/v1/submissions
 * Submit code against a problem's hidden test cases
 */
export async function submitCodeHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;

  try {
    const data = submitCodeSchema.parse(req.body);

    const result = await submitCode(
      user.userId,
      data.problemId,
      data.language,
      data.sourceCode
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }

    console.error("[submit] Error:", error);

    // Check if it's a "Problem not found" error
    if (error instanceof Error && error.message.includes("Problem not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to submit code",
    });
  }
}

/**
 * GET /api/v1/submissions
 * Get user's submission history
 */
export async function listSubmissionsHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;

  try {
    const query = submissionQuerySchema.parse(req.query);

    const { submissions, total } = await getSubmissions(user.userId, {
      problemId: query.problemId,
      limit: query.limit,
      offset: query.offset,
    });

    res.json({
      submissions,
      total,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[listSubmissions] Error:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
}

/**
 * GET /api/v1/submissions/:id
 * Get a single submission detail
 */
export async function getSubmissionHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;
  const id = req.params.id as string;

  try {
    const submission = await getSubmissionById(id, user.userId);
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json({ submission });
  } catch (error) {
    console.error("[getSubmission] Error:", error);
    res.status(500).json({ error: "Failed to fetch submission" });
  }
}

/**
 * GET /api/v1/judge0/health
 * Check if Judge0 is reachable
 */
export async function judge0HealthHandler(_req: Request, res: Response): Promise<void> {
  try {
    const healthy = await isJudge0Healthy();
    const info = healthy ? await getJudge0Info() : null;

    if (healthy) {
      res.json({ status: "ok", judge0: info });
    } else {
      res.status(503).json({ status: "unavailable", error: "Judge0 is not reachable" });
    }
  } catch (error) {
    console.error("[judge0Health] Error:", error);
    res.status(503).json({ status: "unavailable", error: "Judge0 health check failed" });
  }
}
