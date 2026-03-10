// ─── Vercel Serverless Entry Point ──────────────────────────────────────────────
// Vercel routes ALL requests to this file via vercel.json rewrites.
// We simply re-export the Express app — Vercel handles the HTTP layer.
//
// NOTE: `app.listen()` is NOT called here; Vercel manages the server lifecycle.
// For local development, `src/server.ts` is still used (via `pnpm dev`).

import "dotenv/config";
import app from "../src/app.js";

export default app;
