import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const config = await prisma.config.findUnique({
      where: { key: 'shortlink_default' },
    });

    if (!config) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json(JSON.parse(config.value));
  } catch (error) {
    console.error('Error getting shortlink config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiUrl, apiKey, autoGenerate, expiresIn } = body;

    console.log('Shortlink config received:', { apiUrl, apiKey: apiKey ? '***' : 'empty', autoGenerate, expiresIn });

    if (!apiUrl || !apiKey) {
      console.error('Validation failed - apiUrl:', apiUrl, 'apiKey:', apiKey ? 'present' : 'missing');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const configValue = JSON.stringify({
      apiUrl,
      apiKey,
      autoGenerate: autoGenerate !== false, // Default to true
      expiresIn: expiresIn || 0, // Default to 0 (永久)
    });

    const config = await prisma.config.upsert({
      where: { key: 'shortlink_default' },
      update: { value: configValue },
      create: { key: 'shortlink_default', value: configValue },
    });

    return NextResponse.json({ success: true, config: JSON.parse(config.value) });
  } catch (error) {
    console.error('Error saving shortlink config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
