import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    // Get user statistics
    const [fileStats, recentFiles] = await Promise.all([
      // Total files and storage
      prisma.file.aggregate({
        where: { userId: user.id },
        _count: true,
        _sum: {
          fileSize: true,
        },
      }),
      // Recent files (last 7 days)
      prisma.file.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get file type distribution
    const fileTypeStats = await prisma.file.groupBy({
      by: ['fileType'],
      where: { userId: user.id },
      _count: true,
    });

    return NextResponse.json(serializeBigInt({
      totalFiles: fileStats._count || 0,
      totalStorage: fileStats._sum.fileSize || 0,
      recentFiles,
      fileTypeDistribution: fileTypeStats.map(stat => ({
        type: stat.fileType,
        count: stat._count,
      })),
    }));
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
