import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { prisma } from '../config/prisma.js';
import { v4 as uuidv4 } from 'uuid';
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
    boardType: 'uno' | 'mega' = 'uno'
  ): Promise<string> {
    // Create submission record
    const submission = await prisma.arduinoSubmission.create({
      data: {
        id: uuidv4(),
        userId,
        problemId,
        code,
        boardType,
        status: 'queued',
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
        queueProgress = job.progress || 50;
      } else if (await job.isCompleted() || await job.isFailed()) {
        queueProgress = 100;
      }
    }

    const response: JobStatusResponse = {
      id: submission.id,
      status: submission.status as any,
      progress: queueProgress,
      createdAt: submission.createdAt,
      processedAt: submission.processedAt || undefined,
      completedAt: submission.completedAt || undefined,
    };

    // Include result if completed or failed
    if (submission.status === 'compiled' || submission.status === 'failed') {
      response.result = {
        success: submission.status === 'compiled',
        hexCode: submission.hexCode || undefined,
        error: submission.error || undefined,
        compileTime: submission.compileTimeMs || 0,
        memoryUsage: submission.memoryUsage ? JSON.parse(submission.memoryUsage) : undefined,
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
      progress: submission.status === 'queued' ? 0 : 
                submission.status === 'processing' ? 50 : 100,
      createdAt: submission.createdAt,
      processedAt: submission.processedAt || undefined,
      completedAt: submission.completedAt || undefined,
      result: (submission.status === 'compiled' || submission.status === 'failed') ? {
        success: submission.status === 'compiled',
        hexCode: submission.hexCode || undefined,
        error: submission.error || undefined,
        compileTime: submission.compileTimeMs || 0,
        memoryUsage: submission.memoryUsage ? JSON.parse(submission.memoryUsage) : undefined,
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

    if (!submission || submission.status !== 'queued') {
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
        status: 'failed',
        error: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    return true;
  }
}

export const arduinoJobService = new ArduinoJobService();