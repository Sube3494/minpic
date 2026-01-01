import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/auth/signin');
  }

  return <SettingsClient />;
}
