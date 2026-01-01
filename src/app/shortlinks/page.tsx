import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ShortlinksClient } from './ShortlinksClient';

export default async function ShortlinksPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/auth/signin');
  }

  return <ShortlinksClient />;
}
