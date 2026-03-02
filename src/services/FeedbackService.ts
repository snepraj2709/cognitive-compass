import type { CVValue, DRValue, SEValue, SRValue } from "@/types/game";
import { ANTHROPIC_MODEL, DIMENSION_LABELS } from "@/lib/constants";
import { anthropic } from "@/lib/anthropic";
import { logger } from "@/utils/logger";

interface FeedbackProfile {
  name: string;
  context: string;
  scenario: string;
  clues: string[];
  answerDR: DRValue;
  answerSE: SEValue;
  answerSR: SRValue;
  answerCV: CVValue;
}

interface ScoreBreakdownInput {
  DR: boolean;
  SE: boolean;
  SR: boolean;
  CV: boolean;
  total: number;
}

interface SelectionBundle {
  DR: DRValue;
  SE: SEValue;
  SR: SRValue;
  CV: CVValue;
}

const RETRY_BACKOFF_MS = [1_000, 2_000] as const;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatSelections(prefix: string, selections: SelectionBundle) {
  return `${prefix}: DR=${selections.DR}, SE=${selections.SE}, SR=${selections.SR}, CV=${selections.CV}`;
}

function buildPrompt(
  profile: FeedbackProfile,
  selections: SelectionBundle,
  scoreBreakdown: ScoreBreakdownInput
): string {
  const correct: SelectionBundle = {
    DR: profile.answerDR,
    SE: profile.answerSE,
    SR: profile.answerSR,
    CV: profile.answerCV,
  };

  return [
    `Profile: ${profile.name}`,
    `Context: ${profile.context}`,
    `Scenario: ${profile.scenario}`,
    `Clues: ${profile.clues.join(" | ")}`,
    formatSelections("User selections", selections),
    formatSelections("Correct selections", correct),
    `Score: ${scoreBreakdown.total}/4`,
    `Dimension correctness: DR=${scoreBreakdown.DR}, SE=${scoreBreakdown.SE}, SR=${scoreBreakdown.SR}, CV=${scoreBreakdown.CV}`,
    "Write concise coaching feedback in 80-100 words.",
  ].join("\n");
}

function extractTextDelta(event: { type: string } & Record<string, unknown>): string | null {
  if (event.type !== "content_block_delta") {
    return null;
  }

  const delta = event.delta;
  if (!delta || typeof delta !== "object") {
    return null;
  }

  const typedDelta = delta as { type?: unknown; text?: unknown };
  if (typedDelta.type !== "text_delta" || typeof typedDelta.text !== "string") {
    return null;
  }

  return typedDelta.text;
}

export class FeedbackService {
  static async *generateFeedbackStream(
    profile: FeedbackProfile,
    selections: SelectionBundle,
    scoreBreakdown: ScoreBreakdownInput
  ): AsyncIterable<string> {
    const correct: SelectionBundle = {
      DR: profile.answerDR,
      SE: profile.answerSE,
      SR: profile.answerSR,
      CV: profile.answerCV,
    };

    if (!anthropic) {
      yield this.generateFeedbackFallback(scoreBreakdown, correct, selections);
      return;
    }

    const prompt = buildPrompt(profile, selections, scoreBreakdown);

    for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
      try {
        const stream = anthropic.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
          max_tokens: 220,
          system:
            "You are CogOS feedback coach. Be concise (80-100 words), use exact scenario phrases when possible, and contrast incorrect choices against correct dimensions clearly.",
          messages: [{ role: "user", content: prompt }],
        });

        let emitted = false;

        for await (const event of stream) {
          const textDelta = extractTextDelta(event as { type: string } & Record<string, unknown>);
          if (!textDelta) {
            continue;
          }

          emitted = true;
          yield textDelta;
        }

        if (!emitted) {
          const finalText = await stream.finalText();
          if (finalText.trim().length > 0) {
            yield finalText;
            return;
          }
          throw new Error("Anthropic stream produced no text output");
        }

        return;
      } catch (error) {
        logger.warn({ err: error, attempt }, "Feedback streaming failed");

        if (attempt < RETRY_BACKOFF_MS.length) {
          await delay(RETRY_BACKOFF_MS[attempt]);
          continue;
        }

        yield this.generateFeedbackFallback(scoreBreakdown, correct, selections);
        return;
      }
    }
  }

  static generateFeedbackFallback(
    scoreBreakdown: ScoreBreakdownInput,
    correct: SelectionBundle,
    selected: SelectionBundle
  ): string {
    const lines: string[] = [];

    lines.push(`You scored ${scoreBreakdown.total}/4.`);

    for (const dimension of ["DR", "SE", "SR", "CV"] as const) {
      const isCorrect = scoreBreakdown[dimension];
      if (isCorrect) {
        lines.push(`${DIMENSION_LABELS[dimension]} was correct.`);
      } else {
        lines.push(
          `${DIMENSION_LABELS[dimension]} was off: selected ${selected[dimension]}, correct ${correct[dimension]}.`
        );
      }
    }

    lines.push("Focus on clue wording that signals decision depth, exploration breadth, reflection cadence, and closure trigger.");

    return lines.join(" ");
  }
}
