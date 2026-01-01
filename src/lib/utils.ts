/*
 * @Date: 2025-12-24 21:27:32
 * @Author: Sube
 * @FilePath: utils.ts
 * @LastEditTime: 2026-01-02 03:05:24
 * @Description: 
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
