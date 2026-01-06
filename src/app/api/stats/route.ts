import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';

export async function GET() {
  try {
    // 使用 groupBy 聚合统计文件类型,减少数据库往返
    const [fileTypeStats, totalSize, recentFiles] = await Promise.all([
      // 按文件类型分组统计 (替代 4 个独立的 count 查询)
      prisma.file.groupBy({
        by: ['fileType'],
        _count: true,
      }),
      // 总存储大小
      prisma.file.aggregate({
        _sum: { fileSize: true },
      }),
      // 最近文件,排除 thumbnailData 大字段
      prisma.file.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          filename: true,
          minioPath: true,
          fileSize: true,
          mimeType: true,
          fileType: true,
          thumbnailPath: true,
          width: true,
          height: true,
          configId: true,
          createdAt: true,
        },
      }),
    ]);

    // 从 groupBy 结果中提取各类型计数
    let totalFiles = 0;
    let totalImages = 0;
    let totalVideos = 0;
    let totalAudios = 0;

    fileTypeStats.forEach((stat) => {
      totalFiles += stat._count;
      if (stat.fileType === 'image') totalImages = stat._count;
      else if (stat.fileType === 'video') totalVideos = stat._count;
      else if (stat.fileType === 'audio') totalAudios = stat._count;
    });

    return NextResponse.json(serializeBigInt({
      totalFiles,
      totalImages,
      totalVideos,
      totalAudios,
      totalSize: totalSize._sum.fileSize || 0,
      recentFiles,
    }));
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
