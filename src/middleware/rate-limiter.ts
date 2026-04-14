import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.js';

const redisClient = getRedisClient();

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

class RateLimiter {
  private config: RateLimitConfig;
  private prefix: string;

  constructor(config: RateLimitConfig, prefix: string = 'rate_limit') {
    this.config = config;
    this.prefix = prefix;
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.config.keyGenerator ? 
          this.config.keyGenerator(req) : 
          this.getDefaultKey(req);

        const fullKey = `${this.prefix}:${key}`;
        const current = await this.getCurrentCount(fullKey);
        
        if (current >= this.config.maxRequests) {
          if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res);
            return;
          }
          
          res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: `Too many requests. Limit: ${this.config.maxRequests} per ${this.config.windowMs / 1000}s`,
            retryAfter: await this.getRetryAfter(fullKey)
          });
          return;
        }

        // Increment counter
        await this.incrementCount(fullKey);
        
        // Add rate limit headers
        const remaining = Math.max(0, this.config.maxRequests - current - 1);
        const resetTime = Date.now() + this.config.windowMs;
        
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
        
        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // On Redis error, allow request through (fail-open)
        next();
      }
    };
  }

  private getDefaultKey(req: Request): string {
    // Use user ID if authenticated, otherwise fall back to IP
    const userId = (req as any).user?.id || req.ip;
    return `user:${userId}`;
  }

  private async getCurrentCount(key: string): Promise<number> {
    const count = await redisClient.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  private async incrementCount(key: string): Promise<void> {
    const multi = redisClient.multi();
    multi.incr(key);
    multi.expire(key, Math.ceil(this.config.windowMs / 1000));
    await multi.exec();
  }

  private async getRetryAfter(key: string): Promise<number> {
    const ttl = await redisClient.ttl(key);
    return ttl > 0 ? ttl : Math.ceil(this.config.windowMs / 1000);
  }
}

// Pre-configured rate limiters for Arduino operations
export const arduinoCompileRateLimit = new RateLimiter({
  windowMs: 60 * 1000,  // 1 minute window
  maxRequests: 5,       // 5 compilations per minute per user
  keyGenerator: (req) => `compile:user:${(req as any).user?.id || req.ip}`,
  onLimitReached: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Arduino compilation rate limit exceeded',
      message: 'You can only compile 5 Arduino sketches per minute. Please wait before trying again.',
      limit: 5,
      windowMs: 60000
    });
  }
}, 'arduino_compile');

export const arduinoSubmitRateLimit = new RateLimiter({
  windowMs: 30 * 1000,  // 30 second window  
  maxRequests: 10,      // 10 submissions per 30 seconds per user
  keyGenerator: (req) => `submit:user:${(req as any).user?.id || req.ip}`,
}, 'arduino_submit');

export const generalArduinoRateLimit = new RateLimiter({
  windowMs: 60 * 1000,  // 1 minute window
  maxRequests: 20,      // 20 general Arduino API calls per minute per user
  keyGenerator: (req) => `general:user:${(req as any).user?.id || req.ip}`,
}, 'arduino_general');

export { RateLimiter };