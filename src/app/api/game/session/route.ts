import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RATE_LIMIT_REQUESTS_PER_MINUTE } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import { getClientIp, enforceRateLimit } from "@/utils/request";
import { NewSessionSchema } from "@/validations/game.schemas";

async function parseCreateSessionPayload(request: NextRequest) {
  try {
    const payload = await request.json();
    return NewSessionSchema.parse(payload);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NewSessionSchema.parse({});
    }

    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withErrorHandler(request, async () => {
    const session = await auth();
    const userId = session?.user?.id;

    await parseCreateSessionPayload(request);
    const rateIdentifier = userId ?? getClientIp(request);

    await enforceRateLimit(rateIdentifier, RATE_LIMIT_REQUESTS_PER_MINUTE);

    const created = await SessionService.createSession(userId);

    if (!created.currentProfile) {
      throw new APIError("SESSION_PROFILE_MISSING", "Session created without a current profile", 500);
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
}
