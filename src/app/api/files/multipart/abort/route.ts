import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';

/**
 * POST /api/files/multipart/abort
 * 取消分片上传
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json(
        { error: '缺少 uploadId' },
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

    // 如果已完成,不能取消
    if (upload.status === 'completed') {
      return NextResponse.json(
        { error: '上传已完成,无法取消' },
        { status: 400 }
      );
    }

    // 获取 MinIO 配置
    const minioConfig = await getUserMinioConfig(user.id);
    if (minioConfig) {
      try {
        // 连接 MinIO
        const minioService = new MinioService();
        await minioService.connect(minioConfig);

        // 取消 MinIO 分片上传
        await minioService.abortMultipartUpload(
          upload.bucket,
          upload.objectKey,
          uploadId
        );
      } catch (minioError) {
        console.error('MinIO abort error:', minioError);
        // 即使 MinIO 取消失败,也继续更新数据库状态
      }
    }

    // 更新上传状态
    await prisma.multipartUpload.update({
      where: { id: upload.id },
      data: { status: 'aborted' },
    });

    return NextResponse.json({
      success: true,
      message: '上传已取消',
    });
  } catch (err) {
    console.error('Abort multipart upload error:', err);
    return NextResponse.json(
      { error: '取消上传失败', details: String(err) },
      { status: 500 }
    );
  }
}
