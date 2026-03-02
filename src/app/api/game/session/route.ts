import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RATE_LIMIT } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import { getClientIp, enforceRateLimit } from "@/utils/request";
import { CreateSessionSchema } from "@/validations/game.schemas";

async function parseCreateSessionPayload(request: NextRequest) {
  try {
    const payload = await request.json();
    return CreateSessionSchema.parse(payload);
  } catch {
    return CreateSessionSchema.parse({});
  }
}

export const POST = withErrorHandler(async (request) => {
  const session = await auth();
  const userId = session?.user?.id;

  const payload = await parseCreateSessionPayload(request);
  const rateIdentifier = userId ?? payload.guestToken ?? getClientIp(request);

  await enforceRateLimit(rateIdentifier, RATE_LIMIT.CREATE_SESSION_PER_MINUTE);

  const created = await SessionService.createSession(userId, payload.guestToken);

  if (!created.currentProfile) {
    throw new APIError(500, "SESSION_PROFILE_MISSING", "Session created without a current profile");
  }

  return NextResponse.json({
    sessionId: created.sessionId,
    guestToken: created.guestToken,
    currentProfile: created.currentProfile,
    totalProfiles: created.totalProfiles,
    profileIndex: created.profileIndex,
    completedScores: created.completedScores,
  });
});
