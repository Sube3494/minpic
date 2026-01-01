import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';

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

    return NextResponse.json(serializeBigInt({
      ...userInfo,
      storageQuota: effectiveStorageQuota,
      fileQuota: effectiveFileQuota,
    }));
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
