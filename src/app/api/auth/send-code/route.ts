
import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { rateLimiter, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { sendVerificationCode } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { email, type } = await req.json();

    if (!email || !type) {
      return NextResponse.json({ error: '邮箱和类型不能为空' }, { status: 400 });
    }

    if (!['register', 'reset'].includes(type)) {
      return NextResponse.json({ error: '无效的操作类型' }, { status: 400 });
    }

    // 1. Rate Limiting (Anti-Explosion)
    const ip = getClientIdentifier(req);
    
    // IP Limit: Prevent massive requests from one IP
    const ipLimit = await rateLimiter.check(`ip:${type}:${ip}`, RATE_LIMITS.AUTH_API.limit, RATE_LIMITS.AUTH_API.windowMs);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    // Email Limit: Prevent spamming one email (1 request per 60s)
    const emailLimit = await rateLimiter.check(`email:${type}:${email}`, 1, 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: '请等待 60 秒后再次发送验证码' }, { status: 429 });
    }

    // 2. Generate Secure Code
    const code = crypto.randomInt(100000, 999999).toString();

    // 3. Store in Redis (TTL 5 minutes)
    // Key format: verify:register:email@example.com
    await cache.set(`verify:${type}:${email}`, code, 5 * 60);

    // 4. Send Email
    await sendVerificationCode(email, code, type);

    return NextResponse.json({ success: true, message: '验证码已发送' });

  } catch (error) {
    console.error('Error in send-code:', error);
    return NextResponse.json({ error: '验证码发送失败' }, { status: 500 });
  }
}
