import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getSystemSettings } from '@/lib/settings';
import { serializeBigInt } from '@/lib/utils';
import { hashEmail } from '@/lib/md5';

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
        storageUsed: true,
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

    // Gravatar fallback for API
    if (!userInfo.avatar && userInfo.email) {
      const hash = hashEmail(userInfo.email);
      userInfo.avatar = `https://cravatar.cn/avatar/${hash}?d=404`;
    }

    // Get quota limits from TeamMember or Team
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.id },
      select: {
        storageQuota: true,
        fileQuota: true,
        team: {
          select: {
            storageQuota: true,
            fileQuota: true,
          }
        }
      }
    });

    // Determine effective quotas
    let effectiveStorageQuota = null;
    let effectiveFileQuota = null;

    if (teamMember) {
      effectiveStorageQuota = teamMember.storageQuota;
      effectiveFileQuota = teamMember.fileQuota;
    } else {
      // If not a team member, check if they are an owner of a team
      const ownedTeam = await prisma.team.findUnique({
        where: { ownerId: user.id },
        select: {
          storageQuota: true,
          fileQuota: true,
        }
      });
      if (ownedTeam) {
        effectiveStorageQuota = ownedTeam.storageQuota;
        effectiveFileQuota = ownedTeam.fileQuota;
      }
    }

    const settings = await getSystemSettings();
    
    return NextResponse.json(serializeBigInt({
      ...userInfo,
      storageQuota: effectiveStorageQuota,
      fileQuota: effectiveFileQuota,
      githubLoginEnabled: settings?.githubLoginEnabled ?? true,
    }));
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const { name } = await req.json();

    // Validation
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name format' }, { status: 400 });
    }

    if (name.length > 32) {
      return NextResponse.json({ error: '昵称不能超过 32 个字符' }, { status: 400 });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { name: name.trim() || null }, // Set to null if empty string
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        name: updatedUser.name,
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
