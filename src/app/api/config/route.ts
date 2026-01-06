import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.systemSettings.findFirst();
    
    // Return only public settings
    return NextResponse.json({
      siteName: settings?.siteName || 'MinPic',
      siteDescription: settings?.siteDescription || '',
      registrationEnabled: settings?.registrationEnabled ?? true,
      githubLoginEnabled: settings?.githubLoginEnabled ?? true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}
