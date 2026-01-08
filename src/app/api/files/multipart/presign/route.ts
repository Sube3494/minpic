import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';

/**
 * POST /api/files/multipart/presign
 * 获取分片上传的预签名 URL
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { uploadId, partNumber } = body;

    if (!uploadId || !partNumber) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 查找上传记录
    const upload = await prisma.multipartUpload.findUnique({
      where: { uploadId },
    });

    if (!upload) {
      return NextResponse.json(
        { error: '上传记录不存在' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (upload.userId !== user.id) {
      return NextResponse.json(
        { error: '无权访问此上传' },
        { status: 403 }
      );
    }

    // 检查上传状态
    if (upload.status !== 'pending') {
      return NextResponse.json(
        { error: '上传已完成或已取消' },
        { status: 400 }
      );
    }

    // 获取 MinIO 配置
    const minioConfig = await getUserMinioConfig(user.id);
    if (!minioConfig) {
      return NextResponse.json(
        { error: '未配置存储服务' },
        { status: 400 }
      );
    }

    // 连接 MinIO
    const minioService = new MinioService();
    await minioService.connect(minioConfig);

    // 生成预签名 URL
    const url = await minioService.getPresignedPartUrl(
      upload.bucket,
      upload.objectKey,
      uploadId,
      parseInt(partNumber)
    );

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Get presigned url error:', err);
    return NextResponse.json(
      { error: '获取预签名 URL 失败', details: String(err) },
      { status: 500 }
    );
  }
}
