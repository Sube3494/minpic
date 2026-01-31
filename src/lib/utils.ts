/*
 * @Date: 2025-12-24 21:27:32
 * @Author: Sube
 * @FilePath: utils.ts
 * @LastEditTime: 2026-01-31 22:31:32
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
  // 1. 优先尝试 Cloudflare 特有的真实 IP 头
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // 2. 尝试标准 X-Forwarded-For (处理多级代理)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 真实的客户端 IP 通常是列表中的第一个
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp && firstIp !== '::1' && firstIp !== '127.0.0.1') {
      return firstIp;
    }
  }

  // 3. 尝试 X-Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp !== '::1' && realIp !== '127.0.0.1') {
    return realIp;
  }

  // 4. 最后兜底
  return '127.0.0.1';
}

/**
 * 递归序列化对象中的 BigInt 类型，将其转为字符串
 */
export function serializeBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return { __bigint: obj.toString() };
  }
  
  if (Buffer.isBuffer(obj)) {
    return { type: 'Buffer', data: Array.from(obj) };
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInt(item));
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        res[key] = serializeBigInt(record[key]);
      }
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

