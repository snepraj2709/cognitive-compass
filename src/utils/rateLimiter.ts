import { randomUUID } from "crypto";
import { redis } from "@/lib/redis";
import logger from "@/utils/logger";

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

const localBuckets = new Map<string, number[]>();

function localSlidingWindow(identifier: string, limitPerMinute: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - 60_000;

  const existing = localBuckets.get(identifier) ?? [];
  const recent = existing.filter((ts) => ts > windowStart);
  recent.push(now);
  localBuckets.set(identifier, recent);

  const used = recent.length;
  const remaining = Math.max(0, limitPerMinute - used);

  return {
    allowed: used <= limitPerMinute,
    limit: limitPerMinute,
    remaining,
    resetAt: now + 60_000,
  };
}

export async function checkRateLimit(identifier: string, limitPerMinute: number): Promise<RateLimitResult> {
  if (!redis) {
    return localSlidingWindow(identifier, limitPerMinute);
  }

  const now = Date.now();
  const windowStart = now - 60_000;
  const key = `ratelimit:${identifier}`;

  try {
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, { score: now, member: `${now}:${randomUUID()}` });
    pipeline.zcount(key, windowStart, now);
    pipeline.expire(key, 120);

    const results = await pipeline.exec();
    const usedRaw = Array.isArray(results) ? results[2] : 0;
    const used = typeof usedRaw === "number" ? usedRaw : Number(usedRaw ?? 0);

    const remaining = Math.max(0, limitPerMinute - used);

    return {
      allowed: used <= limitPerMinute,
      limit: limitPerMinute,
      remaining,
      resetAt: now + 60_000,
    };
  } catch (error) {
    logger.warn({ err: error }, "Rate limiter fallback to local window");
    return localSlidingWindow(identifier, limitPerMinute);
  }
}
