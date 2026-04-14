import { Request, Response } from 'express';
import { arduinoCompilerService } from '../../../services/arduino-compiler.service';
import { arduinoJobService } from '../../../services/arduino-job.service';
import { prisma } from '../../../config/prisma.js';
import type { AuthRequest } from '../../../middleware/auth';

export class ArduinoController {
  // Get supported Arduino boards
  async getBoards(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get boards from Arduino compiler service
      const boardsResponse = await arduinoCompilerService.getBoards();
      
      if (!boardsResponse.success) {
        res.status(500).json({
          success: false,
          error: 'Failed to get boards from Arduino compiler',
          message: boardsResponse.error
        });
        return;
      }

      // Enhance with additional metadata
      const enhancedBoards = boardsResponse.boards.map(board => ({
        id: board.id,
        name: board.name,
        fqbn: board.fqbn,
        description: board.id === 'uno' 
          ? 'ATmega328P based board, 32KB Flash, 2KB SRAM'
          : 'ATmega2560 based board, 256KB Flash, 8KB SRAM',
        pins: board.id === 'uno'
          ? { digital: 14, analog: 6, pwm: 6 }
          : { digital: 54, analog: 16, pwm: 15 }
      }));

      res.json({
        success: true,
        data: { boards: enhancedBoards }
      });
    } catch (error: any) {
      console.error('Get boards error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get boards',
        message: error.message
      });
    }
  }

  // Check authentication status
  // Validate submission against test cases and mark as solved
  async validateSubmission(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { submissionId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get submission with problem and test cases
      const submission = await prisma.arduinoSubmission.findUnique({
        where: { id: submissionId },
        include: {
          problem: {
            include: {
              testCases: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      });

      if (!submission) {
        res.status(404).json({
          success: false,
          error: 'Submission not found'
        });
        return;
      }

      // Verify ownership
      if (submission.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Not authorized to validate this submission'
        });
        return;
      }

      // Check if compilation succeeded
      if (submission.status !== 'accepted' || !submission.hexFile) {
        res.status(400).json({
          success: false,
          error: 'Can only validate successfully compiled submissions',
          status: submission.status
        });
        return;
      }

      // Run simulation with test cases
      // Convert Prisma test cases to Arduino compiler format
      const testCasesForSimulation = submission.problem.testCases.map(tc => ({
        id: tc.id,
        label: tc.label,
        type: tc.type as 'pin_state' | 'serial_output' | 'toggle_count' | 'timing',
        pin: tc.pin || undefined,
        expectedState: tc.expectedState as 'HIGH' | 'LOW' | undefined,
        atMs: tc.atMs || undefined,
        toleranceMs: tc.toleranceMs || undefined,
        minToggles: tc.minToggles || undefined,
        withinMs: tc.withinMs || undefined,
        expectedOutput: tc.expectedOutput || undefined,
        order: tc.order,
        isHidden: tc.isHidden
      }));

      const simulateResult = await arduinoCompilerService.simulate(
        submission.hexFile,
        testCasesForSimulation
      );

      if (!simulateResult.success) {
        res.status(500).json({
          success: false,
          error: 'Failed to run test simulation',
          message: simulateResult.error
        });
        return;
      }

      const allTestsPassed = simulateResult.allTestsPassed;
      const passedCount = simulateResult.results.filter(r => r.passed).length;
      const totalCount = simulateResult.results.length;

      // Update submission with test results
      await prisma.arduinoSubmission.update({
        where: { id: submissionId },
        data: {
          status: allTestsPassed ? 'accepted' : 'wrong_answer',
          testCasesPassed: passedCount,
          totalTestCases: totalCount,
          verdict: JSON.stringify(simulateResult),
          runtime: `${simulateResult.simulationTimeMs}ms`
        }
      });

      // Mark problem as solved if all tests pass
      if (allTestsPassed) {
        // TODO: Implement solved problem tracking
        // Currently disabled until SolvedProblem model is available
        /*
        await prisma.solvedProblem.upsert({
          where: {
            userId_questionId: {
              userId,
              questionId: submission.problem.questionId
            }
          },
          create: {
            userId,
            questionId: submission.problem.questionId,
            solvedAt: new Date()
          },
          update: {
            solvedAt: new Date()
          }
        });
        */
      }

      res.json({
        success: true,
        data: {
          allTestsPassed,
          testResults: simulateResult.results.map(result => ({
            testCaseId: result.testCaseId,
            passed: result.passed,
            actualValue: result.actualValue,
            expectedValue: result.expectedValue,
            error: result.error,
            label: submission.problem.testCases.find(tc => tc.id === result.testCaseId)?.label
          })),
          passedCount,
          totalCount,
          simulationTimeMs: simulateResult.simulationTimeMs,
          output: simulateResult.output,
          solved: allTestsPassed
        }
      });
    } catch (error: any) {
      console.error('Arduino validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate Arduino submission',
        message: error.message
      });
    }
  }

  // Submit Arduino code for compilation
  async submitCompile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { problemId, code, boardType = 'uno', contestParticipationId } = req.body;
      const userId = req.user?.userId;

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

      // If this is a contest submission, validate contest participation
      if (contestParticipationId) {
        const participation = await prisma.contestParticipation.findUnique({
          where: { id: contestParticipationId },
          include: { contest: true }
        });

        if (!participation || participation.userId !== userId) {
          res.status(403).json({
            success: false,
            error: 'Invalid contest participation'
          });
          return;
        }

        // Check if contest is still active
        const now = new Date();
        if (participation.contest.endTime && now > participation.contest.endTime) {
          res.status(403).json({
            success: false,
            error: 'Contest has ended'
          });
          return;
        }
      }

      // Submit job to queue for asynchronous processing
      const submissionId = await arduinoJobService.submitCompileJob(
        userId,
        problemId,
        code,
        boardType,
        contestParticipationId
      );

      // Return 202 for async operation - compilation happens in background
      res.status(202).json({
        success: true,
        message: "Compilation job queued",
        data: {
          submissionId,
          status: "processing",
          contestParticipationId
        }
      });
    } catch (error: any) {
      console.error('Arduino compile submission error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to queue Arduino compilation',
        message: error.message
      });
    }
  }

  // Get job status
  async getJobStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { submissionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const jobStatus = await arduinoJobService.getJobStatus(submissionId, userId);

      if (!jobStatus) {
        res.status(404).json({
          success: false,
          error: 'Submission not found'
        });
        return;
      }

      res.json({
        success: true,
        data: jobStatus
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
      const userId = req.user?.userId;
      const { problemId, limit = '20', offset = '0' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const where: any = { userId };
      if (problemId) {
        where.problemId = problemId as string;
      }

      const submissions = await prisma.arduinoSubmission.findMany({
        where,
        select: {
          id: true,
          problemId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          compileTime: true,
          testCasesPassed: true,
          totalTestCases: true,
          problem: {
            select: {
              question: {
                select: {
                  title: true,
                  difficulty: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string, 10),
        skip: parseInt(offset as string, 10)
      });

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

  // Cancel job - Not applicable for direct compilation
  async cancelJob(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { submissionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Since we use direct compilation, jobs cannot be cancelled once started
      // We can only return the current status
      const submission = await prisma.arduinoSubmission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, userId: true }
      });

      if (!submission) {
        res.status(404).json({
          success: false,
          error: 'Submission not found'
        });
        return;
      }

      if (submission.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Cannot cancel compilation',
        message: 'Direct compilation cannot be cancelled. Current status: ' + submission.status
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

  // Get compilation statistics (admin only)
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

      // Get submission statistics from database
      const stats = await prisma.arduinoSubmission.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });

      const totalSubmissions = await prisma.arduinoSubmission.count();

      res.json({
        success: true,
        data: {
          type: 'arduino-direct-compilation',
          totalSubmissions,
          statusBreakdown: stats.reduce((acc, stat) => {
            acc[stat.status] = stat._count.id;
            return acc;
          }, {} as Record<string, number>),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Get compilation stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compilation statistics',
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
          question: {
            select: {
              id: true,
              title: true,
              description: true,
              difficulty: true
            }
          },
          testCases: {
            select: {
              id: true,
              label: true,
              type: true,
              pin: true,
              expectedState: true,
              atMs: true,
              toleranceMs: true,
              minToggles: true,
              withinMs: true,
              expectedOutput: true,
              order: true,
              isHidden: true
            },
            orderBy: { order: 'asc' }
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
