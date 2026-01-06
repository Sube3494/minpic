
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cache } from '@/lib/cache';
import { rateLimiter } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: '请填写所有字段' }, { status: 400 });
    }

    // 1. Check Rate Limit for Verification (Anti-Brute-Force)
    // Limit: 5 failed attempts per 10 mins per email
    const verifyLimit = await rateLimiter.check(`verify:login:${email}`, 5, 10 * 60 * 1000);
    if (!verifyLimit.allowed) {
      return NextResponse.json({ error: '尝试次数过多，请稍后再试' }, { status: 429 });
    }

    // 2. Verify Code
    const storedCode = await cache.get(`verify:reset:${email}`);
    if (!storedCode || storedCode !== code) {
      return NextResponse.json({ error: '验证码无效或已过期' }, { status: 400 });
    }

    // 3. Find User
    const user = await prisma.user.findFirst({
        where: { email },
    });

    if (!user) {
        // To prevent user enumeration, we might want to return success/generic error,
        // but for usability in this context, specific error is often preferred.
        // Let's return generic to be safe or specific if user wants friendliness.
        // Since we already sent the code (which reveals email existence if we don't handle it carefully there),
        // let's stick to standard flow. Actually, send-code checks nothing about user existence for 'reset' usually?
        // Wait, for reset password, send-code SHOULD check if user exists usually?
        // If I change send-code to check user existence, it leaks email.
        // If I don't, I end up here.
        // Let's return error here.
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 4. Update Password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
    });

    // 5. Cleanup
    await cache.del(`verify:reset:${email}`);

    return NextResponse.json({ success: true, message: '密码重置成功' });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: '重置密码失败' }, { status: 500 });
  }
}
