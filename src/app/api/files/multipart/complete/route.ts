import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService, MinioConfig } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { updateStorageUsage, updateFileCount } from '@/lib/team-quota';
import { serializeBigInt } from '@/lib/utils';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, generatePinyin } from '@/lib/image-utils';

/**
 * POST /api/files/multipart/complete
 * 完成分片上传
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  let minioConfig: MinioConfig | null = null;
  try {
    const body = await request.json();
    const { uploadId, filename, parts } = body;

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
    minioConfig = await getUserMinioConfig(user.id, upload.configId);
    if (!minioConfig) {
      return NextResponse.json(
        { error: '未配置存储服务' },
        { status: 400 }
      );
    }

    // 连接 MinIO
    const minioService = new MinioService();
    await minioService.connect(minioConfig);

    // 解析 parts
    // 优先使用请求体中的 parts (直传模式)
    // 如果请求体没有，则尝试从数据库读取 (兼容旧模式)
    let partsData: Array<{ partNumber: number; etag: string }> = [];
    
    if (parts && Array.isArray(parts)) {
      partsData = parts;
    } else {
      partsData = JSON.parse(upload.parts) as Array<{ partNumber: number; etag: string }>;
    }
    
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

    // 生成缩略图和元数据
    let thumbnailData: Buffer | null = null;
    let width: number | null = null;
    let height: number | null = null;
    const fileType = upload.mimeType.split('/')[0] || 'other';

    try {
        // 如果是图片或视频，需要下载文件头部或文件来生成缩略图
        // 优化：限制下载大小，避免大文件阻塞
        const MAX_PROCESS_SIZE = 100 * 1024 * 1024; // 100MB limit for full download
        const VIDEO_SAMPLE_SIZE = 5 * 1024 * 1024; // 5MB sample for video

        if (fileType === 'image') {
            // 图片需要完整文件才能生成缩略图(通常)
            // 如果太大，跳过缩略图生成以保证速度
            if (Number(upload.fileSize) <= MAX_PROCESS_SIZE) {
                const fileBuffer = await minioService.downloadFile(upload.objectKey);
                const dimensions = await getImageDimensions(fileBuffer);
                if (dimensions) {
                    width = dimensions.width;
                    height = dimensions.height;
                }
                thumbnailData = await generateThumbnail(fileBuffer, upload.mimeType);
            }
        } else if (fileType === 'video') {
            // 视频只需要头部一部分数据即可提取封面(通常)
            // 下载前 5MB
            const fileBuffer = await minioService.getPartialObject(
                upload.objectKey, 
                0, 
                Math.min(Number(upload.fileSize), VIDEO_SAMPLE_SIZE)
            );
            thumbnailData = await generateVideoThumbnail(fileBuffer);
        }
    } catch (e) {
        console.error('Failed to generate metadata/thumbnail:', e);
        // Continue even if thumbnail generation fails
    }

    // Calculate expiration date based on config
    let expiresAt: Date | null = null;
    if (minioConfig.expirationDays && minioConfig.expirationDays > 0) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + minioConfig.expirationDays);
      expiresAt = expireDate;
    }

    // 创建文件记录
    const file = await prisma.file.create({
      data: {
        userId: user.id,
        filename: upload.filename,
        minioPath: upload.objectKey,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        fileType: fileType,
        thumbnailData,
        thumbnailPath: thumbnailData ? 'database' : null,
        pinyin: generatePinyin(upload.filename),
        width,
        height,
        configId: minioConfig.id,
        expiresAt: expiresAt, // Correctly use the config-based expiration or null for permanent
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
    const friendlyError = MinioService.formatError(err, minioConfig?.endpoint, minioConfig?.port);
    return NextResponse.json(
      { error: friendlyError, details: String(err) },
      { status: 500 }
    );
  }
}
