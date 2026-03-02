import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_REQUESTS_PER_MINUTE } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import { enforceRateLimit, getClientIp } from "@/utils/request";
import { CompleteSessionSchema } from "@/validations/game.schemas";

function getSessionId(params: Record<string, string | string[] | undefined> | undefined) {
  const raw = params?.sessionId;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  throw new APIError("INVALID_SESSION_ID", "Invalid session id", 400);
}

type CompleteRouteContext = {
  params: Record<string, string | string[] | undefined>;
};

async function parseCompleteSessionPayload(request: NextRequest) {
  try {
    const body = await request.json();
    return CompleteSessionSchema.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return CompleteSessionSchema.parse({});
    }

    throw error;
  }
}

export async function POST(
  request: NextRequest,
  context: CompleteRouteContext
): Promise<NextResponse> {
  return withErrorHandler(request, async () => {
    const sessionId = getSessionId(context.params);
    const rateIdentifier = `${sessionId}:${getClientIp(request)}`;

    await enforceRateLimit(rateIdentifier, RATE_LIMIT_REQUESTS_PER_MINUTE);
    await parseCompleteSessionPayload(request);

    const summary = await SessionService.completeSession(sessionId);
    return NextResponse.json(summary);
  });
}
