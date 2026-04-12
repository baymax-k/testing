import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { getStudentDashboard } from "../services/student-dashboard.service.js";

export async function getStudentDashboardHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const dashboardData = await getStudentDashboard(userId);
    
    res.json({
      success: true,
      data: {
        panel: "student",
        message: `Welcome back, ${(req as AuthRequest).user!.name}!`,
        ...dashboardData
      }
    });
  } catch (error) {
    console.error("[getStudentDashboardHandler]", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch dashboard data" 
    });
  }
}