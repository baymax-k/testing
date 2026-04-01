import { Request, Response } from 'express';
import { arduinoJobService } from '../../../services/arduino-job.service';
import { prisma } from '../../../config/prisma.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export class ArduinoController {
  // Submit Arduino code for compilation
  async submitCompile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { problemId, code, boardType = 'uno' } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Validate problem exists
      const problem = await prisma.arduinoProblem.findUnique({
        where: { id: problemId }
      });

      if (!problem) {
        res.status(404).json({
          success: false,
          error: 'Arduino problem not found'
        });
        return;
      }

      // Submit compilation job
      const submissionId = await arduinoJobService.submitCompileJob(
        userId,
        problemId,
        code,
        boardType
      );

      res.status(202).json({
        success: true,
        message: 'Compilation job submitted successfully',
        data: {
          submissionId,
          status: 'queued'
        }
      });
    } catch (error: any) {
      console.error('Arduino compile submission error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit compilation job',
        message: error.message
      });
    }
  }

  // Get job status
  async getJobStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { submissionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const status = await arduinoJobService.getJobStatus(submissionId, userId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Submission not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error: any) {
      console.error('Get job status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status',
        message: error.message
      });
    }
  }

  // Get user submissions
  async getUserSubmissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { problemId, limit = '20', offset = '0' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const submissions = await arduinoJobService.getUserSubmissions(
        userId,
        problemId as string,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json({
        success: true,
        data: {
          submissions,
          pagination: {
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10),
            total: submissions.length
          }
        }
      });
    } catch (error: any) {
      console.error('Get user submissions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get submissions',
        message: error.message
      });
    }
  }

  // Cancel job
  async cancelJob(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { submissionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const cancelled = await arduinoJobService.cancelJob(submissionId, userId);

      if (!cancelled) {
        res.status(400).json({
          success: false,
          error: 'Job cannot be cancelled',
          message: 'Job may not exist, not owned by you, or already completed'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Job cancelled successfully'
      });
    } catch (error: any) {
      console.error('Cancel job error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel job',
        message: error.message
      });
    }
  }

  // Get queue statistics (admin only)
  async getQueueStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (!userRole || !['admin', 'superadmin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const stats = await arduinoJobService.getQueueStats();

      res.json({
        success: true,
        data: {
          queue: 'arduino-compile',
          stats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Get queue stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue statistics',
        message: error.message
      });
    }
  }

  // Get Arduino problems
  async getProblems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { difficulty, limit = '20', offset = '0' } = req.query;

      const where: any = {};
      if (difficulty) {
        where.question = {
          difficulty: difficulty
        };
      }

      const problems = await prisma.arduinoProblem.findMany({
        where,
        select: {
          id: true,
          question: {
            select: {
              title: true,
              description: true,
              difficulty: true
            }
          },
          board: true,
          memoryLimitKb: true,
          timeLimitMs: true,
          createdAt: true
        },
        take: parseInt(limit as string, 10),
        skip: parseInt(offset as string, 10),
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: {
          problems,
          pagination: {
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10)
          }
        }
      });
    } catch (error: any) {
      console.error('Get Arduino problems error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Arduino problems',
        message: error.message
      });
    }
  }

  // Get specific Arduino problem
  async getProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { problemId } = req.params;

      const problem = await prisma.arduinoProblem.findUnique({
        where: { id: problemId },
        include: {
          testCases: {
            select: {
              id: true,
              input: true,
              expectedOutput: true,
              isHidden: true
            }
          }
        }
      });

      if (!problem) {
        res.status(404).json({
          success: false,
          error: 'Arduino problem not found'
        });
        return;
      }

      res.json({
        success: true,
        data: problem
      });
    } catch (error: any) {
      console.error('Get Arduino problem error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Arduino problem',
        message: error.message
      });
    }
  }
}