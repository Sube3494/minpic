import { NextRequest, NextResponse } from 'next/server';
import { getMinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body; // 'minio' or 'shortlink'

    if (type === 'minio') {
      const { endpoint, port, useSSL, accessKey, secretKey, bucket, region } = body;
      const minioService = getMinioService();
      
      await minioService.connect({
        endpoint,
        port: port || 9000,
        useSSL: useSSL || false,
        accessKey,
        secretKey,
        bucket,
        region,
      });

      const isConnected = await minioService.testConnection();
      
      return NextResponse.json({ success: isConnected });
    } else if (type === 'shortlink') {
      const { apiUrl, apiKey } = body;
      const shortlinkService = getShortlinkService();
      
      shortlinkService.setConfig({ apiUrl, apiKey });
      const isConnected = await shortlinkService.testConnection();
      
      return NextResponse.json({ success: isConnected });
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
