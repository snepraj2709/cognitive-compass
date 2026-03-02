import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_REQUESTS_PER_MINUTE } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import {
  APIError,
  SESSION_EXPIRED,
  SESSION_NOT_FOUND,
  withErrorHandler,
} from "@/utils/apiError";
import { enforceRateLimit, getClientIp } from "@/utils/request";

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
    const rateIdentifier = `${sessionId}:${getClientIp(request)}`;

    await enforceRateLimit(rateIdentifier, RATE_LIMIT_REQUESTS_PER_MINUTE);

    const session = await SessionService.getSession(sessionId);

    if (!session) {
      throw new APIError(SESSION_NOT_FOUND.code, "Session not found", SESSION_NOT_FOUND.statusCode);
    }

    if (session.status === "EXPIRED") {
      throw new APIError(SESSION_EXPIRED.code, "Session has expired", SESSION_EXPIRED.statusCode);
    }

    return NextResponse.json(session);
  });
}
