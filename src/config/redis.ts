// ─── Redis Singleton Configuration ─────────────────────────────────────────

import { Redis, type RedisOptions } from "ioredis"; // ← named import, not default

let redisClient: Redis | null = null;
let sigTermRegistered = false;

const MAX_RETRIES = 3;

function buildRedisOptions(): RedisOptions {
  const baseConfig: RedisOptions = {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      if (times > MAX_RETRIES) return null;
      return Math.min(times * 50, 2000);
    },
    enableReadyCheck: true,
    lazyConnect: false,
  };

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  };
}

export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  const options = buildRedisOptions();

  redisClient = redisUrl
    ? new Redis(redisUrl, options)
    : new Redis(options);

  redisClient.on("connect", () => console.log("✓ Redis connected"));
  redisClient.on("error", (err: Error) => console.error("✗ Redis error:", err.message)); // ← explicit Error type
  redisClient.on("close", () => console.log("Redis connection closed"));

  if (!sigTermRegistered) {
    sigTermRegistered = true;
    process.on("SIGTERM", () => void closeRedis());
  }

  return redisClient;
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    return (await getRedisClient().ping()) === "PONG";
  } catch (err) {
    console.error("Redis health check failed:", err);
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}