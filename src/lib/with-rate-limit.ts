import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from './rate-limit';
import { rateLimitResponse, addRateLimitHeaders } from './rate-limit-response';

export function withRateLimit(
  handler: (request: NextRequest) => Promise<Response>,
  config = RATE_LIMITS.GENERAL_API
) {
  return async (request: NextRequest) => {
    const { allowed, remaining, resetTime } = await checkRateLimit(request, config);

    if (!allowed) {
      return rateLimitResponse(resetTime);
    }

    const response = await handler(request);
    return addRateLimitHeaders(response as NextResponse, remaining, resetTime);
  };
}
