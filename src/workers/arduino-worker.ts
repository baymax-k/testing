import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { prisma } from '../config/prisma.js';

const redisClient = getRedisClient();

interface ArduinoCompileJob {
  submissionId: string;
  userId: string;
  problemId: string;
  code: string;
  boardType: 'uno' | 'mega';
  timeoutMs?: number;
}

interface CompileResult {
  success: boolean;
  hexCode?: string;
  error?: string;
  compileTime: number;
  memoryUsage?: {
    program: number;
    data: number;
  };
}

class ArduinoWorker {
  private worker: Worker;
  private readonly ARDUINO_SERVICE_URL = process.env.ARDUINO_SERVICE_URL || 'http://localhost:3001';

  constructor() {
    this.worker = new Worker('arduino-compile', this.processJob.bind(this), {
      connection: redisClient,
      concurrency: parseInt(process.env.ARDUINO_WORKER_CONCURRENCY || '5'),
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    this.worker.on('completed', (job) => {
      console.log(`✅ Arduino job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Arduino job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('🚨 Arduino worker error:', err);
    });

    console.log('🔧 Arduino worker started');
  }

  private async processJob(job: Job<ArduinoCompileJob>): Promise<CompileResult> {
    const startTime = Date.now();
    const { submissionId, userId, problemId, code, boardType, timeoutMs = 30000 } = job.data;

    console.log(`📋 Processing Arduino job ${job.id} for user ${userId}, problem ${problemId}`);

    try {
      // Update submission status to processing
      await prisma.arduinoSubmission.update({
        where: { id: submissionId },
        data: { 
          status: 'processing',
          processedAt: new Date()
        }
      });

      // Call Arduino compiler service using fetch (Node.js 18+ built-in)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.ARDUINO_SERVICE_URL}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          boardType
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const compileData = await response.json();
      const compileTime = Date.now() - startTime;

      if (compileData.success) {
        const result: CompileResult = {
          success: true,
          hexCode: compileData.hexCode,
          compileTime,
          memoryUsage: compileData.memoryUsage
        };

        // Update submission with successful result
        await prisma.arduinoSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'compiled',
            hexCode: result.hexCode,
            compileTimeMs: compileTime,
            memoryUsage: result.memoryUsage ? JSON.stringify(result.memoryUsage) : null,
            completedAt: new Date()
          }
        });

        return result;
      } else {
        throw new Error(compileData.error || 'Compilation failed');
      }

    } catch (error: any) {
      const compileTime = Date.now() - startTime;
      let errorMessage = 'Unknown compilation error';

      if (error.name === 'AbortError') {
        errorMessage = 'Compilation timed out';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error(`💥 Compilation failed for job ${job.id}:`, errorMessage);

      // Update submission with error
      await prisma.arduinoSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'failed',
          error: errorMessage,
          compileTimeMs: compileTime,
          completedAt: new Date()
        }
      });

      const result: CompileResult = {
        success: false,
        error: errorMessage,
        compileTime
      };

      return result;
    }
  }

  public async close(): Promise<void> {
    console.log('🛑 Shutting down Arduino worker...');
    await this.worker.close();
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📶 Received SIGTERM, shutting down gracefully...');
  if (worker) {
    await worker.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📶 Received SIGINT, shutting down gracefully...');
  if (worker) {
    await worker.close();
  }
  process.exit(0);
});

// Start worker
const worker = new ArduinoWorker();

export default worker;