import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;
  try {
    const config = await prisma.config.findUnique({
      where: {
        userId_key: {
          userId: user.id,
          key: 'shortlink_default'
        }
      },
    });

    if (!config) {
      // Return default disabled state instead of 404
      return NextResponse.json({
        apiUrl: '',
        apiKey: '',
        enabled: false,
        expiresIn: 0,
      });
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
  const { error, user } = await requireAuth();
  if (error) return error;
  try {
    const body = await request.json();
    const { apiUrl, apiKey, enabled, expiresIn } = body;



    const configValue = JSON.stringify({
      apiUrl: apiUrl || '',
      apiKey: apiKey || '',
      enabled: enabled !== false, // Default to true
      expiresIn: expiresIn || 0, // Default to 0 (永久)
    });

    const config = await prisma.config.upsert({
      where: {
        userId_key: {
          userId: user.id,
          key: 'shortlink_default'
        }
      },
      update: { value: configValue },
      create: {
        userId: user.id,
        key: 'shortlink_default',
        value: configValue
      },
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
