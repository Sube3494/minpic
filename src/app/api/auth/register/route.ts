import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemSettings } from '@/lib/settings';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { cache } from '@/lib/cache';
import { hashEmail } from '@/lib/md5';

export async function POST(req: Request) {
  try {
    const { username, email, password, code } = await req.json();

    if (!username || !email || !password || !code) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 0. Verify Code
    const storedCode = await cache.get(`verify:register:${email}`);
    if (!storedCode || storedCode !== code) {
      return NextResponse.json({ error: '验证码无效或已过期' }, { status: 400 });
    }

    // Get system settings
    const settings = await getSystemSettings();
    const adminEmail = process.env.ADMIN_EMAIL;
    const isInitialAdmin = adminEmail && email === adminEmail;

    // Check if registration is enabled
    if (!isInitialAdmin && settings && !settings.registrationEnabled) {
      return NextResponse.json({ error: 'Registration is closed' }, { status: 403 });
    }

    // Whitelist check
    if (!isInitialAdmin && settings?.requireWhitelist) {
      const whitelistEntry = await prisma.registrationWhitelist.findUnique({
        where: { email }
      });

      if (!whitelistEntry || whitelistEntry.used) {
        return NextResponse.json({ error: 'Email not whitelisted' }, { status: 403 });
      }

      await prisma.registrationWhitelist.update({
        where: { id: whitelistEntry.id },
        data: { used: true, usedAt: new Date() }
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        avatar: `https://cravatar.cn/avatar/${hashEmail(email)}?d=404`,
        role: isInitialAdmin ? 'ADMIN' : 'USER',
        status: 'ACTIVE',
      }
    });

    // Log audit
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (headersList.get('x-real-ip') || '127.0.0.1');

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_CREATED',
        metadata: JSON.stringify({ username, provider: 'credentials' }),
        ipAddress: ip,
      }
    });

    // Delete used code
    await cache.del(`verify:register:${email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
