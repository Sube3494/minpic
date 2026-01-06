import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FilesClient } from './FilesClient';

export default async function FilesPage() {
  const session = await auth();
  
  if (!session) {
    const callbackUrl = encodeURIComponent('/files');
    redirect(`/auth/signin?callbackUrl=${callbackUrl}`);
  }

  return <FilesClient />;
}
