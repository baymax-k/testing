import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { getRedisClient } from '../src/config/redis';
import { arduinoJobService } from '../src/services/arduino-job.service';

// Test data
const testUser = {
  id: 'test-user-arduino-integration',
  email: 'arduino.test@example.com',
  role: 'student'
};

const testProblem = {
  id: 'test-arduino-problem-integration',
  title: 'LED Blink Challenge',
  description: 'Create a program that blinks an LED on pin 13 every 1 second',
  difficulty: 'easy',
  maxMemory: 2048,
  timeLimit: 10000,
  expectedPatterns: {
    pinMode: ['pinMode(13, OUTPUT)'],
    digitalWrite: ['digitalWrite(13, HIGH)', 'digitalWrite(13, LOW)'],
    delay: ['delay(1000)']
  }
};

const validBlinkCode = `
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`;

const invalidCode = `
void setup() {
  pinMode(13, OUTPUT  // Missing closing parenthesis
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
}`;

const incompleteBlinkCode = `
void setup() {
  // Missing pinMode declaration
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  // Missing LOW state and delay
}`;

let authToken: string;
let redisClient: any;

describe('Arduino Full Integration Tests', () => {
  beforeAll(async () => {
    // Setup database
    await prisma.$connect();
    
    // Setup Redis
    redisClient = getRedisClient();
    await redisClient.flushall();
    
    // Create test user if not exists
    await prisma.user.upsert({
      where: { id: testUser.id },
      update: {},
      create: {
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create test problem
    await prisma.arduinoProblem.upsert({
      where: { id: testProblem.id },
      update: {},
      create: {
        ...testProblem,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Simulate authentication (in real tests, you'd use proper login)
    authToken = 'Bearer test-token-arduino-integration';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.arduinoSubmission.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.arduinoProblem.delete({
      where: { id: testProblem.id }
    }).catch(() => {});
    await prisma.user.delete({
      where: { id: testUser.id }
    }).catch(() => {});

    await prisma.$disconnect();
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up submissions before each test
    await prisma.arduinoSubmission.deleteMany({
      where: { userId: testUser.id }
    });
  });

  describe('Arduino API Workflow', () => {
    it('should complete full compilation workflow - valid code', async () => {
      // Step 1: Submit compilation job
      const submitResponse = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          code: validBlinkCode,
          boardType: 'uno'
        })
        .expect(202);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.data.submissionId).toBeDefined();
      expect(submitResponse.body.data.status).toBe('queued');

      const submissionId = submitResponse.body.data.submissionId;

      // Step 2: Check initial status
      const statusResponse = await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.id).toBe(submissionId);
      expect(['queued', 'processing', 'compiled']).toContain(statusResponse.body.data.status);

      // Step 3: Wait for compilation to complete (simulate worker processing)
      // In real tests, you'd either run actual workers or mock the completion
      await simulateCompilationCompletion(submissionId, true);

      // Step 4: Check final status
      const finalStatusResponse = await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(finalStatusResponse.body.success).toBe(true);
      expect(finalStatusResponse.body.data.status).toBe('compiled');
      expect(finalStatusResponse.body.data.hexFileUrl).toBeDefined();
      expect(finalStatusResponse.body.data.feedback).toBeDefined();
      expect(finalStatusResponse.body.data.feedback.score).toBeGreaterThan(80);

      // Step 5: Verify submission appears in user's submission history
      const historyResponse = await request(app)
        .get('/api/v1/arduino/submissions')
        .set('Authorization', authToken)
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.submissions).toHaveLength(1);
      expect(historyResponse.body.data.submissions[0].id).toBe(submissionId);
    });

    it('should handle compilation failure - invalid code', async () => {
      // Submit invalid code
      const submitResponse = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          code: invalidCode,
          boardType: 'uno'
        })
        .expect(202);

      const submissionId = submitResponse.body.data.submissionId;

      // Simulate compilation failure
      await simulateCompilationCompletion(submissionId, false);

      // Check status reflects failure
      const statusResponse = await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('compilation_error');
      expect(statusResponse.body.data.error).toBeDefined();
      expect(statusResponse.body.data.error).toContain('expected');
    });

    it('should provide educational feedback for incomplete code', async () => {
      const submitResponse = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          code: incompleteBlinkCode,
          boardType: 'uno'
        })
        .expect(202);

      const submissionId = submitResponse.body.data.submissionId;

      // Simulate successful compilation but with educational feedback
      await simulateCompilationCompletion(submissionId, true, {
        score: 60,
        strengths: ['Code structure is correct'],
        suggestions: [
          'Add pinMode(13, OUTPUT) in setup()',
          'Missing digitalWrite(13, LOW) for complete blink cycle',
          'Add delay after digitalWrite(13, LOW)'
        ]
      });

      const statusResponse = await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('compiled');
      expect(statusResponse.body.data.feedback.score).toBeLessThan(70);
      expect(statusResponse.body.data.feedback.suggestions).toContain('Add pinMode(13, OUTPUT) in setup()');
    });

    it('should handle different board types', async () => {
      const boardTypes = ['uno', 'nano', 'mega', 'leonardo'];

      for (const boardType of boardTypes) {
        const response = await request(app)
          .post('/api/v1/arduino/compile')
          .set('Authorization', authToken)
          .send({
            problemId: testProblem.id,
            code: validBlinkCode,
            boardType
          })
          .expect(202);

        expect(response.body.success).toBe(true);
        
        // Verify board type is stored correctly
        const submission = await prisma.arduinoSubmission.findUnique({
          where: { id: response.body.data.submissionId }
        });
        
        expect(submission?.boardType).toBe(boardType);
      }
    });

    it('should enforce rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/v1/arduino/compile')
          .set('Authorization', authToken)
          .send({
            problemId: testProblem.id,
            code: validBlinkCode,
            boardType: 'uno'
          })
      );

      const responses = await Promise.all(requests);
      
      // Check that at least one request was rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper error message
      for (const response of rateLimitedResponses) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('rate limit');
      }
    });

    it('should validate input parameters', async () => {
      // Test missing required fields
      await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          // Missing code
          boardType: 'uno'
        })
        .expect(400);

      // Test invalid board type
      await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          code: validBlinkCode,
          boardType: 'invalid-board'
        })
        .expect(400);

      // Test invalid problem ID format
      await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: 'invalid-uuid',
          code: validBlinkCode,
          boardType: 'uno'
        })
        .expect(400);
    });

    it('should handle job cancellation', async () => {
      // Submit a job
      const submitResponse = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          code: validBlinkCode,
          boardType: 'uno'
        })
        .expect(202);

      const submissionId = submitResponse.body.data.submissionId;

      // Cancel the job
      await request(app)
        .delete(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', authToken)
        .expect(200);

      // Verify job status is cancelled
      const statusResponse = await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('cancelled');
    });

    it('should prevent access to other users submissions', async () => {
      // Create another test user
      const otherUser = {
        id: 'other-test-user-arduino',
        email: 'other.arduino.test@example.com',
        role: 'student'
      };

      await prisma.user.upsert({
        where: { id: otherUser.id },
        update: {},
        create: {
          ...otherUser,
          verified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Submit job as first user
      const submitResponse = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', authToken)
        .send({
          problemId: testProblem.id,
          code: validBlinkCode,
          boardType: 'uno'
        })
        .expect(202);

      const submissionId = submitResponse.body.data.submissionId;

      // Try to access job status as different user
      const otherUserToken = 'Bearer other-user-token';
      await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', otherUserToken)
        .expect(404); // Should not find the job

      // Cleanup
      await prisma.user.delete({
        where: { id: otherUser.id }
      }).catch(() => {});
    });
  });

  describe('Arduino Problems API', () => {
    it('should list available Arduino problems', async () => {
      const response = await request(app)
        .get('/api/v1/arduino/problems')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.problems).toBeDefined();
      expect(Array.isArray(response.body.data.problems)).toBe(true);
      
      // Should include our test problem
      const testProblemInList = response.body.data.problems.find(
        (p: any) => p.id === testProblem.id
      );
      expect(testProblemInList).toBeDefined();
      expect(testProblemInList.title).toBe(testProblem.title);
    });

    it('should get specific problem details', async () => {
      const response = await request(app)
        .get(`/api/v1/arduino/problems/${testProblem.id}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.problem.id).toBe(testProblem.id);
      expect(response.body.data.problem.title).toBe(testProblem.title);
      expect(response.body.data.problem.description).toBe(testProblem.description);
    });

    it('should return 404 for non-existent problems', async () => {
      await request(app)
        .get('/api/v1/arduino/problems/non-existent-problem')
        .set('Authorization', authToken)
        .expect(404);
    });
  });

  describe('Arduino Boards API', () => {
    it('should list supported boards', async () => {
      const response = await request(app)
        .get('/api/v1/arduino/boards')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.boards).toBeDefined();
      expect(Array.isArray(response.body.data.boards)).toBe(true);
      
      // Check for common board types
      const boardNames = response.body.data.boards.map((b: any) => b.name);
      expect(boardNames).toContain('uno');
      expect(boardNames).toContain('nano');
      expect(boardNames).toContain('mega');
    });

    it('should provide board specifications', async () => {
      const response = await request(app)
        .get('/api/v1/arduino/boards')
        .set('Authorization', authToken)
        .expect(200);

      const unoBoard = response.body.data.boards.find((b: any) => b.name === 'uno');
      expect(unoBoard).toBeDefined();
      expect(unoBoard.flashMemory).toBe(32768);
      expect(unoBoard.sram).toBe(2048);
      expect(unoBoard.digitalPins).toBe(14);
      expect(unoBoard.analogPins).toBe(6);
    });
  });

  describe('Admin Queue Management', () => {
    it('should provide queue statistics to admin', async () => {
      // This would require admin authentication in real implementation
      const adminToken = 'Bearer admin-token';
      
      const response = await request(app)
        .get('/api/v1/arduino/admin/queue/stats')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toHaveProperty('waiting');
      expect(response.body.data.stats).toHaveProperty('active');
      expect(response.body.data.stats).toHaveProperty('completed');
      expect(response.body.data.stats).toHaveProperty('failed');
    });
  });

  describe('Health Check', () => {
    it('should provide Arduino system health status', async () => {
      const response = await request(app)
        .get('/api/v1/arduino/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('arduino-api');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});

// Helper function to simulate compilation completion
async function simulateCompilationCompletion(
  submissionId: string, 
  success: boolean,
  customFeedback?: any
) {
  const updateData: any = {
    status: success ? 'compiled' : 'compilation_error',
    completedAt: new Date()
  };

  if (success) {
    updateData.hexFileUrl = `https://cdn.example.com/arduino/${submissionId}.hex`;
    updateData.feedback = customFeedback || {
      score: 95,
      strengths: [
        'Correctly configured pin 13 as OUTPUT',
        'Proper digitalWrite usage detected',
        'Appropriate delay timing used'
      ],
      suggestions: []
    };
    updateData.qualityMetrics = {
      programSize: 1024,
      ramUsage: 185,
      codeComplexity: 'Low',
      warnings: []
    };
  } else {
    updateData.error = 'Compilation failed: expected \')\' before end of file';
  }

  await prisma.arduinoSubmission.update({
    where: { id: submissionId },
    data: updateData
  });
}

// Mock authentication middleware for testing
vi.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    
    if (token === 'test-token-arduino-integration') {
      req.user = { id: testUser.id, role: testUser.role };
    } else if (token === 'other-user-token') {
      req.user = { id: 'other-test-user-arduino', role: 'student' };
    } else if (token === 'admin-token') {
      req.user = { id: 'admin-user', role: 'admin' };
    } else {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    next();
  },
  requireRole: (role: string) => (req: any, res: any, next: any) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  }
}));