import { expire, incr, redis } from "@/lib/redis";
import logger from "@/utils/logger";

interface LocalBucket {
  count: number;
  expiresAt: number;
}

const WINDOW_MS = 60_000;
const REDIS_TTL_SECONDS = 120;
const localBuckets = new Map<string, LocalBucket>();

function getCurrentMinuteTimestamp(now: number): number {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}

function computeRetryAfterMs(now: number): number {
  const currentMinute = getCurrentMinuteTimestamp(now);
  return Math.max(0, currentMinute + WINDOW_MS - now);
}

function purgeExpiredLocalBuckets(now: number) {
  for (const [key, bucket] of localBuckets.entries()) {
    if (bucket.expiresAt <= now) {
      localBuckets.delete(key);
    }
  }
}

function checkLocalRateLimit(identifier: string, limitPerMinute: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  purgeExpiredLocalBuckets(now);

  const minuteTimestamp = getCurrentMinuteTimestamp(now);
  const bucketKey = `${identifier}:${minuteTimestamp}`;
  const existing = localBuckets.get(bucketKey);

  const count = (existing?.count ?? 0) + 1;
  localBuckets.set(bucketKey, {
    count,
    expiresAt: minuteTimestamp + WINDOW_MS * 2,
  });

  if (count > limitPerMinute) {
    return {
      allowed: false,
      retryAfterMs: computeRetryAfterMs(now),
    };
  }

  return {
    allowed: true,
    retryAfterMs: 0,
  };
}

export async function checkRateLimit(
  identifier: string,
  limitPerMinute: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  if (!redis) {
    return checkLocalRateLimit(identifier, limitPerMinute);
  }

  const now = Date.now();
  const minuteTimestamp = getCurrentMinuteTimestamp(now);
  const key = `ratelimit:${identifier}:${minuteTimestamp}`;

  try {
    const count = await incr(key);
    if (count === 1) {
      await expire(key, REDIS_TTL_SECONDS);
    }

    if (count > limitPerMinute) {
      return {
        allowed: false,
        retryAfterMs: computeRetryAfterMs(now),
      };
    }

    return {
      allowed: true,
      retryAfterMs: 0,
    };
  } catch (error) {
    logger.warn({ err: error }, "Redis rate limit failed, using local fallback");
    return checkLocalRateLimit(identifier, limitPerMinute);
  }
}
