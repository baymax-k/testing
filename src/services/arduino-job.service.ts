import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
// Remove UUID - use Prisma's default CUID generation
const redisClient = getRedisClient();

interface ArduinoCompileJobData {
  submissionId: string;
  userId: string;
  problemId: string;
  code: string;
  boardType: 'uno' | 'mega';
  timeoutMs?: number;
}

type ArduinoJobStatus =
  | 'queued'
  | 'processing'
  | 'accepted'
  | 'compilation_error'
  | 'runtime_error'
  | 'wrong_answer'
  | 'internal_error'
  | 'compiled'
  | 'failed';

interface RuntimeMetadata {
  memoryUsage?: {
    program: number;
    data: number;
  };
  codeQuality?: {
    programSize: number;
    dataUsage: number;
    hexSize: number;
    compileTime: number;
    warningCount: number;
    efficiency: {
      programUtilization: string;
      memoryUtilization: string;
    };
    score: number;
  };
  warnings?: string[];
}

interface JobStatusResponse {
  id: string;
  status: ArduinoJobStatus;
  progress?: number;
  result?: {
    success: boolean;
    hexCode?: string;
    error?: string;
    compileTime: number;
    memoryUsage?: {
      program: number;
      data: number;
    };
    codeQuality?: RuntimeMetadata['codeQuality'];
    warnings?: string[];
  };
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
}

function parseRuntimeMetadata(runtime: string | null): RuntimeMetadata | undefined {
  if (!runtime) return undefined;
  try {
    const parsed = JSON.parse(runtime) as RuntimeMetadata;
    return parsed;
  } catch {
    return undefined;
  }
}

export class ArduinoJobService {
  private compileQueue: Queue;

  constructor() {
    this.compileQueue = new Queue('arduino-compile', {
      connection: redisClient,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }

  async submitCompileJob(
    userId: string,
    problemId: string,
    code: string,
    boardType: 'uno' | 'mega' = 'uno',
    contestParticipationId?: string
  ): Promise<string> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!problemId) {
      throw new Error('Problem ID is required');
    }

    if (!code) {
      throw new Error('Code is required');
    }

    if (!['uno', 'mega'].includes(boardType)) {
      throw new Error('Invalid board type');
    }

    // Create submission record (Prisma will auto-generate CUID for id)
    const submission = await prisma.arduinoSubmission.create({
      data: {
        userId,
        problemId,
        sourceCode: code,
        status: 'processing',
        contestParticipationId,
        createdAt: new Date(),
      },
    });

    // Add job to queue
    const job = await this.compileQueue.add(
      'compile',
      {
        submissionId: submission.id,
        userId,
        problemId,
        code,
        boardType,
        timeoutMs: 30000,
      } as ArduinoCompileJobData,
      {
        jobId: submission.id,
        priority: 1,
      }
    );

    console.log(`📤 Queued Arduino compile job ${job.id} for user ${userId}`);
    return submission.id;
  }

  async getJobStatus(submissionId: string, userId: string): Promise<JobStatusResponse | null> {
    const submissionFinder = (prisma.arduinoSubmission as any).findFirst || prisma.arduinoSubmission.findUnique;
    const submission = await submissionFinder.call(prisma.arduinoSubmission, {
      where: {
        id: submissionId,
        userId,
      },
    });

    if (!submission) {
      return null;
    }

    const isFinal = ['accepted', 'compilation_error', 'runtime_error', 'wrong_answer', 'internal_error'].includes(submission.status);
    const apiStatus = submission.status === 'accepted' ? 'compiled' : submission.status === 'compilation_error' ? 'failed' : submission.status;

    if (!isFinal) {
      return {
        ...submission,
        status: apiStatus,
      };
    }

    const runtimeMetadata = parseRuntimeMetadata(submission.runtime);
    return {
      ...submission,
      status: apiStatus,
      hexFileUrl: submission.hexFile || undefined,
      error: submission.errorOutput || undefined,
      feedback: runtimeMetadata?.codeQuality
        ? {
            score: runtimeMetadata.codeQuality.score,
            strengths: [],
            suggestions: runtimeMetadata.warnings || [],
          }
        : undefined,
      result: {
        success: submission.status === 'accepted',
        hexCode: submission.hexFile || undefined,
        error: submission.errorOutput || undefined,
        compileTime: submission.compileTime || 0,
        memoryUsage: runtimeMetadata?.memoryUsage,
        codeQuality: runtimeMetadata?.codeQuality,
        warnings: runtimeMetadata?.warnings,
      },
    };
  }

  async getUserSubmissions(
    userId: string,
    problemIdOrPage?: string | number,
    limitOrPageSize: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const where: any = { userId };
    let take = limitOrPageSize;
    let skip = offset;

    if (typeof problemIdOrPage === 'string' && problemIdOrPage) {
      where.problemId = problemIdOrPage;
    } else if (typeof problemIdOrPage === 'number') {
      const page = Math.max(1, problemIdOrPage);
      const pageSize = Math.max(1, limitOrPageSize || 20);
      take = pageSize;
      skip = (page - 1) * pageSize;
    }

    const submissions = await prisma.arduinoSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return submissions;
  }

  async updateJobStatus(
    submissionId: string,
    status: ArduinoJobStatus,
    updates: {
      hexFileUrl?: string;
      feedback?: {
        score: number;
        strengths: string[];
        suggestions: string[];
      };
      error?: string;
    } = {}
  ): Promise<void> {
    await prisma.arduinoSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        hexFile: updates.hexFileUrl,
        errorOutput: updates.error,
        runtime: updates.feedback ? JSON.stringify({ codeQuality: updates.feedback }) : undefined,
        completedAt: new Date() as any,
      } as any,
    });
  }

  async getQueueStats() {
    const queue = this.compileQueue as any;
    if (typeof queue.getJobCounts === 'function') {
      const counts = await queue.getJobCounts();
      return {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        total: (counts.waiting || 0) + (counts.active || 0) + (counts.completed || 0) + (counts.failed || 0),
      };
    }

    const waiting = await this.compileQueue.getWaiting();
    const active = await this.compileQueue.getActive();
    const completed = await this.compileQueue.getCompleted();
    const failed = await this.compileQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    };
  }

  async cleanOldJobs(status: 'completed' | 'failed' = 'completed', days: number = status === 'failed' ? 7 : 1): Promise<number> {
    const gracePeriodMs = days * 24 * 60 * 60 * 1000;
    const cleaned = await this.compileQueue.clean(gracePeriodMs, status as any);
    return Array.isArray(cleaned) ? cleaned.length : (typeof cleaned === 'number' ? cleaned : 0);
  }

  async cancelJob(submissionId: string, userId: string): Promise<boolean> {
    // Check if user owns this submission
    const submission = await prisma.arduinoSubmission.findFirst({
      where: { id: submissionId, userId },
    });

    if (!submission || submission.status !== 'processing') {
      return false;
    }

    // Cancel queue job
    const job = await this.compileQueue.getJob(submissionId);
    if (job && await job.isWaiting()) {
      await job.remove();
    }

    // Update submission status
    await prisma.arduinoSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'compilation_error',
        errorOutput: 'Cancelled by user'  // Use errorOutput field
      },
    });

    return true;
  }
}

export const arduinoJobService = new ArduinoJobService();