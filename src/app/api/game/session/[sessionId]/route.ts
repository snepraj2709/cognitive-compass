import { NextResponse } from "next/server";
import { RATE_LIMIT } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import { enforceRateLimit, getClientIp } from "@/utils/request";

function getSessionId(params: Record<string, string | string[] | undefined> | undefined) {
  const raw = params?.sessionId;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  throw new APIError(400, "INVALID_SESSION_ID", "Invalid session id");
}

export const GET = withErrorHandler(async (request, context) => {
  const sessionId = getSessionId(context.params);
  const rateIdentifier = `${sessionId}:${getClientIp(request)}`;

  await enforceRateLimit(rateIdentifier, RATE_LIMIT.GET_SESSION_PER_MINUTE);

  const session = await SessionService.getSession(sessionId);

  if (!session) {
    throw new APIError(404, "SESSION_NOT_FOUND", "Session not found");
  }

  if (session.status === "EXPIRED") {
    throw new APIError(410, "SESSION_EXPIRED", "Session has expired");
  }

  return NextResponse.json(session);
});
