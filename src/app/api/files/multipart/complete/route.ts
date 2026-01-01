import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { updateStorageUsage, updateFileCount } from '@/lib/team-quota';
import { serializeBigInt } from '@/lib/utils';

/**
 * POST /api/files/multipart/complete
 * 完成分片上传
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { uploadId, filename } = body;

    if (!uploadId || !filename) {
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
    if (upload.status === 'completed') {
      return NextResponse.json(
        { error: '上传已完成' },
        { status: 400 }
      );
    }

    if (upload.status === 'aborted') {
      return NextResponse.json(
        { error: '上传已取消' },
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

    // 解析 parts 字符串
    const partsData = JSON.parse(upload.parts) as Array<{ partNumber: number; etag: string }>;
    
    if (!partsData || partsData.length === 0) {
      return NextResponse.json(
        { error: '没有已上传的分片' },
        { status: 400 }
      );
    }

    // 完成 MinIO 分片上传 (将 partNumber 转换为 part)
    const minioParts = partsData.map(p => ({ part: p.partNumber, etag: p.etag }));
    await minioService.completeMultipartUpload(
      upload.bucket,
      upload.objectKey,
      uploadId,
      minioParts
    );

    // 获取文件 URL
    const url = await minioService.getFileUrl(upload.objectKey);

    // 创建文件记录
    const file = await prisma.file.create({
      data: {
        userId: user.id,
        filename: upload.filename,
        minioPath: upload.objectKey,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        fileType: upload.mimeType.split('/')[0] || 'other',
        configId: minioConfig.id,
      },
    });

    // 更新上传状态
    await prisma.multipartUpload.update({
      where: { id: upload.id },
      data: { status: 'completed' },
    });

    // 更新配额
    await updateStorageUsage(user.id, upload.fileSize);
    await updateFileCount(user.id, 1);

    return NextResponse.json(serializeBigInt({
      fileId: file.id,
      url,
      filename: file.filename,
      size: file.fileSize,
    }));
  } catch (err) {
    console.error('Complete multipart upload error:', err);
    return NextResponse.json(
      { error: '完成上传失败', details: String(err) },
      { status: 500 }
    );
  }
}
