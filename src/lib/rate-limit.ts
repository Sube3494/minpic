import { cache } from './cache';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

class RateLimiter {
  /**
   * Check rate limit for a given identifier
   * @param identifier Key identifier (e.g., IP address, email)
   * @param limit Max requests allowed
   * @param windowMs Time window in milliseconds
   * @returns RateLimitResult
   */
  async check(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const key = `rate:${identifier}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      // Atomic increment
      const count = await cache.incr(key, windowSeconds);

      // Calculate reset time (approximate, since we don't fetch TTL every time for performance)
      // This is good enough for headers
      const resetTime = Date.now() + windowMs;

      if (count > limit) {
        return { allowed: false, remaining: 0, resetTime };
      }

      return { allowed: true, remaining: limit - count, resetTime };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open to avoid blocking legitimate users on cache error
      return { allowed: true, remaining: 1, resetTime: Date.now() + windowMs };
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Rate limit configurations
export const RATE_LIMITS = {
  // Admin API: 100 requests per 15 minutes
  ADMIN_API: {
    limit: 100,
    windowMs: 15 * 60 * 1000,
  },
  // Auth API: 5 requests per 15 minutes
  AUTH_API: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  },
  // Code Generation: 1 request per 60 seconds (Anti-spam)
  CODE_GEN: {
    limit: 1,
    windowMs: 60 * 1000,
  },
  // Code Verification: 5 failed attempts per 10 minutes (Anti-brute-force)
  CODE_VERIFY: {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  },
  // General API: 200 requests per 15 minutes
  GENERAL_API: {
    limit: 200,
    windowMs: 15 * 60 * 1000,
  },
};

// Helper function to get client identifier
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  return ip.trim();
}

// Middleware function for rate limiting
export async function checkRateLimit(
  request: Request,
  config: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);
  return rateLimiter.check(identifier, config.limit, config.windowMs);
}
