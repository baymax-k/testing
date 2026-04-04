import { z } from "zod";

const violationTypes = [
  "NO_FACE_DETECTED",
  "MULTIPLE_FACES",
  "OFF_SCREEN_GAZE",
  "TAB_SWITCH",
  "FULLSCREEN_EXIT",
  "OTHER",
] as const;

const reviewStatuses = ["pending", "confirmed", "dismissed", "needs_review"] as const;
const severities = ["low", "medium", "high"] as const;
const mimeTypes = ["video/webm", "video/mp4"] as const;

export const createUploadUrlSchema = z.object({
  testId: z.string().min(1, "testId is required"),
  attemptId: z.string().min(1, "attemptId is required"),
  violationType: z.enum(violationTypes),
  mimeType: z.enum(mimeTypes),
  segmentStartMs: z.number().int().min(0).optional(),
  segmentEndMs: z.number().int().min(0).optional(),
  clientEventId: z.string().max(128).optional(),
});

export const createVideoRecordSchema = z.object({
  testId: z.string().min(1, "testId is required"),
  attemptId: z.string().min(1, "attemptId is required"),
  objectKey: z.string().min(1, "objectKey is required"),
  mimeType: z.enum(mimeTypes),
  violationType: z.enum(violationTypes),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  durationMs: z.number().int().min(0).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  clientEventId: z.string().max(128).optional(),
});

export const listTestVideosSchema = z.object({
  attemptId: z.string().optional(),
  studentId: z.string().optional(),
  violationType: z.enum(violationTypes).optional(),
  reviewStatus: z.enum(reviewStatuses).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const getVideoAccessUrlSchema = z.object({
  disposition: z.enum(["inline", "attachment"]).default("inline"),
});

export const reviewVideoSchema = z.object({
  reviewStatus: z.enum(["confirmed", "dismissed", "needs_review"]),
  reviewNote: z.string().max(2000).optional(),
  severity: z.enum(severities).optional(),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;
export type CreateVideoRecordInput = z.infer<typeof createVideoRecordSchema>;
export type ListTestVideosInput = z.infer<typeof listTestVideosSchema>;
export type GetVideoAccessUrlInput = z.infer<typeof getVideoAccessUrlSchema>;
export type ReviewVideoInput = z.infer<typeof reviewVideoSchema>;
