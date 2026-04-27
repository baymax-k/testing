import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { cdnService } from '../services/cdn.service.js';

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

class ArduinoWorker {
  private worker: Worker;
  private readonly ARDUINO_SERVICE_URL =
    process.env.ARDUINO_SERVICE_URL ||
    process.env.ARDUINO_COMPILER_URL ||
    process.env.COMPILER_SERVICE_URL ||
    'http://localhost:3001';

  constructor() {
    this.worker = new Worker('arduino-compile', this.processJob.bind(this), {
      connection: redisClient,
      concurrency: parseInt(process.env.ARDUINO_WORKER_CONCURRENCY || '5'),
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
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
          status: 'processing'
        }
      });

      // Fetch problem details to get required libraries
      const problem = await prisma.arduinoProblem.findUnique({
        where: { id: problemId },
        select: { libraries: true }
      });

      const libraries = problem?.libraries || [];
      console.log(`📚 Problem requires libraries: ${libraries.join(', ') || 'none'}`);

      // Call Arduino compiler service using fetch (Node.js 18+ built-in)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.ARDUINO_SERVICE_URL}/compile/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          boardType,
          libraries
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
        const hexCode =
          (typeof compileData.hexCode === 'string' && compileData.hexCode.length > 0
            ? compileData.hexCode
            : undefined) ||
          (typeof compileData.hexFile === 'string' && compileData.hexFile.length > 0
            ? compileData.hexFile
            : undefined);

        if (!hexCode) {
          throw new Error('Compilation succeeded but no HEX output was returned');
        }

        const memoryUsage = compileData.memoryUsage ||
          (compileData.codeQuality
            ? {
                program: Number(compileData.codeQuality.programSize) || 0,
                data: Number(compileData.codeQuality.dataUsage) || 0,
              }
            : undefined);

        const result: CompileResult = {
          success: true,
          hexCode,
          compileTime,
          memoryUsage,
          codeQuality: compileData.codeQuality,
          warnings: Array.isArray(compileData.warnings) ? compileData.warnings : []
        };

        // Try to upload HEX file to CDN first
        let hexFileReference = result.hexCode; // Fallback to storing in DB
        
        if (result.hexCode && cdnService.isAvailable()) {
          console.log(`📤 Uploading HEX file to CDN for submission ${submissionId}`);
          const uploadResult = await cdnService.uploadHexFile(
            result.hexCode, 
            submissionId, 
            problemId
          );
          
          if (uploadResult.success && uploadResult.url) {
            hexFileReference = uploadResult.url; // Use CDN URL instead of content
            console.log(`✅ HEX file uploaded to CDN: ${uploadResult.url}`);
          } else {
            console.warn(`⚠️ CDN upload failed, storing in database: ${uploadResult.error}`);
          }
        }

        // Update submission with successful result - using schema field names
        await prisma.arduinoSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'accepted',
            hexFile: hexFileReference,        // Either CDN URL or hex content
            compileTime: compileTime,         // Use compileTime field  
            runtime: JSON.stringify({
              memoryUsage: result.memoryUsage,
              codeQuality: result.codeQuality,
              warnings: result.warnings
            })
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
          status: 'compilation_error',
          errorOutput: errorMessage,         // Use errorOutput field
          compileTime: compileTime          // Use compileTime field
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