import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_REQUESTS_PER_MINUTE } from "@/lib/constants";
import { FeedbackService } from "@/services/FeedbackService";
import { SessionService } from "@/services/SessionService";
import { APIError, withErrorHandler } from "@/utils/apiError";
import logger from "@/utils/logger";
import { enforceRateLimit, getClientIp } from "@/utils/request";
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
    const sessionId = getSessionId(context.params);
    const rateIdentifier = `${sessionId}:${getClientIp(request)}`;
    await enforceRateLimit(rateIdentifier, RATE_LIMIT_REQUESTS_PER_MINUTE);

    const payload = SubmitAnswerSchema.parse(await request.json());

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

        try {
          writeSse(controller, "score", submitResult.score);

          for await (const chunk of FeedbackService.generateFeedbackStream(
            submitResult.profileForFeedback,
            submitResult.selected,
            {
              ...submitResult.score.breakdown,
              total: submitResult.score.total,
            }
          )) {
            feedbackText += chunk;
            writeSse(controller, "feedback_chunk", { chunk });
          }

          await SessionService.saveAttemptFeedback(sessionId, payload.profileId, feedbackText);

          if (submitResult.isSessionComplete) {
            writeSse(controller, "session_complete", {
              profileIndex: submitResult.nextIndex,
            });
          } else {
            writeSse(controller, "next_profile", {
              profileIndex: submitResult.nextIndex,
              profile: submitResult.nextProfile,
            });
          }

          writeSse(controller, "done", { ok: true });
        } catch (error) {
          logger.warn({ err: error }, "Submit streaming failed; using fallback response");

          const fallback = FeedbackService.generateFeedbackFallback(
            {
              ...submitResult.score.breakdown,
              total: submitResult.score.total,
            },
            submitResult.correct,
            submitResult.selected
          );

          writeSse(controller, "feedback_chunk", { chunk: fallback });
          await SessionService.saveAttemptFeedback(sessionId, payload.profileId, fallback);

          if (submitResult.isSessionComplete) {
            writeSse(controller, "session_complete", {
              profileIndex: submitResult.nextIndex,
            });
          } else {
            writeSse(controller, "next_profile", {
              profileIndex: submitResult.nextIndex,
              profile: submitResult.nextProfile,
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
