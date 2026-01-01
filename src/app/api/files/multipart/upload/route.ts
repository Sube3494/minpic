import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';

/**
 * POST /api/files/multipart/upload
 * 上传单个分片
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId') as string;
    const partNumber = parseInt(formData.get('partNumber') as string);
    const chunk = formData.get('chunk') as Blob;

    if (!uploadId || !partNumber || !chunk) {
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

    // 将 Blob 转换为 Buffer
    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传分片
    const result = await minioService.uploadPart(
      upload.bucket,
      upload.objectKey,
      uploadId,
      partNumber,
      buffer
    );

    // 解析 parts 字符串
    const parts = JSON.parse(upload.parts) as Array<{ partNumber: number; etag: string }>;
    
    // 检查是否已存在该分片
    const existingPartIndex = parts.findIndex(p => p.partNumber === partNumber);
    if (existingPartIndex >= 0) {
      // 更新已存在的分片
      parts[existingPartIndex] = { partNumber, etag: result.etag };
    } else {
      // 添加新分片
      parts.push({ partNumber, etag: result.etag });
    }

    await prisma.multipartUpload.update({
      where: { id: upload.id },
      data: { parts: JSON.stringify(parts) },
    });

    return NextResponse.json({
      partNumber,
      etag: result.etag,
      uploadedParts: parts.length,
    });
  } catch (err) {
    console.error('Upload part error:', err);
    return NextResponse.json(
      { error: '上传分片失败', details: String(err) },
      { status: 500 }
    );
  }
}
