import { Router, type Router as RouterType } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  createProctoringVideoRecordHandler,
  createVideoUploadUrlHandler,
  getProctoringVideoAccessUrlHandler,
  listTestProctoringVideosHandler,
  reviewProctoringVideoHandler,
} from "../controllers/proctoring.controller.js";

const router: RouterType = Router();

const reviewerRoles = [
  "mentor",
  "instructor_staff",
  "dept_admin",
  "hod",
  "principal",
  "college_admin",
  "super_admin",
  "product_admin",
] as const;

// Student endpoints
router.post("/videos/upload-url", requireAuth, requireRole("student"), createVideoUploadUrlHandler);
router.post("/videos", requireAuth, requireRole("student"), createProctoringVideoRecordHandler);

// Reviewer endpoints
router.get(
  "/tests/:testId/videos",
  requireAuth,
  requireRole(...reviewerRoles),
  listTestProctoringVideosHandler
);

router.get(
  "/videos/:videoId/access-url",
  requireAuth,
  requireRole(...reviewerRoles),
  getProctoringVideoAccessUrlHandler
);

router.patch(
  "/videos/:videoId/review",
  requireAuth,
  requireRole(...reviewerRoles),
  reviewProctoringVideoHandler
);

export default router;
