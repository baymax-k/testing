import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from "../modules/auth/auth.service.js";
import type { AccessTokenPayload } from "../modules/auth/auth.service.js";

export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Reads the access_token cookie, verifies its JWT signature, and attaches
 * the decoded payload to req.user. No database hit — pure crypto verification.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
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
