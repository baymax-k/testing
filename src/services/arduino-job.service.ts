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

interface JobStatusResponse {
  id: string;
  status: 'queued' | 'processing' | 'compiled' | 'failed';
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
  };
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
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
    // Get submission from database
    const submission = await prisma.arduinoSubmission.findFirst({
      where: {
        id: submissionId,
        userId, // Ensure user can only see their own submissions
      },
    });

    if (!submission) {
      return null;
    }

    // Check queue job status
    const job = await this.compileQueue.getJob(submissionId);
    let queueProgress = 0;

    if (job) {
      if (await job.isWaiting()) {
        queueProgress = 0;
      } else if (await job.isActive()) {
        queueProgress = typeof job.progress === 'number' ? job.progress : 50;
      } else if (await job.isCompleted() || await job.isFailed()) {
        queueProgress = 100;
      }
    }

    const response: JobStatusResponse = {
      id: submission.id,
      status: submission.status as any,
      progress: queueProgress,
      createdAt: submission.createdAt,
      processedAt: undefined,  // Field doesn't exist in schema
      completedAt: undefined,  // Field doesn't exist in schema
    };

    // Include result if completed or failed
    if (submission.status === 'accepted' || submission.status === 'compilation_error' || submission.status === 'runtime_error') {
      response.result = {
        success: submission.status === 'accepted',
        hexCode: submission.hexFile || undefined,          // Use hexFile field
        error: submission.errorOutput || undefined,        // Use errorOutput field
        compileTime: submission.compileTime || 0,          // Use compileTime field
        memoryUsage: submission.runtime ? JSON.parse(submission.runtime) : undefined, // Use runtime field
      };
    }

    return response;
  }

  async getUserSubmissions(
    userId: string,
    problemId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<JobStatusResponse[]> {
    const where: any = { userId };
    if (problemId) {
      where.problemId = problemId;
    }

    const submissions = await prisma.arduinoSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return submissions.map(submission => ({
      id: submission.id,
      status: submission.status as any,
      progress: submission.status === 'processing' ? 0 : 
                submission.status === 'accepted' ? 100 : 100,
      createdAt: submission.createdAt,
      processedAt: undefined,  // Field doesn't exist in schema
      completedAt: undefined,  // Field doesn't exist in schema
      result: (submission.status === 'accepted' || submission.status === 'compilation_error' || submission.status === 'runtime_error') ? {
        success: submission.status === 'accepted',
        hexCode: submission.hexFile || undefined,          // Use hexFile field
        error: submission.errorOutput || undefined,        // Use errorOutput field
        compileTime: submission.compileTime || 0,          // Use compileTime field
        memoryUsage: submission.runtime ? JSON.parse(submission.runtime) : undefined, // Use runtime field
      } : undefined,
    }));
  }

  async getQueueStats() {
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