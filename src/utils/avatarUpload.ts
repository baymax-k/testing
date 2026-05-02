import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type AvatarScope = "college-admin" | "product-admin";

type UploadAvatarToS3Input = {
  fileBuffer: Buffer;
  mimeType: string;
  userId: string;
  scope: AvatarScope;
};

type UploadAvatarToS3Result = {
  key: string;
  url: string;
};

type PresignAvatarUploadInput = {
  userId: string;
  scope: AvatarScope;
  mimeType: string;
  expiresInSeconds?: number;
};

type PresignAvatarUploadResult = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
};

const DEFAULT_AVATAR_FOLDER = "avatars";
const DEFAULT_PRESIGN_TTL_SECONDS = 600;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function requireEnv(name: string, fallbacks: string[] = []): string {
  const envKeys = [name, ...fallbacks];

  for (const key of envKeys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  throw new Error(`Missing required environment variable: ${envKeys.join(" or ")}`);
}

function getS3Client(): S3Client {
  const region = requireEnv("AWS_REGION", ["AWS_DEFAULT_REGION"]);
  const accessKeyId = requireEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("AWS_SECRET_ACCESS_KEY");

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function ensureAvatarMimeType(mimeType: string): void {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported avatar mime type");
  }
}

function buildAvatarKey(scope: AvatarScope, userId: string, mimeType: string): string {
  const extension = extensionFromMimeType(mimeType);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");

  return `${DEFAULT_AVATAR_FOLDER}/${scope}/${userId}/${timestamp}-${random}.${extension}`;
}

function toPublicUrl(bucket: string, region: string, key: string): string {
  const configuredBase = process.env.AWS_S3_PUBLIC_BASE_URL?.trim();
  if (configuredBase) {
    const normalizedBase = configuredBase.endsWith("/")
      ? configuredBase.slice(0, -1)
      : configuredBase;

    return `${normalizedBase}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export function getAvatarPublicUrl(key: string): string {
  const bucket = requireEnv("AWS_S3_BUCKET", ["AWS_S3_BUCKET_NAME", "S3_BUCKET_NAME"]);
  const region = requireEnv("AWS_REGION", ["AWS_DEFAULT_REGION"]);
  return toPublicUrl(bucket, region, key);
}

export async function uploadAvatarToS3(
  input: UploadAvatarToS3Input
): Promise<UploadAvatarToS3Result> {
  ensureAvatarMimeType(input.mimeType);
  const bucket = requireEnv("AWS_S3_BUCKET", ["AWS_S3_BUCKET_NAME", "S3_BUCKET_NAME"]);
  const region = requireEnv("AWS_REGION", ["AWS_DEFAULT_REGION"]);

  const key = buildAvatarKey(input.scope, input.userId, input.mimeType);

  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.fileBuffer,
      ContentType: input.mimeType,
      CacheControl: "public, max-age=31536000",
    })
  );

  return {
    key,
    url: toPublicUrl(bucket, region, key),
  };
}

export async function generateAvatarUploadUrl(
  input: PresignAvatarUploadInput
): Promise<PresignAvatarUploadResult> {
  ensureAvatarMimeType(input.mimeType);

  const bucket = requireEnv("AWS_S3_BUCKET", ["AWS_S3_BUCKET_NAME", "S3_BUCKET_NAME"]);
  const region = requireEnv("AWS_REGION", ["AWS_DEFAULT_REGION"]);
  const key = buildAvatarKey(input.scope, input.userId, input.mimeType);

  const s3 = getS3Client();
  const expiresIn = input.expiresInSeconds ?? DEFAULT_PRESIGN_TTL_SECONDS;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.mimeType,
      CacheControl: "public, max-age=31536000",
    }),
    { expiresIn }
  );

  return {
    key,
    uploadUrl,
    publicUrl: toPublicUrl(bucket, region, key),
    expiresIn,
  };
}
