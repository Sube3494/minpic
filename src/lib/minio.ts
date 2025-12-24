import * as Minio from 'minio';

export interface MinioConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  customDomain?: string;
  baseDir?: string;
  autoArchive?: boolean;
}

export class MinioService {
  private client: Minio.Client | null = null;
  private config: MinioConfig | null = null;

  async connect(config: MinioConfig): Promise<void> {
    this.config = config;
    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region || undefined,
    });

    // Test connection
    const bucketExists = await this.client.bucketExists(config.bucket);
    if (!bucketExists) {
      await this.client.makeBucket(config.bucket, config.region || 'us-east-1');
    }
  }

  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('MinIO client not initialized');
    }

    let objectPath = '';
    
    // Handle baseDir
    if (this.config.baseDir) {
        objectPath += `${this.config.baseDir}/`;
    }

    // Handle autoArchive
    if (this.config.autoArchive) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        objectPath += `${year}/${month}/`;
    }

    // Clean filename and timestamp
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${objectPath}${Date.now()}-${cleanFilename}`;

    await this.client.putObject(
      this.config.bucket,
      objectName,
      file,
      file.length,
      {
        'Content-Type': mimeType,
      }
    );

    return objectName;
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

  async testConnection(): Promise<boolean> {
    if (!this.client || !this.config) {
      return false;
    }

    try {
      await this.client.bucketExists(this.config.bucket);
      return true;
    } catch {
      return false;
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
