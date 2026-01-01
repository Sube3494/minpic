import { NextResponse } from 'next/server';

export function rateLimitResponse(resetTime: number) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: `请求过于频繁，请在 ${retryAfter} 秒后重试`,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      },
    }
  );
}

export function addRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetTime: number
): NextResponse {
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
  return response;
}
