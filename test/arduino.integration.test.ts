import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { arduinoJobService } from '../src/services/arduino-job.service';

// Mock data
const mockUserId = 'test-user-123';
const mockProblemId = 'arduino-problem-456';

const validArduinoCode = `
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

const invalidArduinoCode = `
invalid code that won't compile
`;

describe('Arduino Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    // Start test server
    server = app.listen(0);
    
    // Wait a bit for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Arduino API Endpoints', () => {
    it('should get Arduino problems without auth', async () => {
      const response = await request(app)
        .get('/api/v1/arduino/problems')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('problems');
      expect(Array.isArray(response.body.data.problems)).toBe(true);
    });

    it('should require auth for compilation', async () => {
      const response = await request(app)
        .post('/api/v1/arduino/compile')
        .send({
          problemId: mockProblemId,
          code: validArduinoCode,
          boardType: 'uno'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Authentication');
    });

    it('should submit compilation job with auth', async () => {
      const response = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', 'Bearer mock-token')
        .send({
          problemId: mockProblemId,
          code: validArduinoCode,
          boardType: 'uno'
        })
        .expect(202);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('submissionId');
      expect(response.body.data).toHaveProperty('status', 'queued');
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', 'Bearer mock-token')
        .send({
          problemId: 'invalid-uuid',
          code: '',
          boardType: 'invalid-board'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should get job status with auth', async () => {
      // First submit a job
      const submitResponse = await request(app)
        .post('/api/v1/arduino/compile')
        .set('Authorization', 'Bearer mock-token')
        .send({
          problemId: mockProblemId,
          code: validArduinoCode,
          boardType: 'uno'
        });

      const submissionId = submitResponse.body.data.submissionId;

      // Then check status
      const statusResponse = await request(app)
        .get(`/api/v1/arduino/jobs/${submissionId}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(statusResponse.body).toHaveProperty('success', true);
      expect(statusResponse.body.data).toHaveProperty('id', submissionId);
      expect(statusResponse.body.data).toHaveProperty('status');
    });

    it('should get user submissions', async () => {
      const response = await request(app)
        .get('/api/v1/arduino/submissions')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('submissions');
      expect(Array.isArray(response.body.data.submissions)).toBe(true);
    });

    it('should apply rate limiting', async () => {
      // Make multiple requests quickly to trigger rate limit
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/v1/arduino/compile')
          .set('Authorization', 'Bearer mock-token')
          .send({
            problemId: mockProblemId,
            code: validArduinoCode,
            boardType: 'uno'
          })
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited (429)
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Arduino Job Service', () => {
    it('should submit compile job', async () => {
      const submissionId = await arduinoJobService.submitCompileJob(
        mockUserId,
        mockProblemId,
        validArduinoCode,
        'uno'
      );

      expect(submissionId).toBeDefined();
      expect(typeof submissionId).toBe('string');
    });

    it('should get job status', async () => {
      const submissionId = await arduinoJobService.submitCompileJob(
        mockUserId,
        mockProblemId,
        validArduinoCode,
        'uno'
      );

      const status = await arduinoJobService.getJobStatus(submissionId, mockUserId);
      
      expect(status).toBeDefined();
      expect(status?.id).toBe(submissionId);
      expect(['queued', 'processing', 'compiled', 'failed']).toContain(status?.status);
    });

    it('should get user submissions', async () => {
      const submissions = await arduinoJobService.getUserSubmissions(mockUserId);
      
      expect(Array.isArray(submissions)).toBe(true);
    });

    it('should get queue stats', async () => {
      const stats = await arduinoJobService.getQueueStats();
      
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active'); 
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('total');
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests under limit', async () => {
      // Test the rate limiter directly
      const mockReq = { 
        user: { id: 'test-user' }, 
        ip: '127.0.0.1' 
      } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn()
      } as any;
      const mockNext = vi.fn();

      const { arduinoCompileRateLimit } = await import('../src/middleware/rate-limiter');
      const middleware = arduinoCompileRateLimit.middleware();

      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });
  });
});

// Helper to mock auth middleware for testing
vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = { id: mockUserId, role: 'student' };
    next();
  },
  requireCollegeAdminAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next()
}));