import { NextResponse } from "next/server";
import { RATE_LIMIT } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import { enforceRateLimit, getClientIp } from "@/utils/request";
import { CompleteSessionSchema } from "@/validations/game.schemas";

function getSessionId(params: Record<string, string | string[] | undefined> | undefined) {
  const raw = params?.sessionId;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  throw new APIError(400, "INVALID_SESSION_ID", "Invalid session id");
}

export const POST = withErrorHandler(async (request, context) => {
  const sessionId = getSessionId(context.params);
  const rateIdentifier = `${sessionId}:${getClientIp(request)}`;

  await enforceRateLimit(rateIdentifier, RATE_LIMIT.COMPLETE_PER_MINUTE);
  try {
    const body = await request.json();
    CompleteSessionSchema.parse(body);
  } catch {
    CompleteSessionSchema.parse({});
  }

  const summary = await SessionService.completeSession(sessionId);
  return NextResponse.json(summary);
});
