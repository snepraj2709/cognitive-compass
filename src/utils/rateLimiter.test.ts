import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T10:15:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("enforces limit with local fallback when redis is unavailable", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: null,
      incr: vi.fn(),
      expire: vi.fn(),
    }));

    const { checkRateLimit } = await import("@/utils/rateLimiter");

    const first = await checkRateLimit("user-a", 2);
    const second = await checkRateLimit("user-a", 2);
    const third = await checkRateLimit("user-a", 2);

    expect(first).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(second).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBe(60_000);
  });

  it("resets allowance on minute rollover in local fallback", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: null,
      incr: vi.fn(),
      expire: vi.fn(),
    }));

    const { checkRateLimit } = await import("@/utils/rateLimiter");

    await checkRateLimit("user-b", 1);
    const blocked = await checkRateLimit("user-b", 1);
    expect(blocked.allowed).toBe(false);

    vi.setSystemTime(new Date("2026-03-02T10:16:01.000Z"));
    const afterRollover = await checkRateLimit("user-b", 1);
    expect(afterRollover).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("uses redis key pattern with INCR + EXPIRE", async () => {
    const incr = vi.fn().mockResolvedValue(1);
    const expire = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/lib/redis", () => ({
      redis: {},
      incr,
      expire,
    }));

    const { checkRateLimit } = await import("@/utils/rateLimiter");
    const result = await checkRateLimit("abc123", 5);

    expect(result).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(incr).toHaveBeenCalledWith("ratelimit:abc123:1772446500000");
    expect(expire).toHaveBeenCalledWith("ratelimit:abc123:1772446500000", 120);
  });

  it("returns retryAfterMs when redis count exceeds limit", async () => {
    const incr = vi.fn().mockResolvedValue(6);
    const expire = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/lib/redis", () => ({
      redis: {},
      incr,
      expire,
    }));

    const { checkRateLimit } = await import("@/utils/rateLimiter");
    vi.setSystemTime(new Date("2026-03-02T10:15:20.000Z"));
    const result = await checkRateLimit("throttle", 5);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(40_000);
  });
});
