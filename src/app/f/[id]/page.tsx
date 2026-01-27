import { FileViewClient } from './FileViewClient';

export default async function FileViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FileViewClient id={id} />;
}
