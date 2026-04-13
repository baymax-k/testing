// ─── Import env validation FIRST to fail fast ─────────────────────────────────
import "dotenv/config";
import { env } from "./config/env.js";
import app from "./app.js";

// ─── Global Error Handlers (must be at top of server.ts) ─────────────────────
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ [FATAL] Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ [FATAL] Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(env.port, () => {
  console.log(`🚀 Server running on http://localhost:${env.port}/api/v1`);
  console.log(`📚 Swagger docs at http://localhost:${env.port}/api-docs`);
  if (env.nodeEnv !== "production") {
    console.log(`🧪 Test frontend at http://localhost:${env.port}/test`);
  }
  console.log(`Environment: ${env.nodeEnv}`);
});

// ─── Error handler for server startup failures ────────────────────────────────
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${env.port} is already in use. Change PORT env var or stop the process using that port.`);
  } else {
    console.error("❌ Server error:", error);
  }
  process.exit(1);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const gracefulShutdownSignals = ["SIGTERM", "SIGINT"];

gracefulShutdownSignals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n⏹️  Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log("✅ Server closed");
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error("⚠️  Forced shutdown after 30-second timeout");
      process.exit(1);
    }, 30000);
  });
});