import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../../config/prisma.js";
import type {
  CreateUploadUrlInput,
  CreateVideoRecordInput,
  ListTestVideosInput,
  ReviewVideoInput,
} from "../validators/proctoring.validator.js";

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 300;
const DEFAULT_READ_URL_TTL_SECONDS = 180;
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

export class ProctoringServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "ProctoringServiceError";
    this.statusCode = statusCode;
  }
}

type ListWhere = {
  testId: string;
  attemptId?: string;
  studentId?: string;
  violationType?: string;
  reviewStatus?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET_PROCTORING;
  if (!bucket) {
    throw new ProctoringServiceError("AWS_S3_BUCKET_PROCTORING is not configured", 500);
  }
  return bucket;
}

function getUploadUrlTtl(): number {
  return Number(process.env.AWS_S3_UPLOAD_URL_TTL_SECONDS ?? DEFAULT_UPLOAD_URL_TTL_SECONDS);
}

function getReadUrlTtl(): number {
  return Number(process.env.AWS_S3_READ_URL_TTL_SECONDS ?? DEFAULT_READ_URL_TTL_SECONDS);
}

function getMaxUploadBytes(): number {
  return Number(process.env.PROCTORING_MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES);
}

function fileExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case "video/mp4":
      return "mp4";
    case "video/webm":
    default:
      return "webm";
  }
}

async function ensureStudentOwnsAttempt(studentId: string, testId: string, attemptId: string) {
  const attempt = await prisma.testAttempt.findFirst({
    where: {
      id: attemptId,
      testId,
      studentId,
    },
    select: {
      id: true,
      testId: true,
      studentId: true,
    },
  });

  if (!attempt) {
    throw new ProctoringServiceError("Test attempt not found for this student", 404);
  }

  return attempt;
}

function ensureObjectKeyPrefix(objectKey: string, testId: string, attemptId: string, studentId: string): void {
  const expectedPrefix = `proctoring/${testId}/${attemptId}/${studentId}/`;
  if (!objectKey.startsWith(expectedPrefix)) {
    throw new ProctoringServiceError("Invalid object key prefix", 422);
  }
}

export async function createVideoUploadUrl(studentId: string, input: CreateUploadUrlInput) {
  await ensureStudentOwnsAttempt(studentId, input.testId, input.attemptId);

  const extension = fileExtensionFromMime(input.mimeType);
  const objectKey = `proctoring/${input.testId}/${input.attemptId}/${studentId}/${Date.now()}-${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: getS3Bucket(),
    Key: objectKey,
    ContentType: input.mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: getUploadUrlTtl(),
  });

  return {
    uploadUrl,
    objectKey,
    expiresInSeconds: getUploadUrlTtl(),
    maxUploadBytes: getMaxUploadBytes(),
  };
}

export async function createProctoringVideoRecord(studentId: string, input: CreateVideoRecordInput) {
  await ensureStudentOwnsAttempt(studentId, input.testId, input.attemptId);
  ensureObjectKeyPrefix(input.objectKey, input.testId, input.attemptId, studentId);

  if (input.endedAt < input.startedAt) {
    throw new ProctoringServiceError("endedAt must be greater than or equal to startedAt", 400);
  }

  const durationMs = input.durationMs ?? input.endedAt.getTime() - input.startedAt.getTime();

  if (durationMs < 0) {
    throw new ProctoringServiceError("durationMs cannot be negative", 400);
  }

  try {
    const saved = await prisma.proctoringVideo.create({
      data: {
        studentId,
        testId: input.testId,
        attemptId: input.attemptId,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        violationType: input.violationType,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        durationMs,
        meta: input.meta,
        clientEventId: input.clientEventId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return {
      videoId: saved.id,
      status: "stored" as const,
      createdAt: saved.createdAt,
    };
  } catch (error) {
    const isUniqueConstraint =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUniqueConstraint && input.clientEventId) {
      throw new ProctoringServiceError("Duplicate clientEventId for this student", 409);
    }
    throw error;
  }
}

export async function listProctoringVideosForTest(testId: string, query: ListTestVideosInput) {
  const where: ListWhere = { testId };

  if (query.attemptId) {
    where.attemptId = query.attemptId;
  }

  if (query.studentId) {
    where.studentId = query.studentId;
  }

  if (query.violationType) {
    where.violationType = query.violationType;
  }

  if (query.reviewStatus) {
    where.reviewStatus = query.reviewStatus;
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = query.from;
    }
    if (query.to) {
      where.createdAt.lte = query.to;
    }
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.proctoringVideo.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip,
      select: {
        id: true,
        studentId: true,
        testId: true,
        attemptId: true,
        violationType: true,
        startedAt: true,
        endedAt: true,
        durationMs: true,
        reviewStatus: true,
        createdAt: true,
      },
    }),
    prisma.proctoringVideo.count({ where }),
  ]);

  return {
    items: items.map((video: {
      id: string;
      studentId: string;
      testId: string;
      attemptId: string;
      violationType: string;
      startedAt: Date;
      endedAt: Date;
      durationMs: number;
      reviewStatus: string;
      createdAt: Date;
    }) => ({
      videoId: video.id,
      studentId: video.studentId,
      testId: video.testId,
      attemptId: video.attemptId,
      violationType: video.violationType,
      startedAt: video.startedAt,
      endedAt: video.endedAt,
      durationMs: video.durationMs,
      reviewStatus: video.reviewStatus,
      createdAt: video.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}

export async function getProctoringVideoAccessUrl(videoId: string, disposition: "inline" | "attachment") {
  const video = await prisma.proctoringVideo.findUnique({
    where: { id: videoId },
    select: {
      objectKey: true,
    },
  });

  if (!video) {
    throw new ProctoringServiceError("Proctoring video not found", 404);
  }

  const command = new GetObjectCommand({
    Bucket: getS3Bucket(),
    Key: video.objectKey,
    ResponseContentDisposition: disposition,
  });

  const accessUrl = await getSignedUrl(s3Client, command, {
    expiresIn: getReadUrlTtl(),
  });

  return {
    accessUrl,
    expiresInSeconds: getReadUrlTtl(),
  };
}

export async function reviewProctoringVideo(videoId: string, reviewerId: string, input: ReviewVideoInput) {
  const existing = await prisma.proctoringVideo.findUnique({
    where: { id: videoId },
    select: { id: true },
  });

  if (!existing) {
    throw new ProctoringServiceError("Proctoring video not found", 404);
  }

  const updated = await prisma.proctoringVideo.update({
    where: { id: videoId },
    data: {
      reviewStatus: input.reviewStatus,
      reviewNote: input.reviewNote,
      severity: input.severity,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      reviewStatus: true,
      reviewedById: true,
      reviewedAt: true,
    },
  });

  return {
    videoId: updated.id,
    reviewStatus: updated.reviewStatus,
    reviewedBy: updated.reviewedById,
    reviewedAt: updated.reviewedAt,
  };
}
