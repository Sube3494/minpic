/**
 * 统一缓存接口
 * 支持内存缓存和 Redis 缓存
 */

import type Redis from 'ioredis';

export interface CacheAdapter {
  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值,不存在或过期返回 null
   */
  get(key: string): Promise<string | null>;

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttlSeconds 过期时间(秒)
   */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;

  /**
   * 删除缓存
   * @param key 缓存键
   */
  del(key: string): Promise<void>;

  /**
   * 删除匹配模式的所有缓存
   * @param pattern 匹配模式,如 "user:*"
   */
  delPattern(pattern: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;
}

/**
 * 内存缓存适配器
 * 用于开发环境或单机部署
 */
class MemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, { value: string; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    // 简单的模式匹配: "prefix:*" 匹配所有以 "prefix:" 开头的键
    const prefix = pattern.replace('*', '');
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 销毁缓存适配器
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

/**
 * Redis 缓存适配器
 * 用于生产环境或多实例部署
 */
class RedisCacheAdapter implements CacheAdapter {
  private client: Redis;

  constructor(redisUrl: string) {
    // 动态导入 ioredis
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RedisClient = require('ioredis');
    this.client = new RedisClient(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('📦 Redis connected');
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, value);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error('Redis delPattern error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
}

/**
 * 缓存管理器
 */
class CacheManager {
  private adapter: CacheAdapter;
  private enabled: boolean;

  constructor() {
    // 检查是否启用缓存
    this.enabled = process.env.ENABLE_CACHE !== 'false';

    // 根据环境变量选择适配器
    if (process.env.REDIS_URL) {
      try {
        this.adapter = new RedisCacheAdapter(process.env.REDIS_URL);
        console.log('📦 Using Redis Cache');
      } catch (error) {
        console.error('Failed to connect to Redis, falling back to Memory Cache:', error);
        this.adapter = new MemoryCacheAdapter();
        console.log('📦 Using Memory Cache (fallback)');
      }
    } else {
      this.adapter = new MemoryCacheAdapter();
      console.log('📦 Using Memory Cache');
    }

    if (!this.enabled) {
      console.log('📦 Cache is disabled');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const value = await this.adapter.get(key);
      if (!value) return null;

      // 使用 reviver 恢复 BigInt
      return JSON.parse(value, (_, val) => {
        if (typeof val === 'string' && val.startsWith('_bi:')) {
          return BigInt(val.slice(4));
        }
        return val;
      }) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.enabled) return;

    try {
      // 使用 replacer 处理 BigInt
      const serialized = JSON.stringify(value, (_, val) => 
        typeof val === 'bigint' ? `_bi:${val.toString()}` : val
      );
      await this.adapter.set(key, serialized, ttlSeconds);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.adapter.del(key);
    } catch (error) {
      console.error('Cache del error:', error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.adapter.delPattern(pattern);
    } catch (error) {
      console.error('Cache delPattern error:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.adapter.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

// 导出单例
export const cache = new CacheManager();

// 缓存键生成器
export const CacheKeys = {
  userQuota: (userId: string) => `quota:user:${userId}`,
  teamQuota: (teamId: string) => `quota:team:${teamId}`,
  team: (teamId: string) => `team:${teamId}`,
  userTeam: (userId: string) => `team:user:${userId}`,
  teamMembers: (teamId: string) => `team:${teamId}:members`,
} as const;

// 缓存 TTL 配置(秒)
export const CacheTTL = {
  QUOTA: 5 * 60, // 5 分钟
  TEAM: 10 * 60, // 10 分钟
  MEMBERS: 10 * 60, // 10 分钟
} as const;
