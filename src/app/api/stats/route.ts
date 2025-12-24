import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [totalFiles, totalImages, totalVideos, totalAudios] = await Promise.all([
      prisma.file.count(),
      prisma.file.count({ where: { fileType: 'image' } }),
      prisma.file.count({ where: { fileType: 'video' } }),
      prisma.file.count({ where: { fileType: 'audio' } }),
    ]);

    const totalSize = await prisma.file.aggregate({
      _sum: { fileSize: true },
    });

    const totalShortlinks = await prisma.file.count({
      where: { shortlinkCode: { not: null } },
    });

    const recentFiles = await prisma.file.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      totalFiles,
      totalImages,
      totalVideos,
      totalAudios,
      totalSize: totalSize._sum.fileSize || 0,
      totalShortlinks,
      recentFiles,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
