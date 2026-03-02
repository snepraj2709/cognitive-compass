import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { APIError, RATE_LIMIT_EXCEEDED } from "@/utils/apiError";
import { checkRateLimit } from "@/utils/rateLimiter";

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getChunkIndex(cookieName: string, baseName: string): number {
  if (cookieName === baseName) {
    return 0;
  }

  const suffix = cookieName.slice(baseName.length + 1);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function joinSessionCookieChunks(request: NextRequest, baseName: string): string | null {
  const chunks = request.cookies
    .getAll()
    .filter((cookie) => cookie.name === baseName || cookie.name.startsWith(`${baseName}.`))
    .sort((a, b) => getChunkIndex(a.name, baseName) - getChunkIndex(b.name, baseName));

  if (chunks.length === 0) {
    return null;
  }

  return chunks.map((chunk) => chunk.value).join("");
}

export function getAuthSessionToken(request: NextRequest): string | null {
  return (
    joinSessionCookieChunks(request, "__Secure-authjs.session-token") ??
    joinSessionCookieChunks(request, "authjs.session-token")
  );
}

export function getRateLimitIdentifier(request: NextRequest): string {
  const token = getAuthSessionToken(request);
  if (token) {
    const hashed = createHash("sha256").update(token).digest("hex");
    return `token:${hashed}`;
  }

  return `ip:${getClientIp(request)}`;
}

export async function enforceRateLimit(
  identifier: string,
  limitPerMinute: number
): Promise<void> {
  const result = await checkRateLimit(identifier, limitPerMinute);
  if (!result.allowed) {
    throw new APIError(RATE_LIMIT_EXCEEDED.code, "Too many requests", RATE_LIMIT_EXCEEDED.statusCode, {
      retryAfterMs: result.retryAfterMs,
    });
  }
}
