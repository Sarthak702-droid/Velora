import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Redis connection failed (running in degraded memory mode if needed): ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      this.logger.warn(`Redis set error for ${key}: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del error for ${key}: ${err.message}`);
    }
  }

  async acquireLock(resource: string, ttlMs = 10000): Promise<string | null> {
    try {
      const lockValue = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const result = await this.client.set(`lock:${resource}`, lockValue, 'PX', ttlMs, 'NX');
      return result === 'OK' ? lockValue : null;
    } catch {
      return null;
    }
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    try {
      const current = await this.client.get(`lock:${resource}`);
      if (current === lockValue) {
        await this.client.del(`lock:${resource}`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
