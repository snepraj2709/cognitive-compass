import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT } from "@/lib/constants";
import { FeedbackService } from "@/services/FeedbackService";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import logger from "@/utils/logger";
import { enforceRateLimit, getRateLimitIdentifier } from "@/utils/request";
import { SubmitAnswerSchema } from "@/validations/game.schemas";

const encoder = new TextEncoder();

export const maxDuration = 30;

function getSessionId(params: Record<string, string | string[] | undefined> | undefined) {
  const raw = params?.sessionId;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  throw new APIError("INVALID_SESSION_ID", "Invalid session id", 400);
}

function writeSse(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event:${event}\ndata:${JSON.stringify(data)}\n\n`));
}

type SubmitRouteContext = {
  params: Record<string, string | string[] | undefined>;
};

export async function POST(request: NextRequest, context: SubmitRouteContext): Promise<NextResponse> {
  return withErrorHandler(request, async () => {
    await enforceRateLimit(getRateLimitIdentifier(request), RATE_LIMIT.SUBMIT_PER_MINUTE);

    const sessionId = getSessionId(context.params);
    const payload = SubmitAnswerSchema.parse(await request.json());
    const profile = await SessionService.getProfileById(payload.profileId);

    if (!profile) {
      throw new APIError("PROFILE_NOT_FOUND", "Profile not found", 404);
    }

    const submitResult = await SessionService.submitAnswer(
      sessionId,
      payload.profileId,
      payload.selections,
      {
        clueUsed: payload.clueUsed,
        timeTakenMs: payload.timeTakenMs,
      }
    );

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let feedbackText = "";
        let updatedSession = await SessionService.getSession(sessionId);
        let nextProfile = updatedSession ? await SessionService.getCurrentProfile(updatedSession) : null;

        try {
          writeSse(controller, "score", {
            total: submitResult.scoreBreakdown.total,
            breakdown: {
              DR: submitResult.scoreBreakdown.DR,
              SE: submitResult.scoreBreakdown.SE,
              SR: submitResult.scoreBreakdown.SR,
              CV: submitResult.scoreBreakdown.CV,
            },
          });

          for await (const chunk of FeedbackService.generateFeedbackStream(
            profile,
            payload.selections,
            submitResult.scoreBreakdown
          )) {
            feedbackText += chunk;
            writeSse(controller, "feedback_chunk", { chunk });
          }

          await SessionService.saveAttemptFeedback(sessionId, payload.profileId, feedbackText);
          updatedSession = await SessionService.getSession(sessionId);
          nextProfile = updatedSession ? await SessionService.getCurrentProfile(updatedSession) : null;

          if (submitResult.isLastProfile) {
            writeSse(controller, "session_complete", {
              profileIndex: updatedSession?.currentIndex ?? 0,
            });
          } else {
            writeSse(controller, "next_profile", {
              profileIndex: updatedSession?.currentIndex ?? 0,
              profile: nextProfile ? SessionService.toPublicProfile(nextProfile) : null,
            });
          }

          writeSse(controller, "done", { ok: true });
        } catch (error) {
          logger.warn({ err: error }, "Submit streaming failed; using fallback response");

          const fallback = FeedbackService.generateFeedbackFallback(
            submitResult.scoreBreakdown,
            {
              DR: profile.answerDR,
              SE: profile.answerSE,
              SR: profile.answerSR,
              CV: profile.answerCV,
            },
            payload.selections
          );

          writeSse(controller, "feedback_chunk", { chunk: fallback });
          await SessionService.saveAttemptFeedback(sessionId, payload.profileId, fallback);
          updatedSession = await SessionService.getSession(sessionId);
          nextProfile = updatedSession ? await SessionService.getCurrentProfile(updatedSession) : null;

          if (submitResult.isLastProfile) {
            writeSse(controller, "session_complete", {
              profileIndex: updatedSession?.currentIndex ?? 0,
            });
          } else {
            writeSse(controller, "next_profile", {
              profileIndex: updatedSession?.currentIndex ?? 0,
              profile: nextProfile ? SessionService.toPublicProfile(nextProfile) : null,
            });
          }

          writeSse(controller, "done", { ok: true, fallback: true });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  });
}
