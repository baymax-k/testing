import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

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
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

/**
 * Middleware factory – checks that `req.user.role` matches the required role.
 * Must be used AFTER `requireAuth`.
 */
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;
    if (user?.role === role) {
      next();
    } else {
      res.status(403).json({ error: "Forbidden – insufficient permissions" });
    }
  };
};
