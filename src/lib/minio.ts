import * as Minio from 'minio';
import { MinioConfigItem } from '@/types/config';

// 为 MinIO 服务使用的配置类型（继承自 MinioConfigItem）
export type MinioConfig = MinioConfigItem;


export class MinioService {
  private client: Minio.Client | null = null;
  private config: MinioConfig | null = null;

  async connect(config: MinioConfig): Promise<void> {
    this.config = config;
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
    mimeType: string
  ): Promise<{ objectName: string; expiresAt: string | null }> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    let objectPath = '';
    
    // Handle baseDir
    if (this.config.baseDir) {
        objectPath += `${this.config.baseDir}/`;
    }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.message === 'FILE_EXISTS') {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream.on('data', (obj: any) => files.push(obj));
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });
  }

  async testConnection(): Promise<{ success: boolean; duration?: number; error?: string }> {
    if (!this.client || !this.config) {
      return { success: false, error: 'MinIO 客户端未初始化' };
    }

    const startTime = Date.now();
    try {
      const bucketExists = await this.client.bucketExists(this.config.bucket);
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
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        return { 
          success: false, 
          duration,
          error: `无法连接到 MinIO 服务器 "${this.config.endpoint}"，请检查 Endpoint 地址是否正确`
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
          error: `连接被拒绝，请检查 MinIO 服务是否运行在 ${this.config.endpoint}:${this.config.port}`
        };
      } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        return { 
          success: false, 
          duration,
          error: '连接超时，请检查网络连接或 MinIO 服务器状态'
        };
      } else if (errorMessage.includes('ECONNRESET')) {
        return { 
          success: false, 
          duration,
          error: '连接被重置，请检查网络连接或防火墙设置'
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
          error: `连接失败: ${errorMessage}`
        };
      }
    }
  }

  getClient(): Minio.Client | null {
    return this.client;
  }
}

let minioService: MinioService | null = null;

export function getMinioService(): MinioService {
  if (!minioService) {
    minioService = new MinioService();
  }
  return minioService;
}
