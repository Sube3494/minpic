import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedBackup {
  v: number;       // 版本号
  salt: string;    // hex
  iv: string;      // hex
  tag: string;     // hex
  data: string;    // hex (encrypted)
}

/**
 * 加密备份数据
 */
export async function encryptBackup(data: string, password: string): Promise<EncryptedBackup> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // 派生密钥
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    v: 1,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted
  };
}

/**
 * 解密备份数据
 */
export async function decryptBackup(encrypted: EncryptedBackup, password: string): Promise<string> {
  if (encrypted.v !== 1) {
    throw new Error('不支持的备份加密版本');
  }

  const salt = Buffer.from(encrypted.salt, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const data = Buffer.from(encrypted.data, 'hex');
  
  // 派生密钥 (必须与加密时一致)
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(data, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 检查数据是否为加密备份格式
 */
export function isEncryptedBackup(obj: unknown): obj is EncryptedBackup {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return o.v === 1 && typeof o.salt === 'string' && typeof o.iv === 'string' && typeof o.data === 'string' && typeof o.tag === 'string';
}
