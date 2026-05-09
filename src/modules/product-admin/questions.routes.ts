// ─── Product Admin Question Routes ──────────────────────────────────────────

import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";

const router: Router = Router();

// All routes require authentication as product admin
router.use(requireAuth);
router.use(requireRole("product_admin"));

/**
 * @openapi
 * /api/product-admin/questions/coding:
 *   get:
 *     tags: [Product Admin - Questions]
 *     summary: Retrieve all coding questions
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: List of coding questions
 */
router.get("/coding", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const questions = await prisma.question.findMany({
      where: {
        type: { in: ["dsa", "coding"] },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        description: true,
        difficulty: true,
        company: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        testId: true,
        marks: true,
        orderIndex: true,
        options: true,
        explanation: true,
        timeLimit: true,
        memoryLimit: true,
        sampleTestCases: true,
        hiddenTestCases: true,
        tags: true,
      },
    });

    const total = await prisma.question.count({
      where: {
        type: { in: ["dsa", "coding"] },
      },
    });

    res.json({
      success: true,
      data: questions,
      meta: { total, page, limit },
    });
  } catch (error: unknown) {
    console.error("[product-admin/questions/coding] Error:", error);
    res.status(500).json({ error: "Failed to retrieve coding questions" });
  }
});

/**
 * @openapi
 * /api/product-admin/questions/mcq:
 *   get:
 *     tags: [Product Admin - Questions]
 *     summary: Retrieve all MCQ questions
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: List of MCQ questions
 */
router.get("/mcq", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const questions = await prisma.question.findMany({
      where: {
        type: { in: ["mcq", "multiple_choice", "true_false"] },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        description: true,
        difficulty: true,
        company: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        testId: true,
        marks: true,
        orderIndex: true,
        options: true,
        explanation: true,
        timeLimit: true,
        memoryLimit: true,
        sampleTestCases: true,
        hiddenTestCases: true,
        tags: true,
      },
    });

    const total = await prisma.question.count({
      where: {
        type: { in: ["mcq", "multiple_choice", "true_false"] },
      },
    });

    res.json({
      success: true,
      data: questions,
      meta: { total, page, limit },
    });
  } catch (error: unknown) {
    console.error("[product-admin/questions/mcq] Error:", error);
    res.status(500).json({ error: "Failed to retrieve MCQ questions" });
  }
});

export default router;
