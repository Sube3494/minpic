import { CollectionViewClient } from './CollectionViewClient';

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionViewClient id={id} />;
}
