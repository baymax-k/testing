// ─── Import env validation FIRST to fail fast ─────────────────────────────────
import "dotenv/config";
import { env } from "./config/env.js";
import { startupValidator } from "./utils/startup-validator.js";
import { gracefulShutdown } from "./utils/graceful-shutdown.js";
import app from "./app.js";

// ─── Setup Graceful Shutdown Handlers ─────────────────────────────────────────
gracefulShutdown.setupHandlers();

// ─── Startup Validation & Server Start ────────────────────────────────────────
async function startServer() {
  try {
    // Validate all critical services before starting
    const validation = await startupValidator.validateAll();
    
    if (!validation.success) {
      console.error('\n❌ FATAL: Cannot start server due to critical service failures:');
      validation.criticalFailures.forEach(failure => {
        console.error(`   - ${failure}`);
      });
      console.error('\n💡 Fix these issues and try again.\n');
      process.exit(1);
    }
    
    // Start HTTP server
    const server = app.listen(env.port, () => {
      console.log(`🚀 Server running on http://localhost:${env.port}/api/v1`);
      console.log(`📚 Swagger docs at http://localhost:${env.port}/api-docs`);
      if (env.nodeEnv !== "production") {
        console.log(`🧪 Test frontend at http://localhost:${env.port}/test`);
      }
      console.log(`Environment: ${env.nodeEnv}`);
      console.log('');
    });
    
    // Register server for graceful shutdown
    gracefulShutdown.registerServer(server);
    
    // Error handler for server startup failures
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${env.port} is already in use. Change PORT env var or stop the process using that port.`);
      } else {
        console.error("❌ Server error:", error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ FATAL: Server startup failed:', error);
    process.exit(1);
  }
}

// Start the server
startServer();