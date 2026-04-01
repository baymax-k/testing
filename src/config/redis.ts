// ─── Redis Singleton Configuration ─────────────────────────────────────────
// Single Redis connection shared across the application for BullMQ and caching

import Redis from "ioredis";

let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    const baseConfig = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        // Exponential backoff: 50ms, 100ms, 200ms, etc. (max 3 retries)
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: false,
    } satisfies Redis.RedisOptions;

    if (redisUrl) {
      redisClient = new Redis(redisUrl, baseConfig);
    } else {
      redisClient = new Redis(
        {
          host: redisHost,
          port: redisPort,
          password: redisPassword,
        },
        baseConfig
      );
    }

    // Event handlers
    redisClient.on("connect", () => {
      console.log("✓ Redis connected");
    });

    redisClient.on("error", (err) => {
      console.error("✗ Redis connection error:", err.message);
    });

    redisClient.on("close", () => {
      console.log("Redis connection closed");
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      if (redisClient) {
        await redisClient.quit();
        redisClient = null;
      }
    });
  }

  return redisClient;
}

/**
 * Check if Redis is healthy and responsive
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}

/**
 * Close Redis connection (for testing/graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
