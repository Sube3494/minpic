/*
 * @Date: 2025-12-24 21:27:32
 * @Author: Sube
 * @FilePath: utils.ts
 * @LastEditTime: 2026-01-02 19:13:57
 * @Description: 
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number | bigint) {
  const bytesNum = Number(bytes);
  if (bytesNum < 1024) return bytesNum + ' B';
  if (bytesNum < 1024 * 1024) return (bytesNum / 1024).toFixed(1) + ' KB';
  if (bytesNum < 1024 * 1024 * 1024) return (bytesNum / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytesNum / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}


export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.headers.get('x-real-ip') || '127.0.0.1');

  if (ip === '::1') {
    return '127.0.0.1';
  }
  
  return ip;
}

/**
 * 递归序列化对象中的 BigInt 类型，将其转为字符串
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeBigInt<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (typeof obj === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = {};
    for (const key in obj) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res[key] = serializeBigInt((obj as any)[key]);
    }
    return res;
  }
  
  return obj;
}

/**
 * 获取安全的头像 URL，如果是 Gravatar 则替换为国内镜像
 */
export function getSafeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Replace Gravatar with Cravatar mirror
  return url.replace(/https?:\/\/([^\/]+\.)?gravatar\.com\/avatar\//g, 'https://cravatar.cn/avatar/');
}

/**
 * 格式化相对时间（中文）
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return date.toLocaleDateString('zh-CN');
  } else if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}

