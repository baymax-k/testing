import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  createUploadUrlSchema,
  createVideoRecordSchema,
  getVideoAccessUrlSchema,
  listTestVideosSchema,
  reviewVideoSchema,
} from "../validators/proctoring.validator.js";
import {
  ProctoringServiceError,
  createProctoringVideoRecord,
  createVideoUploadUrl,
  getProctoringVideoAccessUrl,
  listProctoringVideosForTest,
  reviewProctoringVideo,
} from "../services/proctoring.service.js";

function handleProctoringError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.issues });
    return;
  }

  if (error instanceof ProctoringServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error("[proctoring] Error:", error);
  res.status(500).json({ error: fallbackMessage });
}

export async function createVideoUploadUrlHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;

  try {
    const input = createUploadUrlSchema.parse(req.body);
    const result = await createVideoUploadUrl(user.userId, input);
    res.status(200).json(result);
  } catch (error) {
    handleProctoringError(res, error, "Failed to generate upload URL");
  }
}

export async function createProctoringVideoRecordHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;

  try {
    const input = createVideoRecordSchema.parse(req.body);
    const result = await createProctoringVideoRecord(user.userId, input);
    res.status(201).json(result);
  } catch (error) {
    handleProctoringError(res, error, "Failed to save proctoring video metadata");
  }
}

export async function listTestProctoringVideosHandler(req: Request, res: Response): Promise<void> {
  const testId = req.params.testId as string;

  try {
    const query = listTestVideosSchema.parse(req.query);
    const result = await listProctoringVideosForTest(testId, query);
    res.status(200).json(result);
  } catch (error) {
    handleProctoringError(res, error, "Failed to fetch proctoring videos");
  }
}

export async function getProctoringVideoAccessUrlHandler(req: Request, res: Response): Promise<void> {
  const videoId = req.params.videoId as string;

  try {
    const query = getVideoAccessUrlSchema.parse(req.query);
    const result = await getProctoringVideoAccessUrl(videoId, query.disposition);
    res.status(200).json(result);
  } catch (error) {
    handleProctoringError(res, error, "Failed to generate video access URL");
  }
}

export async function reviewProctoringVideoHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user!;
  const videoId = req.params.videoId as string;

  try {
    const input = reviewVideoSchema.parse(req.body);
    const result = await reviewProctoringVideo(videoId, user.userId, input);
    res.status(200).json(result);
  } catch (error) {
    handleProctoringError(res, error, "Failed to review proctoring video");
  }
}
