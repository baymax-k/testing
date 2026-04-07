// ─── Problem of the Day Controller ──────────────────────────────────────────────
// Thin HTTP handlers calling the POTD service.

import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  getTodaysChallenge,
  solveDailyChallenge,
  getUserStreak,
  getPotdHistory,
  NotFoundError,
  ValidationError,
} from "../services/potd.service.js";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const solveSchema = z.object({
  dailyChallengeId: z.string().min(1),
  // For MCQ: `selectedOption` (integer index),
  // For DSA: `languageId` (Judge0 language id) and `sourceCode` (string)
  selectedOption: z.number().int().min(0).optional(),
  languageId: z.number().int().optional(),
  sourceCode: z.string().optional(),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ─── GET /api/v1/student/potd ─────────────────────────────────────────────────
export async function getTodaysPotd(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const result = await getTodaysChallenge(userId);

    if (!result) {
      res.status(404).json({
        error: "No daily challenge available. No MCQ questions in the database.",
      });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error("[getTodaysPotd]", error);
    res.status(500).json({ error: "Failed to fetch today's challenge" });
  }
}

// ─── POST /api/v1/student/potd/solve ──────────────────────────────────────────
export async function solvePotd(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const parsed = solveSchema.parse(req.body);

    const result = await solveDailyChallenge(
      userId,
      parsed.dailyChallengeId,
      // pass through the parsed payload (may contain selectedOption OR languageId+sourceCode)
      {
        selectedOption: parsed.selectedOption,
        languageId: parsed.languageId,
        sourceCode: parsed.sourceCode,
      }
    );
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("[solvePotd]", error);
    res.status(500).json({ error: "Failed to submit POTD answer" });
  }
}

// ─── GET /api/v1/student/potd/streak ──────────────────────────────────────────
export async function getStreak(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const streak = await getUserStreak(userId);
    res.json({ streak });
  } catch (error) {
    console.error("[getStreak]", error);
    res.status(500).json({ error: "Failed to fetch streak" });
  }
}

// ─── GET /api/v1/student/potd/history ─────────────────────────────────────────
export async function getPotdHistoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { page, limit } = historyQuerySchema.parse(req.query);

    const result = await getPotdHistory(userId, page, limit);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[getPotdHistory]", error);
    res.status(500).json({ error: "Failed to fetch POTD history" });
  }
}
