import { pinyin } from 'pinyin-pro';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

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

/**
 * Generate a thumbnail from a video buffer using ffmpeg
 */
export async function generateVideoThumbnail(
  videoBuffer: Buffer,
  maxWidth: number = 400
): Promise<Buffer | null> {
  // Use a temporary file for FFmpeg to handle seeking better (especially for MP4/MOV)
  const tempId = crypto.randomBytes(16).toString('hex');
  const tempInputPath = path.join(os.tmpdir(), `minpic_input_${tempId}`);
  const tempOutputPath = path.join(os.tmpdir(), `minpic_output_${tempId}.webp`);

  return new Promise((resolve) => {
    try {
      // Write buffer to temp file
      fs.writeFileSync(tempInputPath, videoBuffer);

      ffmpeg(tempInputPath)
        .seekInput(0.1) // Seek to 0.1s
        .frames(1)
        .size(`${maxWidth}x?`) // Scale with aspect ratio
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          cleanup();
          resolve(null);
        })
        .on('end', async () => {
          try {
            if (fs.existsSync(tempOutputPath)) {
              const finalThumb = fs.readFileSync(tempOutputPath);
              cleanup();
              resolve(finalThumb);
            } else {
              cleanup();
              resolve(null);
            }
          } catch (e) {
            console.error('Error reading video frame:', e);
            cleanup();
            resolve(null);
          }
        })
        .save(tempOutputPath);
      
      const cleanup = () => {
        try {
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        } catch (e) {
          console.error('Cleanup failed:', e);
        }
      };
    } catch (error) {
      console.error('Error initiating video thumbnail generation:', error);
      resolve(null);
    }
  });
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

/**
 * 为字符串生成拼音索引（全拼 + 首字母）
 */
export function generatePinyin(text: string): string {
  if (!text) return '';
  // 移除文件扩展名（如果是文件名）
  const name = text.includes('.') ? text.split('.').slice(0, -1).join('.') : text;
  
  try {
    const full = pinyin(name, { toneType: 'none', separator: '' });
    const first = pinyin(name, { pattern: 'initial', toneType: 'none', separator: '' });
    return `${full} ${first}`.toLowerCase();
  } catch (e) {
    console.error('Pinyin generation failed:', e);
    return '';
  }
}
