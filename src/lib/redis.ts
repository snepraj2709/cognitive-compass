import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  redisClient = new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

export const redis = redisClient;

export async function setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(key, value, { ex: ttlSeconds });
}

export async function get(key: string): Promise<string | null> {
  if (!redis) {
    return null;
  }

  const value = await redis.get<string>(key);
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : String(value);
}

export async function del(key: string): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.del(key);
}

export async function incr(key: string): Promise<number> {
  if (!redis) {
    return 0;
  }

  const value = await redis.incr(key);
  return typeof value === "number" ? value : Number(value);
}

export async function expire(key: string, ttlSeconds: number): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.expire(key, ttlSeconds);
}
