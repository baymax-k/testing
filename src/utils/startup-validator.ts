// ─── Startup Validation ───────────────────────────────────────────────────────
// Validates all critical services before starting the server
// Fails fast if any dependency is unavailable

import { prisma } from '../config/prisma.js';
import { getRedisClient, isRedisHealthy } from '../config/redis.js';
import axios from 'axios';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
}

export class StartupValidator {
  private results: ServiceHealth[] = [];

  /**
   * Validate database connection
   */
  async validateDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      
      const result: ServiceHealth = {
        name: 'PostgreSQL',
        status: 'healthy',
        message: 'Database connection successful',
        responseTime
      };
      
      this.results.push(result);
      console.log(`✓ PostgreSQL: Connected (${responseTime}ms)`);
      return result;
    } catch (error: any) {
      const result: ServiceHealth = {
        name: 'PostgreSQL',
        status: 'unhealthy',
        message: error.message
      };
      
      this.results.push(result);
      console.error(`✗ PostgreSQL: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate Redis connection
   */
  async validateRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const healthy = await isRedisHealthy();
      const responseTime = Date.now() - start;
      
      if (healthy) {
        const result: ServiceHealth = {
          name: 'Redis',
          status: 'healthy',
          message: 'Redis connection successful',
          responseTime
        };
        
        this.results.push(result);
        console.log(`✓ Redis: Connected (${responseTime}ms)`);
        return result;
      } else {
        throw new Error('Redis PING failed');
      }
    } catch (error: any) {
      const result: ServiceHealth = {
        name: 'Redis',
        status: 'unhealthy',
        message: error.message
      };
      
      this.results.push(result);
      console.error(`✗ Redis: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate Judge0 service (optional - can be degraded)
   */
  async validateJudge0(): Promise<ServiceHealth> {
    const judge0Url = process.env.JUDGE0_URL || 'http://localhost:2358';
    const start = Date.now();
    
    try {
      const response = await axios.get(`${judge0Url}/about`, {
        timeout: 5000
      });
      
      const responseTime = Date.now() - start;
      
      if (response.status === 200) {
        const result: ServiceHealth = {
          name: 'Judge0',
          status: 'healthy',
          message: 'Judge0 service available',
          responseTime
        };
        
        this.results.push(result);
        console.log(`✓ Judge0: Available (${responseTime}ms)`);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      const result: ServiceHealth = {
        name: 'Judge0',
        status: 'degraded',
        message: `Judge0 unavailable: ${error.message}`
      };
      
      this.results.push(result);
      console.warn(`⚠ Judge0: ${error.message} (DSA submissions will fail)`);
      return result;
    }
  }

  /**
   * Validate Arduino compiler service (optional - can be degraded)
   */
  async validateArduinoCompiler(): Promise<ServiceHealth> {
    const compilerUrl = process.env.ARDUINO_COMPILER_URL || 'http://localhost:3001';
    
    const start = Date.now();
    
    try {
      const response = await axios.get(`${compilerUrl}/health`, {
        timeout: 5000
      });
      
      const responseTime = Date.now() - start;
      
      if (response.status === 200) {
        const result: ServiceHealth = {
          name: 'Arduino Compiler',
          status: 'healthy',
          message: 'Arduino compiler service available',
          responseTime
        };
        
        this.results.push(result);
        console.log(`✓ Arduino Compiler: Available (${responseTime}ms)`);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      const result: ServiceHealth = {
        name: 'Arduino Compiler',
        status: 'degraded',
        message: `Arduino compiler unavailable: ${error.message}`
      };
      
      this.results.push(result);
      console.warn(`⚠ Arduino Compiler: ${error.message} (Arduino submissions will fail)`);
      return result;
    }
  }

  /**
   * Run all validations
   */
  async validateAll(): Promise<{
    success: boolean;
    results: ServiceHealth[];
    criticalFailures: string[];
  }> {
    console.log('\n🔍 Validating services...\n');
    
    // Critical services (must be healthy)
    const [dbHealth, redisHealth] = await Promise.all([
      this.validateDatabase(),
      this.validateRedis()
    ]);
    
    // Optional services (can be degraded)
    const [judge0Health, arduinoHealth] = await Promise.all([
      this.validateJudge0(),
      this.validateArduinoCompiler()
    ]);
    
    // Check for critical failures
    const criticalFailures: string[] = [];
    
    if (dbHealth.status === 'unhealthy') {
      criticalFailures.push(`Database: ${dbHealth.message}`);
    }
    
    if (redisHealth.status === 'unhealthy') {
      criticalFailures.push(`Redis: ${redisHealth.message}`);
    }
    
    const success = criticalFailures.length === 0;
    
    if (success) {
      console.log('\n✅ All critical services are healthy\n');
    } else {
      console.error('\n❌ Critical service failures detected:\n');
      criticalFailures.forEach(failure => console.error(`   - ${failure}`));
      console.error('');
    }
    
    return {
      success,
      results: this.results,
      criticalFailures
    };
  }

  /**
   * Get validation results
   */
  getResults(): ServiceHealth[] {
    return this.results;
  }
}

export const startupValidator = new StartupValidator();
