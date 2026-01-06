import * as Minio from 'minio';
import { Socket } from 'net';
import { MinioConfigItem } from '@/types/config';

// 为 MinIO 服务使用的配置类型（继承自 MinioConfigItem）
export type MinioConfig = MinioConfigItem;


export class MinioService {
  private client: Minio.Client | null = null;
  private config: MinioConfig | null = null;

  async connect(config: Omit<MinioConfig, 'name'>): Promise<void> {
    this.config = config as MinioConfig;
    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port ?? 9000, // 默认端口 9000
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region || undefined,
    });
  }

  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string,
    ownerId: string  // Use Prisma userId for robust path isolation
  ): Promise<{ objectName: string; expiresAt: string | null }> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    let objectPath = '';
    
    // Handle baseDir
    if (this.config.baseDir) {
        objectPath += `${this.config.baseDir}/`;
    }

    // 用户隔离层：使用稳定的本地 ID (userId)
    // 保证了即使不绑定 GitHub 也有唯一隔离空间
    objectPath += `users/${ownerId}/`;

    // Handle archiveStrategy
    if (this.config.archiveStrategy && this.config.archiveStrategy !== 'none') {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        if (this.config.archiveStrategy === 'year') {
            objectPath += `${year}/`;
        } else if (this.config.archiveStrategy === 'month') {
            objectPath += `${year}/${month}/`;
        } else if (this.config.archiveStrategy === 'day') {
            objectPath += `${year}/${month}/${day}/`;
        }
    }

    // Clean filename - remove unsafe characters but keep Unicode (Chinese, etc.)
    // Only remove: / \ : * ? " < > |
    const cleanFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');
    
    // Handle duplicate files based on configuration
    const duplicateMode = this.config.duplicateHandling || 'keep-both';
    let objectName = '';
    
    if (duplicateMode === 'keep-both') {
      // Default: add timestamp to keep both files
      objectName = `${objectPath}${Date.now()}-${cleanFilename}`;
    } else if (duplicateMode === 'overwrite') {
      // Overwrite: use original filename
      objectName = `${objectPath}${cleanFilename}`;
    } else if (duplicateMode === 'skip') {
      // Skip: check if file exists first
      objectName = `${objectPath}${cleanFilename}`;
      
      try {
        await this.client.statObject(this.config.bucket, objectName);
        // File exists, skip upload by throwing error
        throw new Error('FILE_EXISTS');
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'FILE_EXISTS') {
          throw error;
        }
        // File doesn't exist (statObject threw 404), continue upload
      }
    }

    await this.client.putObject(
      this.config.bucket,
      objectName,
      file,
      file.length,
      {
        'Content-Type': mimeType,
      }
    );

    // Calculate expiration date
    let expiresAt: string | null = null;
    if (this.config.expirationDays && this.config.expirationDays > 0) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + this.config.expirationDays);
      expiresAt = expireDate.toISOString();
    }

    return { objectName, expiresAt };
  }

  async getFileUrl(objectName: string): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    // If custom domain is configured, construct standard URL
    if (this.config.customDomain) {
        // Remove trailing slash from customDomain if present
        const domain = this.config.customDomain.replace(/\/$/, '');
        // Construct standard MinIO/S3 path style URL: domain/bucket/object
        // Assuming customDomain is just the host (e.g. https://minio.example.com)
        // If user provided a CDN URL that maps to bucket, they should include bucket in customDomain or we adjust here.
        // For simplicity and standard MinIO behavior:
        return `${domain}/${this.config.bucket}/${objectName}`;
    }

    // Default to presigned URL for security
    return await this.client.presignedGetObject(
      this.config.bucket,
      objectName,
      24 * 60 * 60 // 24 hours
    );
  }

  async downloadFile(objectName: string): Promise<Buffer> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    const dataStream = await this.client.getObject(this.config.bucket, objectName);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      dataStream.on('data', (chunk) => chunks.push(chunk));
      dataStream.on('end', () => resolve(Buffer.concat(chunks)));
      dataStream.on('error', reject);
    });
  }

  async deleteFile(objectName: string): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    await this.client.removeObject(this.config.bucket, objectName);
  }

  async listFiles(prefix?: string): Promise<Minio.BucketItem[]> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    const stream = this.client.listObjects(this.config.bucket, prefix, true);
    const files: Minio.BucketItem[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (obj: Minio.BucketItem) => files.push(obj));
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });
  }



// ... (existing code)

  private checkTcpConnection(host: string, port: number, timeout = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      // Basic sanitization to remove protocol prefix if user entered it
      const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0];
      
      const socket = new Socket();
      let isHandled = false;

      const timer = setTimeout(() => {
         if (!isHandled) {
             isHandled = true;
             socket.destroy();
             reject(new Error(`TCP connection timed out after ${timeout}ms`));
         }
      }, timeout);

      socket.connect(port, cleanHost, () => {
         if (!isHandled) {
             isHandled = true;
             clearTimeout(timer);
             socket.destroy();
             resolve();
         }
      });

      socket.on('error', (err) => {
         if (!isHandled) {
             isHandled = true;
             clearTimeout(timer);
             reject(err);
         }
      });
    });
  }

  async testConnection(): Promise<{ success: boolean; duration?: number; error?: string }> {
    if (!this.client || !this.config) {
      return { success: false, error: 'MinIO 客户端未初始化' };
    }

    const startTime = Date.now();
    const TIMEOUT_MS = 10000; // 10 seconds timeout for the full operation

    try {
      // 1. First perform a quick TCP Connectivity check (3s timeout)
      // This fails fast if the IP/Port is wrong or firewall blocks it
      await this.checkTcpConnection(this.config.endpoint, this.config.port || 9000);

      // 2. If TCP connects, proceed with MinIO protocol check
      // Create a timeout promise for the MinIO operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timed out')), TIMEOUT_MS);
      });

      // Race between the actual request and the timeout
      const bucketExists = await Promise.race([
        this.client.bucketExists(this.config.bucket),
        timeoutPromise
      ]) as boolean;

      const duration = Date.now() - startTime;
      
      if (!bucketExists) {
        // Bucket doesn't exist - test failed
        return { 
          success: false, 
          duration,
          error: `存储桶 "${this.config.bucket}" 不存在，请先在 MinIO 后端创建该存储桶`
        };
      }
      
      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 区分不同类型的错误并翻译为中文
      if (errorMessage.includes('TCP connection timed out')) {
         return {
            success: false,
            duration,
            error: `连接服务器超时，无法连接到 ${this.config.endpoint}:${this.config.port || 9000}，请检查地址和端口是否正确`
         };
      }
      
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        return { 
          success: false, 
          duration,
          error: `无法解析主机名 "${this.config.endpoint}"，请检查域名输入是否正确`
        };
      } else if (
        errorMessage.includes('InvalidAccessKeyId') || 
        errorMessage.includes('Access Denied') ||
        errorMessage.includes('The Access Key Id you provided does not exist')
      ) {
        return { 
          success: false, 
          duration,
          error: 'Access Key 或 Secret Key 错误，请检查凭证是否正确'
        };
      } else if (errorMessage.includes('SignatureDoesNotMatch') || errorMessage.includes('signature')) {
        return { 
          success: false, 
          duration,
          error: '签名验证失败，请检查 Access Key 和 Secret Key 是否正确'
        };
      } else if (errorMessage.includes('ECONNREFUSED')) {
        return { 
          success: false, 
          duration,
          error: `连接被拒绝，目标端口 ${this.config.port || 9000} 未开放或服务未启动`
        };
      } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timout')) {
        return { 
          success: false, 
          duration,
          error: '连接超时，请检查网络连接或防火墙设置'
        };
      } else if (errorMessage.includes('Connection test timed out')) {
         return {
            success: false,
            duration,
            error: 'MinIO 服务响应超时 (10s)，虽然 TCP 连接成功但服务未响应 API 请求'
         };
      } else if (errorMessage.includes('ECONNRESET')) {
        return { 
          success: false, 
          duration,
          error: '连接被重置，请检查网络连接或防火墙设置'
        };
      } else if (errorMessage.includes('S3 API Requests must be made to API port')) {
        return { 
          success: false, 
          duration,
          error: 'API 端口配置错误'
        };
      } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
        return { 
          success: false, 
          duration,
          error: 'SSL 证书验证失败，请检查 useSSL 设置或证书配置'
        };
      } else {
        return { 
          success: false, 
          duration,
          error: errorMessage
        };
      }
    }
  }

  /**
   * 初始化分片上传
   */
  async initiateMultipartUpload(
    bucket: string,
    objectName: string,
    contentType: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    return await this.client.initiateNewMultipartUpload(
      bucket,
      objectName,
      { 'Content-Type': contentType }
    );
  }

  /**
   * 上传单个分片
   */
  async uploadPart(
    bucket: string,
    objectName: string,
    uploadId: string,
    partNumber: number,
    data: Buffer
  ): Promise<{ etag: string }> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    // 使用 MinIO SDK 的 uploadPart
    const result = await this.client.uploadPart({
      bucketName: bucket,
      objectName,
      uploadID: uploadId,
      partNumber,
      headers: {},
    }, data);

    return { etag: result.etag };
  }

  /**
   * 完成分片上传
   */
  async completeMultipartUpload(
    bucket: string,
    objectName: string,
    uploadId: string,
    parts: Array<{ part: number; etag: string }>
  ): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    // 按 part 排序
    const sortedParts = parts.sort((a, b) => a.part - b.part);

    await this.client.completeMultipartUpload(
      bucket,
      objectName,
      uploadId,
      sortedParts
    );
  }

  /**
   * 取消分片上传
   */
  async abortMultipartUpload(
    bucket: string,
    objectName: string,
    uploadId: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    await this.client.abortMultipartUpload(bucket, objectName, uploadId);
  }

  getClient(): Minio.Client | null {
    return this.client;
  }
}
