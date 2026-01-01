import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { checkStorageQuota, checkFileQuota } from '@/lib/team-quota';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/files/multipart/init
 * 初始化分片上传
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { filename, fileSize, mimeType } = body;

    if (!filename || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查配额
    const storageCheck = await checkStorageQuota(user.id, fileSize);
    if (!storageCheck.allowed) {
      return NextResponse.json(
        { error: storageCheck.reason || '存储配额不足' },
        { status: 403 }
      );
    }

    const fileCheck = await checkFileQuota(user.id);
    if (!fileCheck.allowed) {
      return NextResponse.json(
        { error: fileCheck.reason || '文件配额不足' },
        { status: 403 }
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

    // 生成对象键
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = filename.split('.').pop();
    const objectKey = `${minioConfig.baseDir || 'uploads'}/${user.id}/${timestamp}-${randomStr}.${ext}`;

    // 初始化 MinIO Multipart Upload
    const uploadId = await minioService.initiateMultipartUpload(
      minioConfig.bucket,
      objectKey,
      mimeType
    );

    // 计算分片数量
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    // 创建数据库记录
    const upload = await prisma.multipartUpload.create({
      data: {
        uploadId,
        userId: user.id,
        filename,
        fileSize: BigInt(fileSize),
        mimeType,
        bucket: minioConfig.bucket,
        objectKey,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
      },
    });

    return NextResponse.json({
      id: upload.id,
      uploadId,
      chunkSize: CHUNK_SIZE,
      totalChunks,
    });
  } catch (err) {
    console.error('Init multipart upload error:', err);
    return NextResponse.json(
      { error: '初始化上传失败', details: String(err) },
      { status: 500 }
    );
  }
}
