import { ShareViewClient } from './ShareViewClient';

export default async function FileViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShareViewClient id={id} />;
}
