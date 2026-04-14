import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { arduinoCompilerService } from '@/services/arduino-compiler.service';
import { arduinoJobService } from '@/services/arduino-job.service';
import { cdnService } from '@/services/cdn.service';
import { prisma } from '@/config/prisma';

// Mock external dependencies
vi.mock('@/config/prisma', () => ({
  prisma: {
    arduinoSubmission: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    arduinoProblem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    }
  }
}));

vi.mock('@/services/cdn.service', () => ({
  cdnService: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    generateSignedUrl: vi.fn(),
  }
}));

vi.mock('bull', () => {
  const mockQueue = {
    add: vi.fn(),
    process: vi.fn(),
    getJobCounts: vi.fn(),
    getJob: vi.fn(),
    clean: vi.fn(),
  };
  
  return {
    default: vi.fn().mockImplementation(() => mockQueue),
    Queue: vi.fn().mockImplementation(() => mockQueue),
  };
});

const mockArduinoCode = `
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`;

const mockBadCode = `
void setup() {
  pinMode(13, OUTPUT  // Missing closing parenthesis
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`;

describe('Arduino Compiler Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Smart Pattern Matching', () => {
    it('should detect digitalWrite patterns', async () => {
      const testCases = [
        {
          code: 'digitalWrite(13, HIGH);',
          expectedMatches: ['digitalWrite(13, HIGH)']
        },
        {
          code: 'digitalWrite(pin, LOW); digitalWrite(13, HIGH);',
          expectedMatches: ['digitalWrite(pin, LOW)', 'digitalWrite(13, HIGH)']
        }
      ];

      for (const testCase of testCases) {
        const patterns = arduinoCompilerService.analyzeCodePatterns(testCase.code);
        expect(patterns.digitalWrites).toHaveLength(testCase.expectedMatches.length);
        expect(patterns.digitalWrites).toEqual(expect.arrayContaining(testCase.expectedMatches));
      }
    });

    it('should detect Serial output patterns', () => {
      const testCases = [
        {
          code: 'Serial.print("Hello");',
          expectedCount: 1
        },
        {
          code: 'Serial.println("Debug"); Serial.print(value);',
          expectedCount: 2
        },
        {
          code: 'if (debug) { Serial.println("Error"); }',
          expectedCount: 1
        }
      ];

      for (const testCase of testCases) {
        const patterns = arduinoCompilerService.analyzeCodePatterns(testCase.code);
        expect(patterns.serialOutputs).toHaveLength(testCase.expectedCount);
      }
    });

    it('should detect delay patterns', () => {
      const code = `
        delay(1000);
        delayMicroseconds(500);
        delay(duration);
      `;

      const patterns = arduinoCompilerService.analyzeCodePatterns(code);
      expect(patterns.delays).toHaveLength(3);
      expect(patterns.delays).toContain('delay(1000)');
      expect(patterns.delays).toContain('delayMicroseconds(500)');
    });

    it('should detect pinMode declarations', () => {
      const code = `
        pinMode(13, OUTPUT);
        pinMode(A0, INPUT);
        pinMode(pin, INPUT_PULLUP);
      `;

      const patterns = arduinoCompilerService.analyzeCodePatterns(code);
      expect(patterns.pinModes).toHaveLength(3);
      expect(patterns.pinModes).toContain('pinMode(13, OUTPUT)');
      expect(patterns.pinModes).toContain('pinMode(A0, INPUT)');
    });

    it('should analyze complex blink pattern', () => {
      const patterns = arduinoCompilerService.analyzeCodePatterns(mockArduinoCode);
      
      expect(patterns.pinModes).toHaveLength(1);
      expect(patterns.pinModes[0]).toContain('pinMode(13, OUTPUT)');
      
      expect(patterns.digitalWrites).toHaveLength(2);
      expect(patterns.digitalWrites).toContain('digitalWrite(13, HIGH)');
      expect(patterns.digitalWrites).toContain('digitalWrite(13, LOW)');
      
      expect(patterns.delays).toHaveLength(2);
      expect(patterns.delays.filter(d => d.includes('1000'))).toHaveLength(2);
    });
  });

  describe('Code Validation', () => {
    it('should validate syntactically correct code', () => {
      const isValid = arduinoCompilerService.validateCodeSyntax(mockArduinoCode);
      expect(isValid).toBe(true);
    });

    it('should detect syntax errors', () => {
      const isValid = arduinoCompilerService.validateCodeSyntax(mockBadCode);
      expect(isValid).toBe(false);
    });

    it('should detect missing setup function', () => {
      const codeWithoutSetup = `
        void loop() {
          digitalWrite(13, HIGH);
        }
      `;
      
      const isValid = arduinoCompilerService.validateCodeStructure(codeWithoutSetup);
      expect(isValid).toBe(false);
    });

    it('should detect missing loop function', () => {
      const codeWithoutLoop = `
        void setup() {
          pinMode(13, OUTPUT);
        }
      `;
      
      const isValid = arduinoCompilerService.validateCodeStructure(codeWithoutLoop);
      expect(isValid).toBe(false);
    });

    it('should accept valid structure', () => {
      const isValid = arduinoCompilerService.validateCodeStructure(mockArduinoCode);
      expect(isValid).toBe(true);
    });
  });

  describe('Educational Feedback Generation', () => {
    it('should generate feedback for simple blink', () => {
      const mockProblem = {
        expectedPatterns: {
          pinMode: ['pinMode(13, OUTPUT)'],
          digitalWrite: ['digitalWrite(13, HIGH)', 'digitalWrite(13, LOW)'],
          delay: ['delay(1000)']
        },
        description: 'Blink LED on pin 13'
      };

      const feedback = arduinoCompilerService.generateEducationalFeedback(
        mockArduinoCode,
        mockProblem
      );

      expect(feedback.score).toBeGreaterThan(80); // Should score well
      expect(feedback.strengths).toContain('Correctly configured pin 13 as OUTPUT');
      expect(feedback.strengths).toContain('Proper digitalWrite usage detected');
      expect(feedback.suggestions).toHaveLength(0); // No suggestions for perfect code
    });

    it('should provide suggestions for missing patterns', () => {
      const incompleteBlink = `
        void setup() {
          // Missing pinMode
        }
        
        void loop() {
          digitalWrite(13, HIGH);
          delay(1000);
          // Missing LOW state and delay
        }
      `;

      const mockProblem = {
        expectedPatterns: {
          pinMode: ['pinMode(13, OUTPUT)'],
          digitalWrite: ['digitalWrite(13, HIGH)', 'digitalWrite(13, LOW)'],
          delay: ['delay(1000)']
        }
      };

      const feedback = arduinoCompilerService.generateEducationalFeedback(
        incompleteBlink,
        mockProblem
      );

      expect(feedback.score).toBeLessThan(70);
      expect(feedback.suggestions).toContain('Add pinMode(13, OUTPUT) in setup()');
      expect(feedback.suggestions).toContain('Missing digitalWrite(13, LOW) for complete blink cycle');
    });

    it('should detect timing issues', () => {
      const fastBlink = mockArduinoCode.replace(/delay\(1000\)/g, 'delay(50)');
      
      const mockProblem = {
        expectedPatterns: {
          delay: ['delay(1000)']
        },
        timing: {
          minDelay: 500,
          maxDelay: 2000
        }
      };

      const feedback = arduinoCompilerService.generateEducationalFeedback(
        fastBlink,
        mockProblem
      );

      expect(feedback.suggestions).toContain('Consider using longer delays (500-2000ms) for visible blinking');
    });
  });

  describe('Board Configuration', () => {
    it('should get supported boards', () => {
      const boards = arduinoCompilerService.getSupportedBoards();
      
      expect(boards).toContain('uno');
      expect(boards).toContain('nano');
      expect(boards).toContain('mega');
      expect(boards).toContain('leonardo');
    });

    it('should validate board types', () => {
      expect(arduinoCompilerService.isValidBoard('uno')).toBe(true);
      expect(arduinoCompilerService.isValidBoard('nano')).toBe(true);
      expect(arduinoCompilerService.isValidBoard('invalid')).toBe(false);
    });

    it('should get board specifications', () => {
      const unoSpecs = arduinoCompilerService.getBoardSpecs('uno');
      
      expect(unoSpecs).toHaveProperty('flashMemory', 32768);
      expect(unoSpecs).toHaveProperty('sram', 2048);
      expect(unoSpecs).toHaveProperty('digitalPins', 14);
      expect(unoSpecs).toHaveProperty('analogPins', 6);
    });
  });

  describe('Compilation Metrics', () => {
    it('should calculate code quality metrics', async () => {
      const mockHexContent = 'mock-hex-content';
      const metrics = arduinoCompilerService.calculateQualityMetrics(
        mockArduinoCode,
        mockHexContent,
        'uno'
      );

      expect(metrics).toHaveProperty('programSize');
      expect(metrics).toHaveProperty('ramUsage');
      expect(metrics).toHaveProperty('codeComplexity');
      expect(metrics).toHaveProperty('warnings');
      
      expect(metrics.programSize).toBeGreaterThan(0);
      expect(metrics.ramUsage).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.codeComplexity).toBe('string');
    });

    it('should detect memory usage warnings', () => {
      const largeCode = `
        void setup() {
          char buffer[1500]; // Large array
        }
        void loop() {}
      `;

      const metrics = arduinoCompilerService.calculateQualityMetrics(
        largeCode,
        'mock-hex',
        'uno'
      );

      expect(metrics.warnings).toContain('High RAM usage detected');
    });
  });
});

describe('Arduino Job Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Job Submission', () => {
    it('should create submission record in database', async () => {
      const mockSubmission = {
        id: 'test-submission-123',
        userId: 'user-123',
        problemId: 'problem-456',
        status: 'queued'
      };

      (prisma.arduinoSubmission.create as any).mockResolvedValue(mockSubmission);

      const submissionId = await arduinoJobService.submitCompileJob(
        'user-123',
        'problem-456',
        mockArduinoCode,
        'uno'
      );

      expect(submissionId).toBe('test-submission-123');
      expect(prisma.arduinoSubmission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          problemId: 'problem-456',
          status: 'queued',
          boardType: 'uno'
        })
      });
    });

    it('should validate required parameters', async () => {
      await expect(
        arduinoJobService.submitCompileJob('', 'problem-456', mockArduinoCode, 'uno')
      ).rejects.toThrow('User ID is required');

      await expect(
        arduinoJobService.submitCompileJob('user-123', '', mockArduinoCode, 'uno')
      ).rejects.toThrow('Problem ID is required');

      await expect(
        arduinoJobService.submitCompileJob('user-123', 'problem-456', '', 'uno')
      ).rejects.toThrow('Code is required');
    });

    it('should validate board type', async () => {
      await expect(
        arduinoJobService.submitCompileJob('user-123', 'problem-456', mockArduinoCode, 'invalid-board')
      ).rejects.toThrow('Invalid board type');
    });
  });

  describe('Status Management', () => {
    it('should retrieve job status for authorized user', async () => {
      const mockSubmission = {
        id: 'test-submission-123',
        userId: 'user-123',
        status: 'processing',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.arduinoSubmission.findUnique as any).mockResolvedValue(mockSubmission);

      const status = await arduinoJobService.getJobStatus('test-submission-123', 'user-123');

      expect(status).toEqual(mockSubmission);
      expect(prisma.arduinoSubmission.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'test-submission-123',
          userId: 'user-123'
        }
      });
    });

    it('should return null for unauthorized access', async () => {
      (prisma.arduinoSubmission.findUnique as any).mockResolvedValue(null);

      const status = await arduinoJobService.getJobStatus('test-submission-123', 'wrong-user');

      expect(status).toBeNull();
    });

    it('should update job status', async () => {
      const mockUpdatedSubmission = {
        id: 'test-submission-123',
        status: 'compiled',
        completedAt: new Date()
      };

      (prisma.arduinoSubmission.update as any).mockResolvedValue(mockUpdatedSubmission);

      await arduinoJobService.updateJobStatus('test-submission-123', 'compiled', {
        hexFileUrl: 'https://cdn.example.com/hex/file.hex',
        feedback: { score: 95, strengths: [], suggestions: [] }
      });

      expect(prisma.arduinoSubmission.update).toHaveBeenCalledWith({
        where: { id: 'test-submission-123' },
        data: expect.objectContaining({
          status: 'compiled',
          hexFileUrl: 'https://cdn.example.com/hex/file.hex',
          completedAt: expect.any(Date)
        })
      });
    });
  });

  describe('User Submissions', () => {
    it('should get paginated user submissions', async () => {
      const mockSubmissions = [
        { id: 'sub-1', problemId: 'prob-1', status: 'compiled' },
        { id: 'sub-2', problemId: 'prob-2', status: 'failed' }
      ];

      (prisma.arduinoSubmission.findMany as any).mockResolvedValue(mockSubmissions);

      const submissions = await arduinoJobService.getUserSubmissions('user-123', 1, 10);

      expect(submissions).toEqual(mockSubmissions);
      expect(prisma.arduinoSubmission.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      });
    });

    it('should handle pagination correctly', async () => {
      await arduinoJobService.getUserSubmissions('user-123', 3, 5);

      expect(prisma.arduinoSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (3-1) * 5
          take: 5
        })
      );
    });
  });

  describe('Queue Statistics', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        waiting: 2,
        active: 1,
        completed: 50,
        failed: 3,
        delayed: 0
      };

      // Mock the queue's getJobCounts method
      const Queue = await import('bull');
      const mockQueue = new Queue.default('test');
      (mockQueue.getJobCounts as any).mockResolvedValue(mockStats);

      const stats = await arduinoJobService.getQueueStats();

      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('total');
    });
  });

  describe('Job Cleanup', () => {
    it('should clean old completed jobs', async () => {
      const Queue = await import('bull');
      const mockQueue = new Queue.default('test');
      (mockQueue.clean as any).mockResolvedValue(15); // 15 jobs cleaned

      const cleanedCount = await arduinoJobService.cleanOldJobs();

      expect(cleanedCount).toBe(15);
      expect(mockQueue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 'completed'); // 24 hours
    });

    it('should clean failed jobs older than 7 days', async () => {
      const cleanedCount = await arduinoJobService.cleanOldJobs('failed', 7);

      const Queue = await import('bull');
      const mockQueue = new Queue.default('test');
      expect(mockQueue.clean).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000, 'failed');
    });
  });
});

describe('CDN Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload HEX file to CDN', async () => {
    const mockHexContent = 'mock-hex-file-content';
    const mockUrl = 'https://cdn.example.com/arduino/test-submission-123.hex';

    (cdnService.uploadFile as any).mockResolvedValue({
      url: mockUrl,
      fileId: 'file-123'
    });

    const result = await cdnService.uploadFile(
      Buffer.from(mockHexContent),
      'arduino/test-submission-123.hex',
      'application/octet-stream'
    );

    expect(result.url).toBe(mockUrl);
    expect(cdnService.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'arduino/test-submission-123.hex',
      'application/octet-stream'
    );
  });

  it('should handle upload failures gracefully', async () => {
    (cdnService.uploadFile as any).mockRejectedValue(new Error('Upload failed'));

    await expect(
      cdnService.uploadFile(Buffer.from('test'), 'test.hex', 'application/octet-stream')
    ).rejects.toThrow('Upload failed');
  });

  it('should delete HEX files from CDN', async () => {
    (cdnService.deleteFile as any).mockResolvedValue(true);

    const result = await cdnService.deleteFile('file-123');

    expect(result).toBe(true);
    expect(cdnService.deleteFile).toHaveBeenCalledWith('file-123');
  });
});