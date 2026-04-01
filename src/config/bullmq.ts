// ─── BullMQ Queue Configuration ────────────────────────────────────────────
// Shared configuration for Arduino compilation and submission queues

import { Queue, QueueOptions, WorkerOptions } from "bullmq";
import { getRedisClient } from "./redis.js";

// ─── Queue Names ────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  ARDUINO_COMPILE: "arduino:compile", // For Run jobs (compile only)
  ARDUINO_SUBMIT: "arduino:submit", // For Submit jobs (compile + grade)
} as const;

// ─── Queue Configuration ────────────────────────────────────────────────────

/**
 * Shared BullMQ connection configuration
 */
export const getQueueConnection = () => {
  return {
    connection: getRedisClient(),
  };
};

/**
 * Default queue options for all Arduino queues
 */
export const defaultQueueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 2, // Retry once on failure
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, then 4s
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7200, // Keep failed jobs for 2 hours for debugging
    },
  },
};

/**
 * Default worker options for all Arduino workers
 */
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  concurrency: 8, // Process up to 8 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs per 1000ms per worker
    duration: 1000,
  },
};

// ─── Queue Factory ──────────────────────────────────────────────────────────

/**
 * Create a BullMQ queue with default configuration
 */
export function createQueue<T = any>(name: string): Queue<T> {
  return new Queue<T>(name, {
    ...getQueueConnection(),
    ...defaultQueueOptions,
  });
}

// ─── Queue Instances ────────────────────────────────────────────────────────
// These are lazy-initialized when first accessed

let compileQueue: Queue | null = null;
let submitQueue: Queue | null = null;

/**
 * Get Arduino compile queue (Run jobs)
 */
export function getCompileQueue(): Queue {
  if (!compileQueue) {
    compileQueue = createQueue(QUEUE_NAMES.ARDUINO_COMPILE);
  }
  return compileQueue;
}

/**
 * Get Arduino submit queue (Submit jobs)
 */
export function getSubmitQueue(): Queue {
  if (!submitQueue) {
    submitQueue = createQueue(QUEUE_NAMES.ARDUINO_SUBMIT);
  }
  return submitQueue;
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

/**
 * Close all queues gracefully
 */
export async function closeQueues(): Promise<void> {
  const queues = [compileQueue, submitQueue].filter(Boolean) as Queue[];

  await Promise.all(queues.map((q) => q.close()));

  compileQueue = null;
  submitQueue = null;

  console.log("✓ All BullMQ queues closed");
}

process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
