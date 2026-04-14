import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Performance } from 'perf_hooks';
import { arduinoJobService } from '../src/services/arduino-job.service';
import { getRedisClient } from '../src/config/redis';
import { prisma } from '../src/config/prisma';

// Load test configuration
const LOAD_TEST_CONFIG = {
  CONCURRENT_USERS: 50,
  SUBMISSIONS_PER_USER: 3,
  TIMEOUT_MS: 60000, // 1 minute timeout
  MAX_ACCEPTABLE_RESPONSE_TIME: 5000, // 5 seconds
  MAX_ACCEPTABLE_QUEUE_TIME: 10000 // 10 seconds
};

const testArduinoCode = `
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}`;

let redisClient: any;
let testUsers: string[] = [];
let testProblem: any;

describe('Arduino Load Testing', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up Arduino Load Tests...');
    
    // Setup connections
    await prisma.$connect();
    redisClient = getRedisClient();
    
    // Create test problem
    testProblem = await prisma.arduinoProblem.upsert({
      where: { id: 'load-test-arduino-problem' },
      update: {},
      create: {
        id: 'load-test-arduino-problem',
        title: 'Load Test Arduino Problem',
        description: 'Simple LED blink for load testing',
        difficulty: 'easy',
        maxMemory: 2048,
        timeLimit: 10000,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create test users
    for (let i = 1; i <= LOAD_TEST_CONFIG.CONCURRENT_USERS; i++) {
      const userId = `load-test-user-${i}`;
      testUsers.push(userId);
      
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `loadtest${i}@example.com`,
          role: 'student',
          verified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    console.log(`✅ Created ${testUsers.length} test users and problem`);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up load test data...');
    
    // Clean up submissions
    await prisma.arduinoSubmission.deleteMany({
      where: {
        userId: { in: testUsers }
      }
    });

    // Clean up users
    await prisma.user.deleteMany({
      where: { id: { in: testUsers } }
    });

    // Clean up problem
    await prisma.arduinoProblem.delete({
      where: { id: testProblem.id }
    }).catch(() => {});

    await prisma.$disconnect();
    await redisClient.disconnect();
    
    console.log('✅ Cleanup completed');
  });

  describe('Concurrent Submission Load Test', () => {
    it('should handle 50 concurrent compilation requests', async () => {
      console.log(`🔥 Starting load test: ${LOAD_TEST_CONFIG.CONCURRENT_USERS} concurrent users`);
      console.log(`📊 Each user submits ${LOAD_TEST_CONFIG.SUBMISSIONS_PER_USER} compilations`);
      
      const startTime = performance.now();
      const results: Array<{
        userId: string;
        submissionId?: string;
        responseTime: number;
        success: boolean;
        error?: string;
      }> = [];

      // Create concurrent compilation requests
      const promises = testUsers.map(async (userId, index) => {
        const userResults: typeof results = [];
        
        for (let i = 0; i < LOAD_TEST_CONFIG.SUBMISSIONS_PER_USER; i++) {
          const requestStart = performance.now();
          
          try {
            const submissionId = await arduinoJobService.submitCompileJob(
              userId,
              testProblem.id,
              testArduinoCode,
              'uno'
            );

            const responseTime = performance.now() - requestStart;
            
            userResults.push({
              userId,
              submissionId,
              responseTime,
              success: true
            });

            console.log(`✓ User ${index + 1} submission ${i + 1}: ${responseTime.toFixed(2)}ms`);
            
          } catch (error) {
            const responseTime = performance.now() - requestStart;
            
            userResults.push({
              userId,
              responseTime,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            console.log(`✗ User ${index + 1} submission ${i + 1} failed: ${error}`);
          }
        }

        return userResults;
      });

      // Wait for all requests to complete
      const allResults = await Promise.all(promises);
      results.push(...allResults.flat());

      const totalTime = performance.now() - startTime;
      
      // Analyze results
      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      const averageResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      const maxResponseTime = Math.max(...successfulRequests.map(r => r.responseTime));
      const minResponseTime = Math.min(...successfulRequests.map(r => r.responseTime));

      console.log('\n📈 LOAD TEST RESULTS:');
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Total requests: ${results.length}`);
      console.log(`Successful: ${successfulRequests.length} (${((successfulRequests.length / results.length) * 100).toFixed(1)}%)`);
      console.log(`Failed: ${failedRequests.length} (${((failedRequests.length / results.length) * 100).toFixed(1)}%)`);
      console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`Min response time: ${minResponseTime.toFixed(2)}ms`);
      console.log(`Max response time: ${maxResponseTime.toFixed(2)}ms`);

      // Performance assertions
      expect(successfulRequests.length).toBeGreaterThan(results.length * 0.95); // 95% success rate
      expect(averageResponseTime).toBeLessThan(LOAD_TEST_CONFIG.MAX_ACCEPTABLE_RESPONSE_TIME);
      expect(maxResponseTime).toBeLessThan(LOAD_TEST_CONFIG.MAX_ACCEPTABLE_RESPONSE_TIME * 2);

      // Check queue doesn't get overwhelmed
      const queueStats = await arduinoJobService.getQueueStats();
      console.log(`Queue stats: waiting=${queueStats.waiting}, active=${queueStats.active}, total=${queueStats.total}`);
      
      expect(queueStats.waiting).toBeLessThan(100); // Queue shouldn't get too backed up
    }, LOAD_TEST_CONFIG.TIMEOUT_MS);
  });

  describe('Queue Performance Under Load', () => {
    it('should maintain reasonable queue processing times', async () => {
      console.log('🔄 Testing queue processing performance...');

      // Submit a batch of jobs
      const batchSize = 20;
      const submissionIds: string[] = [];
      
      console.log(`Submitting ${batchSize} jobs simultaneously...`);
      const submitStart = performance.now();
      
      const submitPromises = Array(batchSize).fill(0).map(async (_, i) => {
        const userId = testUsers[i % testUsers.length];
        return await arduinoJobService.submitCompileJob(
          userId,
          testProblem.id,
          testArduinoCode,
          'uno'
        );
      });

      const submissions = await Promise.all(submitPromises);
      submissionIds.push(...submissions);
      
      const submitTime = performance.now() - submitStart;
      console.log(`✅ All jobs submitted in ${submitTime.toFixed(2)}ms`);

      // Monitor queue processing
      let allCompleted = false;
      let monitoringRounds = 0;
      const maxMonitoringRounds = 30; // 30 seconds max
      const monitoringStart = performance.now();

      while (!allCompleted && monitoringRounds < maxMonitoringRounds) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        monitoringRounds++;

        // Check status of all submissions
        const statuses = await Promise.all(
          submissionIds.map(id => 
            prisma.arduinoSubmission.findUnique({
              where: { id },
              select: { status: true }
            })
          )
        );

        const completed = statuses.filter(s => 
          s?.status && ['compiled', 'compilation_error', 'failed'].includes(s.status)
        ).length;
        
        const queued = statuses.filter(s => s?.status === 'queued').length;
        const processing = statuses.filter(s => s?.status === 'processing').length;

        console.log(`Round ${monitoringRounds}: completed=${completed}, queued=${queued}, processing=${processing}`);

        if (completed === submissionIds.length) {
          allCompleted = true;
        }
      }

      const totalProcessingTime = performance.now() - monitoringStart;
      console.log(`⏱️  Total processing time: ${totalProcessingTime.toFixed(2)}ms`);

      // Performance assertions
      expect(allCompleted).toBe(true); // All jobs should complete
      expect(totalProcessingTime).toBeLessThan(LOAD_TEST_CONFIG.TIMEOUT_MS * 0.8); // Should complete in reasonable time

      // Check final queue stats
      const finalStats = await arduinoJobService.getQueueStats();
      console.log(`Final queue stats:`, finalStats);
    }, LOAD_TEST_CONFIG.TIMEOUT_MS);
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during intensive operations', async () => {
      const initialMemory = process.memoryUsage();
      console.log('📊 Initial memory usage:', {
        rss: `${Math.round(initialMemory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(initialMemory.heapTotal / 1024 / 1024)}MB`
      });

      // Perform intensive operations
      const intensiveOperations = 100;
      const submissions: string[] = [];

      for (let i = 0; i < intensiveOperations; i++) {
        const userId = testUsers[i % testUsers.length];
        const submissionId = await arduinoJobService.submitCompileJob(
          userId,
          testProblem.id,
          testArduinoCode,
          'uno'
        );
        submissions.push(submissionId);

        // Force garbage collection every 20 operations
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      // Get final memory usage
      if (global.gc) global.gc(); // Force garbage collection
      await new Promise(resolve => setTimeout(resolve, 1000)); // Let GC finish

      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
      };

      console.log('📊 Final memory usage:', {
        rss: `${Math.round(finalMemory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(finalMemory.heapTotal / 1024 / 1024)}MB`
      });

      console.log('📈 Memory increase:', {
        rss: `${Math.round(memoryIncrease.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryIncrease.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryIncrease.heapTotal / 1024 / 1024)}MB`
      });

      // Memory should not increase dramatically (allow for some growth)
      expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB heap increase
    });

    it('should handle Redis connection efficiently under load', async () => {
      console.log('🔗 Testing Redis connection efficiency...');

      const redisOperations = 200;
      const startTime = performance.now();

      // Perform many Redis operations
      const operations = Array(redisOperations).fill(0).map(async (_, i) => {
        const key = `load-test-key-${i}`;
        const value = JSON.stringify({ test: 'data', timestamp: Date.now() });
        
        await redisClient.set(key, value, 'EX', 60); // 60 second expiry
        const retrieved = await redisClient.get(key);
        await redisClient.del(key);
        
        return retrieved !== null;
      });

      const results = await Promise.all(operations);
      const successfulOps = results.filter(Boolean).length;
      const totalTime = performance.now() - startTime;

      console.log(`✅ Completed ${successfulOps}/${redisOperations} Redis operations in ${totalTime.toFixed(2)}ms`);
      console.log(`⚡ Average operation time: ${(totalTime / redisOperations).toFixed(2)}ms`);

      // Performance assertions
      expect(successfulOps).toBe(redisOperations); // All operations should succeed
      expect(totalTime / redisOperations).toBeLessThan(50); // Average less than 50ms per operation
    });
  });

  describe('Error Handling Under Load', () => {
    it('should gracefully handle invalid submissions during load', async () => {
      console.log('🚨 Testing error handling under load...');

      const invalidCode = `
        void setup() {
          pinMode(13, OUTPUT  // Syntax error - missing parenthesis
        }
        void loop() {
          // Invalid code
        }
      `;

      const mixedSubmissions = 50;
      const results: Array<{ success: boolean; error?: string }> = [];

      // Submit mix of valid and invalid code
      const promises = Array(mixedSubmissions).fill(0).map(async (_, i) => {
        const userId = testUsers[i % testUsers.length];
        const code = i % 3 === 0 ? invalidCode : testArduinoCode; // Every 3rd submission is invalid
        
        try {
          const submissionId = await arduinoJobService.submitCompileJob(
            userId,
            testProblem.id,
            code,
            'uno'
          );
          
          return { success: true, submissionId };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const submissionResults = await Promise.all(promises);
      const successful = submissionResults.filter(r => r.success).length;
      const failed = submissionResults.filter(r => !r.success).length;

      console.log(`📊 Mixed submissions: ${successful} successful, ${failed} failed`);

      // Even with invalid code, submissions should be queued (errors handled during processing)
      expect(successful).toBeGreaterThan(mixedSubmissions * 0.9); // At least 90% should queue successfully
      
      // Queue should still be functional
      const queueStats = await arduinoJobService.getQueueStats();
      expect(queueStats.total).toBeGreaterThan(0);
    });

    it('should maintain system stability during rapid-fire requests', async () => {
      console.log('🔥 Testing rapid-fire request handling...');

      const rapidRequests = 100;
      const delayBetweenRequests = 10; // 10ms between requests
      const results: Array<{ success: boolean; responseTime: number }> = [];

      for (let i = 0; i < rapidRequests; i++) {
        const startTime = performance.now();
        const userId = testUsers[i % testUsers.length];
        
        try {
          await arduinoJobService.submitCompileJob(
            userId,
            testProblem.id,
            testArduinoCode,
            'uno'
          );
          
          const responseTime = performance.now() - startTime;
          results.push({ success: true, responseTime });
          
        } catch (error) {
          const responseTime = performance.now() - startTime;
          results.push({ success: false, responseTime });
          console.log(`Request ${i + 1} failed:`, error);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }

      const successRate = results.filter(r => r.success).length / results.length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

      console.log(`📊 Rapid-fire results: ${(successRate * 100).toFixed(1)}% success rate`);
      console.log(`⚡ Average response time: ${avgResponseTime.toFixed(2)}ms`);

      // System should remain stable
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(1000); // Average under 1 second
    });
  });

  describe('Cleanup Performance', () => {
    it('should efficiently clean old jobs', async () => {
      console.log('🧹 Testing job cleanup performance...');

      // Create some old submissions in the database
      const oldSubmissions = 20;
      const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      await Promise.all(
        Array(oldSubmissions).fill(0).map((_, i) =>
          prisma.arduinoSubmission.create({
            data: {
              id: `old-submission-${i}`,
              userId: testUsers[0],
              problemId: testProblem.id,
              code: testArduinoCode,
              boardType: 'uno',
              status: 'compiled',
              createdAt: oldDate,
              updatedAt: oldDate,
              completedAt: oldDate
            }
          })
        )
      );

      console.log(`📅 Created ${oldSubmissions} old submissions`);

      // Test cleanup performance
      const cleanupStart = performance.now();
      const cleanedCount = await arduinoJobService.cleanOldJobs('completed', 1); // Clean jobs older than 1 day
      const cleanupTime = performance.now() - cleanupStart;

      console.log(`🗑️  Cleaned ${cleanedCount} jobs in ${cleanupTime.toFixed(2)}ms`);

      // Cleanup should be efficient
      expect(cleanupTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(cleanedCount).toBeGreaterThanOrEqual(oldSubmissions);
    });
  });
});