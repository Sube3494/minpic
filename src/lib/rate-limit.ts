// Simple in-memory rate limiter
// For production, consider using Redis

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.requests.entries()) {
        if (now > entry.resetTime) {
          this.requests.delete(key);
        }
      }
    }, 60000);
  }

  check(identifier: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window
      const resetTime = now + windowMs;
      this.requests.set(identifier, { count: 1, resetTime });
      return { allowed: true, remaining: limit - 1, resetTime };
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Increment count
    entry.count++;
    this.requests.set(identifier, entry);
    return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime };
  }

  cleanup() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
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
  // General API: 200 requests per 15 minutes
  GENERAL_API: {
    limit: 200,
    windowMs: 15 * 60 * 1000,
  },
};

// Helper function to get client identifier
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  return ip;
}

// Middleware function for rate limiting
export function checkRateLimit(
  request: Request,
  config: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number; resetTime: number } {
  const identifier = getClientIdentifier(request);
  return rateLimiter.check(identifier, config.limit, config.windowMs);
}
