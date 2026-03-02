import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import {
  APIError,
  SESSION_EXPIRED,
  SESSION_NOT_FOUND,
  withErrorHandler,
} from "@/utils/apiError";
import { enforceRateLimit, getRateLimitIdentifier } from "@/utils/request";

function getSessionId(params: Record<string, string | string[] | undefined> | undefined) {
  const raw = params?.sessionId;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  throw new APIError("INVALID_SESSION_ID", "Invalid session id", 400);
}

type SessionRouteContext = {
  params: Record<string, string | string[] | undefined>;
};

export async function GET(request: NextRequest, context: SessionRouteContext): Promise<NextResponse> {
  return withErrorHandler(request, async () => {
    const sessionId = getSessionId(context.params);
    await enforceRateLimit(getRateLimitIdentifier(request), RATE_LIMIT.GET_SESSION_PER_MINUTE);

    const session = await SessionService.getSession(sessionId);

    if (!session) {
      const isExpired = await SessionService.isSessionExpired(sessionId);
      if (isExpired) {
        throw new APIError(SESSION_EXPIRED.code, "Session has expired", SESSION_EXPIRED.statusCode);
      }
      throw new APIError(SESSION_NOT_FOUND.code, "Session not found", SESSION_NOT_FOUND.statusCode);
    }

    const state = await SessionService.toSessionStateResponse(session);
    return NextResponse.json(state);
  });
}
