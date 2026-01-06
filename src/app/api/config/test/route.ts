import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { MinioService } from '@/lib/minio';
import { ShortlinkService } from '@/lib/shortlink';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/rate-limit-response';

export async function POST(request: NextRequest) {
  // Rate limiting: 10 tests per minute
  const rateLimit = await checkRateLimit(request, { limit: 10, windowMs: 60000 });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetTime);
  }

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { type } = body; // 'minio' or 'shortlink'

    if (type === 'minio') {
      const { endpoint, port, useSSL, accessKey, secretKey, bucket, region } = body;
      const minioService = new MinioService();
      
      await minioService.connect({
        id: 'test',
        endpoint,
        port: port || 9000,
        useSSL: useSSL === true, // 明确转换为布尔值
        accessKey,
        secretKey,
        bucket,
        region,
      });

      const result = await minioService.testConnection();
      
      return NextResponse.json(result);
    } else if (type === 'shortlink') {
      const { apiUrl, apiKey } = body;
      const shortlinkService = new ShortlinkService();
      
      shortlinkService.setConfig({ apiUrl, apiKey });
      const result = await shortlinkService.testConnection();
      
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      { error: 'Connection test failed', message: String(error) },
      { status: 500 }
    );
  }
}
