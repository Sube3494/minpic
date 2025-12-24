import sharp from 'sharp';

const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function generateThumbnail(
  fileBuffer: Buffer,
  mimeType: string,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<Buffer | null> {
  try {
    // Only generate thumbnails for supported image formats
    if (!SUPPORTED_IMAGE_FORMATS.includes(mimeType)) {
      return null;
    }

    const thumbnail = await sharp(fileBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

export async function getImageDimensions(
  fileBuffer: Buffer
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(fileBuffer).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch {
    return null;
  }
}

export function getFileType(mimeType: string): 'image' | 'video' | 'audio' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}
