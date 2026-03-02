import { NextRequest } from "next/server";
import { APIError } from "@/utils/apiError";
import { checkRateLimit } from "@/utils/rateLimiter";

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function enforceRateLimit(
  identifier: string,
  limitPerMinute: number
): Promise<void> {
  const result = await checkRateLimit(identifier, limitPerMinute);
  if (!result.allowed) {
    throw new APIError(429, "RATE_LIMITED", "Too many requests", {
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
    });
  }
}
