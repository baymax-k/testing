import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from "../modules/auth/auth.service";
import type { AccessTokenPayload } from "../modules/auth/auth.service";
import { fromNodeHeaders } from "better-auth/node";
import { auth, prisma } from "../config/auth";
import { Prisma } from "@prisma/client";

export interface AuthRequest extends Request {
  user?: {
    // Common identifier used by existing JWT-based controllers
    userId: string;
    // Alias used by college-admin handlers
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    image?: string | null;
    phone?: string | null;
    departmentId?: string | null;
    collegeId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

/**
 * Default auth middleware for normal APIs.
 * Reads access_token cookie, verifies JWT, and attaches payload to req.user.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload: AccessTokenPayload = verifyAccessToken(token);
    (req as AuthRequest).user = {
      userId: payload.userId,
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      emailVerified: payload.emailVerified,
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

/**
 * College admin auth middleware.
 * Verifies Better Auth session and loads full user from DB.
 */
export const requireCollegeAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
        phone: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fullUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    (req as AuthRequest).user = {
      id: fullUser.id,
      userId: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      role: fullUser.role,
      emailVerified: fullUser.emailVerified,
      image: fullUser.image,
      phone: fullUser.phone,
      departmentId: fullUser.departmentId,
      createdAt: fullUser.createdAt,
      updatedAt: fullUser.updatedAt,
    };

    next();
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientUnknownRequestError ||
      err instanceof Prisma.PrismaClientInitializationError
    ) {
      console.error("[requireCollegeAdminAuth] Database error:", err);
      res.status(503).json({ error: "Service temporarily unavailable" });
      return;
    }
    console.error("[requireCollegeAdminAuth] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Middleware factory — checks req.user.role against the allowed roles.
 * Must be used AFTER requireAuth.
 */
export const requireRole = (...roles: string[]) => {
  if (roles.length === 0) {
    throw new Error("[requireRole] Called with no roles — pass at least one role.");
  }
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;
    if (user && roles.includes(user.role)) {
      next();
    } else {
      res.status(403).json({ error: "Forbidden – insufficient permissions" });
    }
  };
};
