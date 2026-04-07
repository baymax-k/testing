import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { getStudentProfile } from "../services/student.service.js";

export async function getStudentProfileHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const result = await getStudentProfile(userId);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("[getStudentProfileHandler]", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}
