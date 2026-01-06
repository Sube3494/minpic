
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, githubId: true, email: true, avatar: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.githubId) {
      return NextResponse.json({ error: 'GitHub account not linked' }, { status: 400 });
    }

    // Safety check: Don't allow unbinding if user has no password
    // This prevents locking themselves out
    if (!user.password) {
      return NextResponse.json({ 
        error: '请先在下方设置登录密码，再进行解绑操作，以防账号无法登录。' 
      }, { status: 400 });
    }

    // 1. Delete the Account record
    await prisma.account.deleteMany({
      where: {
        userId,
        provider: 'github'
      }
    });

    // 2. Clear githubId and potentially reset avatar in User record
    const shouldResetAvatar = user.avatar?.includes('githubusercontent');
    await prisma.user.update({
      where: { id: userId },
      data: { 
        githubId: null,
        ...(shouldResetAvatar ? { avatar: null } : {})
      }
    });

    // 3. Create audit log
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    let ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (headersList.get('x-real-ip') || '127.0.0.1');
    if (ip === '::1') ip = '127.0.0.1';

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GITHUB_UNLINKED',
        ipAddress: ip,
        metadata: JSON.stringify({ email: user.email })
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to unbind GitHub:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
