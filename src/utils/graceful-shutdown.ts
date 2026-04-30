// ─── Graceful Shutdown Handler ────────────────────────────────────────────────
// Handles SIGTERM/SIGINT signals to cleanly close all connections

import { Server } from 'http';
import { prisma } from '../config/prisma.js';
import { closeRedis } from '../config/redis.js';
import { closeQueues } from '../config/bullmq.js';

export class GracefulShutdown {
  private server: Server | null = null;
  private isShuttingDown = false;

  /**
   * Register HTTP server for graceful shutdown
   */
  registerServer(server: Server): void {
    this.server = server;
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⏳ Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log(`\n📶 Received ${signal}, starting graceful shutdown...`);

    const shutdownTimeout = setTimeout(() => {
      console.error('❌ Graceful shutdown timeout - forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout

    try {
      // Step 1: Stop accepting new connections
      if (this.server) {
        console.log('🛑 Closing HTTP server...');
        await new Promise<void>((resolve, reject) => {
          this.server!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log('✓ HTTP server closed');
      }

      // Step 2: Close BullMQ queues
      console.log('🛑 Closing job queues...');
      await closeQueues();
      console.log('✓ Job queues closed');

      // Step 3: Close Redis connection
      console.log('🛑 Closing Redis connection...');
      await closeRedis();
      console.log('✓ Redis connection closed');

      // Step 4: Close database connection
      console.log('🛑 Closing database connection...');
      await prisma.$disconnect();
      console.log('✓ Database connection closed');

      clearTimeout(shutdownTimeout);
      console.log('✅ Graceful shutdown complete\n');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }

  /**
   * Setup signal handlers
   */
  setupHandlers(): void {
    // Handle SIGTERM (Docker, Kubernetes)
    process.on('SIGTERM', () => {
      this.shutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.shutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('UNHANDLED_REJECTION');
    });
  }
}

export const gracefulShutdown = new GracefulShutdown();
