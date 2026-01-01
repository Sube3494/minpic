import crypto from 'crypto';

/**
 * 配置加密/解密工具
 * 使用 AES-256-CBC 加密敏感配置数据
 */

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY;

// 验证加密密钥
if (!ENCRYPTION_KEY) {
  console.warn('⚠️  CONFIG_ENCRYPTION_KEY not set. Configuration encryption is disabled.');
}

if (ENCRYPTION_KEY && ENCRYPTION_KEY.length !== 32) {
  throw new Error('CONFIG_ENCRYPTION_KEY must be exactly 32 characters (256 bits)');
}

/**
 * 加密文本
 * @param text 要加密的明文
 * @returns 加密后的文本 (格式: iv:encryptedData)
 */
export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    // 如果没有设置加密密钥,返回原文(向后兼容)
    return text;
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // 返回格式: iv:encryptedData
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 解密文本
 * @param encryptedText 加密的文本 (格式: iv:encryptedData)
 * @returns 解密后的明文
 */
export function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    // 如果没有设置加密密钥,返回原文(向后兼容)
    return encryptedText;
  }

  // 检查是否是加密格式
  if (!encryptedText.includes(':')) {
    // 可能是未加密的旧数据,直接返回
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }

    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    // 如果解密失败,可能是未加密的数据,返回原文
    return encryptedText;
  }
}

/**
 * 加密 MinIO 配置中的敏感字段
 * @param config MinIO 配置对象
 * @returns 加密后的配置对象
 */
export function encryptMinioConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!ENCRYPTION_KEY) {
    return config;
  }

  const encryptedConfig = { ...config };
  
  // 加密敏感字段
  if (typeof config.accessKey === 'string') {
    encryptedConfig.accessKey = encrypt(config.accessKey);
  }
  if (typeof config.secretKey === 'string') {
    encryptedConfig.secretKey = encrypt(config.secretKey);
  }
  
  return encryptedConfig;
}

/**
 * 解密 MinIO 配置中的敏感字段
 * @param config 加密的 MinIO 配置对象
 * @returns 解密后的配置对象
 */
export function decryptMinioConfig(config: Record<string, unknown>): unknown {
  if (!ENCRYPTION_KEY) {
    return config;
  }

  const decryptedConfig = { ...config };
  
  // 解密敏感字段
  if (typeof config.accessKey === 'string') {
    decryptedConfig.accessKey = decrypt(config.accessKey);
  }
  if (typeof config.secretKey === 'string') {
    decryptedConfig.secretKey = decrypt(config.secretKey);
  }
  
  return decryptedConfig;
}

/**
 * 检查文本是否已加密
 * @param text 要检查的文本
 * @returns 是否已加密
 */
export function isEncrypted(text: string): boolean {
  // 简单检查:加密格式为 hex:hex
  return /^[0-9a-f]+:[0-9a-f]+$/i.test(text);
}
