// ─── Product Admin Hackathon Controller ────────────────────────────────────────

import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";

// ─── Validators ───────────────────────────────────────────────────────────────

const createHackathonSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().max(5000).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  collegeId: z.string().min(1, "College ID is required"),
  startDate: z.string().refine((val) => !Number.isNaN(Date.parse(val)), "Invalid start date"),
  endDate: z.string().refine((val) => !Number.isNaN(Date.parse(val)), "Invalid end date"),
  registrationDeadline: z.string().refine((val) => !Number.isNaN(Date.parse(val)), "Invalid registration deadline").optional().nullable(),
  maxTeams: z.number().positive().optional().nullable(),
  maxTeamSize: z.number().positive().int().default(5),
  minTeamSize: z.number().positive().int().default(1),
  theme: z.string().max(100).optional().nullable(),
  problemStatementUrl: z.url().optional().nullable(),
  isPublic: z.boolean().default(true),
  allowRemoteParticipation: z.boolean().default(true),
  prizesInfo: z.string().max(5000).optional().nullable(),
  rulesUrl: z.url().optional().nullable(),
});

const updateHackathonSchema = createHackathonSchema.partial();

const updateHackathonStatusSchema = z.object({
  status: z.enum(["draft", "registration_open", "in_progress", "completed", "cancelled"]),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  projectTitle: z.string().max(255).optional().nullable(),
  projectDescription: z.string().max(5000).optional().nullable(),
  repositoryUrl: z.url().optional().nullable(),
  demoUrl: z.url().optional().nullable(),
  score: z.number().min(0).optional().nullable(),
  ranking: z.number().positive().int().optional().nullable(),
});

// ─── Helper Functions ──────────────────────────────────────────────────────────

function safeHackathon(hackathon: any) {
  return {
    id: hackathon.id,
    title: hackathon.title,
    description: hackathon.description,
    shortDescription: hackathon.shortDescription,
    collegeId: hackathon.collegeId,
    status: hackathon.status,
    startDate: hackathon.startDate,
    endDate: hackathon.endDate,
    registrationDeadline: hackathon.registrationDeadline,
    maxTeams: hackathon.maxTeams,
    maxTeamSize: hackathon.maxTeamSize,
    minTeamSize: hackathon.minTeamSize,
    theme: hackathon.theme,
    problemStatementUrl: hackathon.problemStatementUrl,
    isPublic: hackathon.isPublic,
    allowRemoteParticipation: hackathon.allowRemoteParticipation,
    prizesInfo: hackathon.prizesInfo,
    rulesUrl: hackathon.rulesUrl,
    createdAt: hackathon.createdAt,
    updatedAt: hackathon.updatedAt,
    college: hackathon.college
      ? {
          id: hackathon.college.id,
          name: hackathon.college.name,
          code: hackathon.college.code,
        }
      : null,
    createdBy: hackathon.createdBy
      ? {
          id: hackathon.createdBy.id,
          email: hackathon.createdBy.email,
          name: hackathon.createdBy.name,
        }
      : null,
  };
}

function safeTeam(team: any) {
  return {
    id: team.id,
    hackathonId: team.hackathonId,
    name: team.name,
    description: team.description,
    leaderUserId: team.leaderUserId,
    projectTitle: team.projectTitle,
    projectDescription: team.projectDescription,
    repositoryUrl: team.repositoryUrl,
    demoUrl: team.demoUrl,
    score: team.score,
    ranking: team.ranking,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    leader: team.leader
      ? {
          id: team.leader.id,
          email: team.leader.email,
          name: team.leader.name,
        }
      : null,
  };
}

// ─── Create Hackathon ──────────────────────────────────────────────────────────

/**
 * POST /api/product-admin/hackathons
 * Create a new hackathon (super_admin only)
 */
export async function createHackathon(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Only super_admin can create hackathons
    if (req.user.role !== "super_admin") {
      res.status(403).json({ error: "Only super_admin can create hackathons" });
      return;
    }

    const validation = createHackathonSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { collegeId, ...hackathonData } = validation.data;

    // Check if college exists
    const college = await (prisma as any).college.findUnique({
      where: { id: collegeId },
    });

    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }

    // Validate dates
    const startDate = new Date(hackathonData.startDate);
    const endDate = new Date(hackathonData.endDate);

    if (endDate <= startDate) {
      res.status(400).json({ error: "End date must be after start date" });
      return;
    }

    if (hackathonData.registrationDeadline) {
      const regDeadline = new Date(hackathonData.registrationDeadline);
      if (regDeadline > startDate) {
        res.status(400).json({ error: "Registration deadline must be before start date" });
        return;
      }
    }

    if (hackathonData.maxTeamSize < hackathonData.minTeamSize) {
      res.status(400).json({ error: "Max team size must be >= min team size" });
      return;
    }

    const hackathon = await (prisma as any).hackathon.create({
      data: {
        ...hackathonData,
        collegeId,
        createdByUserId: req.user.userId,
      },
      include: {
        college: true,
        createdBy: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Hackathon created successfully",
      hackathon: safeHackathon(hackathon),
    });
  } catch (err: any) {
    console.error("[hackathon/create] Error:", err);
    res.status(500).json({ error: err.message || "Failed to create hackathon" });
  }
}

// ─── Get All Hackathons ───────────────────────────────────────────────────────

/**
 * GET /api/product-admin/hackathons
 * List all hackathons (with filtering options)
 */
export async function getHackathons(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { collegeId, status, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number.parseInt(page as string) || 1);
    const limitNum = Math.max(1, Math.min(100, Number.parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build filter based on role
    const whereFilter: any = {};

    if (req.user.role === "college_admin" && req.user.collegeId) {
      // College admin can only see their own college's hackathons
      whereFilter.collegeId = req.user.collegeId;
    } else if (req.user.role !== "super_admin") {
      // Non-admin cannot access this
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    // Apply optional filters
    if (collegeId) {
      whereFilter.collegeId = collegeId as string;
    }

    if (status) {
      whereFilter.status = status as string;
    }

    const [hackathons, totalCount] = await Promise.all([
      (prisma as any).hackathon.findMany({
        where: whereFilter,
        include: {
          college: true,
          createdBy: true,
          _count: {
            select: {
              teams: true,
              participants: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      (prisma as any).hackathon.count({ where: whereFilter }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      count: hackathons.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalCount,
      },
      hackathons: hackathons.map((h: any) => ({
        ...safeHackathon(h),
        _count: h._count,
      })),
    });
  } catch (err: any) {
    console.error("[hackathon/list] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch hackathons" });
  }
}

// ─── Get Hackathon by ID ───────────────────────────────────────────────────────

/**
 * GET /api/product-admin/hackathons/:hackathonId
 * Get detailed information about a specific hackathon
 */
export async function getHackathonById(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { hackathonId } = req.params;

    const hackathon = await (prisma as any).hackathon.findUnique({
      where: { id: hackathonId },
      include: {
        college: true,
        createdBy: true,
        teams: {
          include: {
            leader: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: true,
            team: true,
          },
        },
        _count: {
          select: {
            teams: true,
            participants: true,
          },
        },
      },
    });

    if (!hackathon) {
      res.status(404).json({ error: "Hackathon not found" });
      return;
    }

    // Check access permissions
    if (
      req.user.role === "college_admin" &&
      hackathon.collegeId !== req.user.collegeId
    ) {
      res.status(403).json({ error: "You don't have access to this hackathon" });
      return;
    }

    res.status(200).json({
      success: true,
      hackathon: {
        ...safeHackathon(hackathon),
        teams: hackathon.teams.map((t: any) => ({
          ...safeTeam(t),
          _count: t._count,
        })),
        participants: hackathon.participants.map((p: any) => ({
          id: p.id,
          userId: p.userId,
          teamId: p.teamId,
          status: p.status,
          joinedAt: p.joinedAt,
          user: {
            id: p.user.id,
            email: p.user.email,
            name: p.user.name,
          },
        })),
        _count: hackathon._count,
      },
    });
  } catch (err: any) {
    console.error("[hackathon/get] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch hackathon" });
  }
}

// ─── Update Hackathon ─────────────────────────────────────────────────────────

/**
 * PATCH /api/product-admin/hackathons/:hackathonId
 * Update hackathon details (super_admin only)
 */
export async function updateHackathon(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.user.role !== "super_admin") {
      res.status(403).json({ error: "Only super_admin can update hackathons" });
      return;
    }

    const { hackathonId } = req.params;
    const validation = updateHackathonSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const hackathon = await (prisma as any).hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      res.status(404).json({ error: "Hackathon not found" });
      return;
    }

    const updateData = validation.data;

    // Validate dates if provided
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate ? new Date(updateData.startDate) : hackathon.startDate;
      const endDate = updateData.endDate ? new Date(updateData.endDate) : hackathon.endDate;

      if (endDate <= startDate) {
        res.status(400).json({ error: "End date must be after start date" });
        return;
      }
    }

    if (updateData.registrationDeadline && updateData.startDate) {
      const regDeadline = new Date(updateData.registrationDeadline);
      const startDate = new Date(updateData.startDate);
      if (regDeadline > startDate) {
        res.status(400).json({ error: "Registration deadline must be before start date" });
        return;
      }
    }

    if (updateData.maxTeamSize && updateData.minTeamSize) {
      if (updateData.maxTeamSize < updateData.minTeamSize) {
        res.status(400).json({ error: "Max team size must be >= min team size" });
        return;
      }
    }

    const updated = await (prisma as any).hackathon.update({
      where: { id: hackathonId },
      data: updateData,
      include: {
        college: true,
        createdBy: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Hackathon updated successfully",
      hackathon: safeHackathon(updated),
    });
  } catch (err: any) {
    console.error("[hackathon/update] Error:", err);
    res.status(500).json({ error: err.message || "Failed to update hackathon" });
  }
}

// ─── Update Hackathon Status ──────────────────────────────────────────────────

/**
 * PATCH /api/product-admin/hackathons/:hackathonId/status
 * Update hackathon status (super_admin only)
 */
export async function updateHackathonStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.user.role !== "super_admin") {
      res.status(403).json({ error: "Only super_admin can update hackathon status" });
      return;
    }

    const { hackathonId } = req.params;
    const validation = updateHackathonStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const hackathon = await (prisma as any).hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      res.status(404).json({ error: "Hackathon not found" });
      return;
    }

    const updated = await (prisma as any).hackathon.update({
      where: { id: hackathonId },
      data: { status: validation.data.status },
      include: {
        college: true,
        createdBy: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `Hackathon status updated to ${validation.data.status}`,
      hackathon: safeHackathon(updated),
    });
  } catch (err: any) {
    console.error("[hackathon/status] Error:", err);
    res.status(500).json({ error: err.message || "Failed to update hackathon status" });
  }
}

// ─── Delete Hackathon ─────────────────────────────────────────────────────────

/**
 * DELETE /api/product-admin/hackathons/:hackathonId
 * Delete a hackathon (super_admin only)
 */
export async function deleteHackathon(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.user.role !== "super_admin") {
      res.status(403).json({ error: "Only super_admin can delete hackathons" });
      return;
    }

    const { hackathonId } = req.params;

    const hackathon = await (prisma as any).hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      res.status(404).json({ error: "Hackathon not found" });
      return;
    }

    await (prisma as any).hackathon.delete({
      where: { id: hackathonId },
    });

    res.status(200).json({
      success: true,
      message: "Hackathon deleted successfully",
    });
  } catch (err: any) {
    console.error("[hackathon/delete] Error:", err);
    res.status(500).json({ error: err.message || "Failed to delete hackathon" });
  }
}

// ─── Update Team (for results/scoring) ─────────────────────────────────────────

/**
 * PATCH /api/product-admin/hackathons/:hackathonId/teams/:teamId
 * Update team details (submission, scoring, etc.)
 */
export async function updateTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { hackathonId, teamId } = req.params;
    const validation = updateTeamSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    // Check hackathon access
    const hackathon = await (prisma as any).hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      res.status(404).json({ error: "Hackathon not found" });
      return;
    }

    // Check access permissions
    if (
      req.user.role === "college_admin" &&
      hackathon.collegeId !== req.user.collegeId
    ) {
      res.status(403).json({ error: "You don't have access to this hackathon" });
      return;
    }

    // Only super_admin or team lead can update
    const team = await (prisma as any).hackathonTeam.findUnique({
      where: { id: teamId },
      include: { leader: true },
    });

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    if (team.hackathonId !== hackathonId) {
      res.status(400).json({ error: "Team does not belong to this hackathon" });
      return;
    }

    if (req.user.role !== "super_admin" && team.leaderUserId !== req.user.userId) {
      res.status(403).json({ error: "Only team lead or super_admin can update team" });
      return;
    }

    const updated = await (prisma as any).hackathonTeam.update({
      where: { id: teamId },
      data: validation.data,
      include: {
        leader: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Team updated successfully",
      team: {
        ...safeTeam(updated),
        members: updated.members.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          status: m.status,
          user: {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
          },
        })),
      },
    });
  } catch (err: any) {
    console.error("[hackathon/team/update] Error:", err);
    res.status(500).json({ error: err.message || "Failed to update team" });
  }
}

// ─── Get Hackathon Statistics ─────────────────────────────────────────────────

/**
 * GET /api/product-admin/hackathons/:hackathonId/stats
 * Get participation and team statistics for a hackathon
 */
export async function getHackathonStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { hackathonId } = req.params;

    const hackathon = await (prisma as any).hackathon.findUnique({
      where: { id: hackathonId },
      include: {
        _count: {
          select: {
            teams: true,
            participants: true,
          },
        },
        teams: {
          select: {
            id: true,
            score: true,
            ranking: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
        participants: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!hackathon) {
      res.status(404).json({ error: "Hackathon not found" });
      return;
    }

    // Check access
    if (
      req.user.role === "college_admin" &&
      hackathon.collegeId !== req.user.collegeId
    ) {
      res.status(403).json({ error: "You don't have access to this hackathon" });
      return;
    }

    // Calculate statistics
    const teamsWithScore = hackathon.teams.filter((t: any) => t.score !== null).length;
    const teamsWithRanking = hackathon.teams.filter((t: any) => t.ranking !== null).length;
    const participantsByStatus = hackathon.participants.reduce(
      (acc: Record<string, number>, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    res.status(200).json({
      success: true,
      stats: {
        totalTeams: hackathon._count.teams,
        totalParticipants: hackathon._count.participants,
        teamsWithScores: teamsWithScore,
        teamsWithRankings: teamsWithRanking,
        participantsByStatus,
        avgTeamSize:
          hackathon._count.participants > 0
            ? (
                hackathon.teams.reduce(
                  (sum: number, t: any) => sum + (t._count?.members || 0),
                  0
                ) / hackathon._count.teams
              ).toFixed(2)
            : 0,
      },
    });
  } catch (err: any) {
    console.error("[hackathon/stats] Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch hackathon stats" });
  }
}
