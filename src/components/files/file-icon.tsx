import { ImageIcon, Video, Music, File } from 'lucide-react';

export function FileIcon({ fileType, className }: { fileType: string, className?: string }) {
  switch (fileType) {
    case 'image': return <ImageIcon className={className} />;
    case 'video': return <Video className={className} />;
    case 'audio': return <Music className={className} />;
    default: return <File className={className} />;
  }
}
