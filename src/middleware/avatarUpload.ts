import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Only JPG, PNG, and WEBP images are allowed"));
      return;
    }

    callback(null, true);
  },
});

export const parseAvatarUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  avatarUpload.single("avatar")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Avatar file size must be 5MB or less" });
        return;
      }

      res.status(400).json({ error: err.message || "Invalid avatar upload payload" });
      return;
    }

    if (err instanceof Error) {
      res.status(400).json({ error: err.message || "Invalid avatar upload payload" });
      return;
    }

    res.status(400).json({ error: "Invalid avatar upload payload" });
  });
};
