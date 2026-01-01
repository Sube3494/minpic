import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    // Get complete user information
    const userInfo = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        githubId: true,
        username: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        storageQuota: true,
        storageUsed: true,
        fileQuota: true,
        fileCount: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!userInfo) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const serializedUserInfo = {
      ...userInfo,
      storageQuota: userInfo.storageQuota.toString(),
      storageUsed: userInfo.storageUsed.toString(),
    };

    return NextResponse.json(serializedUserInfo);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
