import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  recordPracticeActivity,
  getPracticeActivity,
  getPracticeActivityRange,
} from "../services/practiceActivity.service.js";

const activitySchema = z.object({
  type: z.enum(["mcq", "dsa", "visit", "solve"]),
});

export async function postPracticeActivity(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { type } = activitySchema.parse(req.body);

    const row = await recordPracticeActivity(userId, { type });
    res.json({ activity: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[postPracticeActivity]", error);
    res.status(500).json({ error: "Failed to record activity" });
  }
}

const activityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function getPracticeActivityHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { days } = activityQuerySchema.parse(req.query);

    if (days) {
      const rows = await getPracticeActivityRange(userId, days);
      res.json({ activity: rows });
      return;
    }

    const row = await getPracticeActivity(userId);
    res.json({ activity: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error("[getPracticeActivityHandler]", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
}
