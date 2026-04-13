// ─── Async Route Wrapper ──────────────────────────────────────────────────────
// Wraps async route handlers to catch unhandled promise rejections.
// Usage: app.get('/path', asyncRoute(async (req, res) => { ... }))

import type { Request, Response, NextFunction } from "express";

export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
