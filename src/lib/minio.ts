import * as Minio from 'minio';
import { Socket } from 'net';
import { MinioConfigItem } from '@/types/config';

// 为 MinIO 服务使用的配置类型（继承自 MinioConfigItem）
export type MinioConfig = MinioConfigItem;


export class MinioService {
  private client: Minio.Client | null = null;
  private config: MinioConfig | null = null;

  /**
   * 格式化 MinIO 错误信息为用户友好的中文提示
   */
  static formatError(error: unknown, endpoint?: string, port?: number): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const hostInfo = endpoint ? ` (${endpoint}:${port || 9000})` : '';
    
    // 区分不同类型的错误并翻译为中文
    if (errorMessage.includes('TCP connection timed out')) {
        return `连接服务器超时，无法连接到目标地址${hostInfo}，请检查地址和端口是否正确`;
    }
    
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        return `无法解析主机名${endpoint ? ` "${endpoint}"` : ''}，请检查域名输入是否正确或网络设置`;
    } else if (
      errorMessage.includes('InvalidAccessKeyId') || 
      errorMessage.includes('Access Denied') ||
      errorMessage.includes('The Access Key Id you provided does not exist')
    ) {
      return 'Access Key 或 Secret Key 错误，请检查凭证是否正确';
    } else if (errorMessage.includes('SignatureDoesNotMatch') || errorMessage.includes('signature')) {
      return '签名验证失败，请检查 Access Key 和 Secret Key 是否正确';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      return `连接被拒绝，目标端口${port ? ` ${port}` : ''} 未开放或服务未启动`;
    } else if (errorMessage.includes('EHOSTUNREACH')) {
      return `无法访问目标主机${hostInfo}，请检查网络连接或防火墙设置`;
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timout')) {
      return '连接超时，请检查网络连接或防火墙设置';
    } else if (errorMessage.includes('Connection test timed out')) {
       return 'MinIO 服务响应超时 (10s)，虽然 TCP 连接成功但服务未响应 API 请求';
    } else if (errorMessage.includes('ECONNRESET')) {
      return '连接被重置，请检查网络连接或防火墙设置';
    } else if (errorMessage.includes('S3 API Requests must be made to API port')) {
      return 'API 端口配置错误，请确保连接到正确的 S3 API 端口';
    } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
      return 'SSL 证书验证失败，请检查 useSSL 设置或证书配置';
    } else if (errorMessage.includes('FILE_EXISTS')) {
      return '文件已存在';
    }
    
    return errorMessage;
  }

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

  generateObjectKey(filename: string, ownerId: string): string {
    if (!this.config) {
      throw new Error('MinIO client not initialized');
    }

    let objectPath = '';
    
    // Handle baseDir
    if (this.config.baseDir) {
        objectPath += `${this.config.baseDir}/`;
    }

    // 用户隔离层
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

    // Clean filename
    const cleanFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');
    
    // Handle duplicate files logic (for path generation, we typically assume new unique name or caller handles checks)
    // For multipart/presigned flows, we usually want a unique name to avoid overwriting before completion.
    // However, to match uploadFile logic exactly:
    
    // Change default to 'keep-both' if not specified, but strictly respect 'overwrite' if set
    // The user wants strict adherence to config.
    const duplicateMode = this.config.duplicateHandling || 'keep-both';
    let objectName = '';
    
    // NOTE: For generateObjectKey we will adhere to the "keep-both" (timestamp) style by default 
    // or respect the mode. But 'skip' check cannot be done synchronously here without network.
    // For the purpose of the 'init' route which needs a key *before* uploading, 
    // we should safery prefer unique names.
    
    if (duplicateMode === 'keep-both') {
      objectName = `${objectPath}${Date.now()}-${cleanFilename}`;
    } else {
      // Default / Overwrite / Skip (fallback path for skip)
      // If config says 'overwrite', we obey and DO NOT append timestamp
      objectName = `${objectPath}${cleanFilename}`;
    }

    return objectName;
  }

  async validateOverwrite(objectName: string): Promise<void> {
    if (!this.client || !this.config) throw new Error('MinIO client not initialized');
    
    if (this.config.duplicateHandling === 'skip') {
        try {
           await this.client.statObject(this.config.bucket, objectName);
           // If we get here without error, file exists
           throw new Error('FILE_EXISTS');
        } catch (error: unknown) {
           const err = error as Error;
           if (err.message === 'FILE_EXISTS') throw error;
           // If error code is 'NotFound', we are good to go.
           // MinIO SDK specific error for not found might vary, usually it throws an object with code 'NotFound'
           if ((error as { code?: string }).code === 'NotFound') return;
           
           // If it's a different error, we might want to let it pass or throw?
           // For safety, if we can't confirm it doesn't exist, we probably shouldn't block unless we are sure it exists.
           // But 'statObject' failing usually means it doesn't exist or we can't see it.
        }
    }
  }

  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string,
    ownerId: string
  ): Promise<{ objectName: string; expiresAt: string | null }> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    // Use shared key generation logic, but we might need to handle 'skip' mode specifically
    // So we'll partially use it or duplicate the check logic.
    // Actually, to preserve the exact 'skip' logic (which requires a statObject check), 
    // we'll keep the logic here but reuse the path construction parts if possible.
    // For now, let's keep uploadFile mostly as is to avoid breaking 'skip', 
    // but update it to arguably use the helper if we can refactor safely. 
    // To be safe and quick, I will just add the helper method above for the 'init' route to use,
    // and ideally 'uploadFile' could use it too, but 'skip' mode requires async check.
    
    // Let's implement generateObjectKey mostly for the 'init' route usage first.
    return this.uploadFileInternal(file, filename, mimeType, ownerId);
  }

  // Internal implementation to allow refactoring without changing signature
  private async uploadFileInternal(
    file: Buffer,
    filename: string,
    mimeType: string,
    ownerId: string
  ): Promise<{ objectName: string; expiresAt: string | null }> {
     // Re-implement or call logic. 
     // To simplify this refactor: I will leave uploadFile alone and just add generateObjectKey 
     // that mimics the path construction part.
     
     // actually let's just paste the original body back but add generateObjectKey method separately
     // to avoid touching uploadFile too much in this chunk.
     
     // WAIT, I need to provide a complete replacement for the chunk I selected.
     
    let objectPath = '';
    
    // Use local config to satisfy TypeScript null checks
    const config = this.config;
    if (!config || !this.client) throw new Error('MinIO client not initialized');

    if (config.baseDir) objectPath += `${config.baseDir}/`;
    objectPath += `users/${ownerId}/`;

    if (config.archiveStrategy && config.archiveStrategy !== 'none') {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        if (config.archiveStrategy === 'year') {
            objectPath += `${year}/`;
        } else if (config.archiveStrategy === 'month') {
            objectPath += `${year}/${month}/`;
        } else if (config.archiveStrategy === 'day') {
            objectPath += `${year}/${month}/${day}/`;
        }
    }

    const cleanFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');
    const duplicateMode = config.duplicateHandling || 'keep-both';
    let objectName = '';
    
    if (duplicateMode === 'keep-both') {
      objectName = `${objectPath}${Date.now()}-${cleanFilename}`;
    } else if (duplicateMode === 'overwrite') {
      objectName = `${objectPath}${cleanFilename}`;
    } else if (duplicateMode === 'skip') {
      objectName = `${objectPath}${cleanFilename}`;
      try {
        await this.client.statObject(config.bucket, objectName);
        throw new Error('FILE_EXISTS');
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'FILE_EXISTS') throw error;
      }
    }

    await this.client.putObject(
      config.bucket,
      objectName,
      file,
      file.length,
      { 'Content-Type': mimeType }
    );

    let expiresAt: string | null = null;
    if (config.expirationDays && config.expirationDays > 0) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + config.expirationDays);
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

  async getPartialObject(objectName: string, offset: number, length: number): Promise<Buffer> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    const dataStream = await this.client.getPartialObject(
        this.config.bucket, 
        objectName, 
        offset, 
        length
    );
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
      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      return { 
        success: false, 
        duration,
        error: MinioService.formatError(error, this.config.endpoint, this.config.port)
      };
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

  /**
   * 生成分片上传的预签名 URL
   */
  async getPresignedPartUrl(
    bucket: string,
    objectName: string,
    uploadId: string,
    partNumber: number
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    const queryParams = {
        uploadId: uploadId,
        partNumber: partNumber.toString()
    };

    return await this.client.presignedUrl(
        'PUT',
        bucket,
        objectName,
        24 * 60 * 60, // 24 hours
        queryParams
    );
  }

  getClient(): Minio.Client | null {
    return this.client;
  }
}
