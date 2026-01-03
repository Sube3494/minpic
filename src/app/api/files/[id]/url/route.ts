/*
 * @Date: 2025-12-27 23:57:03
 * @Author: Sube
 * @FilePath: route.ts
 * @LastEditTime: 2025-12-30 17:58:36
 * @Description: 
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { MinioService } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    
    // 获取文件信息
    const file = await prisma.file.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        minioPath: true,
        configId: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 验证所有权
    if (file.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 获取 MinIO 配置
    const config = await getUserMinioConfig(user.id, file.configId);

    if (!config) {
      return NextResponse.json(
        { error: 'MinIO configuration not found' },
        { status: 404 }
      );
    }

    // 使用 MinioService 构建链接，它能正确处理自定义域名和协议
    const minioService = new MinioService();
    await minioService.connect(config);
    const url = await minioService.getFileUrl(file.minioPath);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[URL API] Error getting file URL:', error);
    return NextResponse.json(
      { error: 'Failed to get file URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
