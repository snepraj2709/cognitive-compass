import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RATE_LIMIT } from "@/lib/constants";
import { SessionService } from "@/services/SessionService";
import { withErrorHandler } from "@/utils/apiError";
import logger from "@/utils/logger";
import { enforceRateLimit, getRateLimitIdentifier } from "@/utils/request";
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
    await enforceRateLimit(getRateLimitIdentifier(request), RATE_LIMIT.CREATE_SESSION_PER_MINUTE);

    await parseCreateSessionPayload(request);
    let userId: string | undefined;

    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch (error) {
      logger.warn({ err: error }, "Auth unavailable during session creation; continuing as guest");
    }

    const created = await SessionService.createSession(userId);
    const currentProfile = SessionService.toPublicProfile(created.firstProfile);

    return NextResponse.json({
      sessionId: created.session.id,
      guestToken: created.session.guestToken,
      currentProfile,
      totalProfiles: created.session.profileOrder.length,
      profileIndex: created.session.currentIndex,
      completedScores: [],
    });
  });
}
