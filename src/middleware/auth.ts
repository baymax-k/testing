import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { Prisma } from "../generated/prisma/client.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Middleware that verifies the session cookie via Better Auth.
 * Attaches `req.user` on success; returns 401 otherwise.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user) {
      (req as AuthRequest).user = session.user as AuthRequest["user"];
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  } catch (err) {
    // DB errors as 503 so monitors don't mistake an outage for an auth failure
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientUnknownRequestError ||
      err instanceof Prisma.PrismaClientInitializationError
    ) {
      console.error("[requireAuth] Database error:", err);
      res.status(503).json({ error: "Service temporarily unavailable" });
      return;
    }
    console.error("[requireAuth] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Middleware factory – checks that `req.user.role` matches the required role.
 * Must be used AFTER `requireAuth`.
 * Throws at startup if called with no roles (would block every user silently).
 */
export const requireRole = (...roles: string[]) => {
  if (roles.length === 0) {
    throw new Error(
      "[requireRole] Called with no roles — this would block ALL users. Pass at least one role."
    );
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
