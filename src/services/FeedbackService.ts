import type { Profile } from "@prisma/client";
import { ANTHROPIC_MODEL } from "@/lib/constants";
import type { DimSelections, DimensionKey } from "@/lib/constants";
import { anthropic } from "@/lib/anthropic";
import logger from "@/utils/logger";
import type { ScoreBreakdown } from "@/utils/scoring";

const SYSTEM_PROMPT =
  "You are CogOS, a sharp cognitive profiling system. Write feedback that feels like a smart mentor reviewing a student's work. Use second person (you/your). Be concise — 80-100 words maximum total. Be specific — reference exact phrases from the scenario. Never be generic.";

const RETRY_DELAYS_MS = [1_000, 2_000] as const;
const DIMENSIONS: DimensionKey[] = ["DR", "SE", "SR", "CV"];

const DIMENSION_CONTRASTS: Record<DimensionKey, string> = {
  CV: "CV contrast: somatic language ('feel', 'sense', 'gut', 'instinct') suggests Intuition, 'pattern finally clicked' suggests Clarity, and external pressure suggests Deadline.",
  DR: "DR contrast: count explicit causal steps ('because', 'therefore'); Meta reasoning describes rules used to make rules.",
  SE: "SE contrast: Single stops at one path; Divergent generates genuinely new paths outside the original problem frame.",
  SR: "SR contrast: Rare appears only during crisis, Selective is trigger-based, Regular is scheduled, Constant happens in real time mid-decision.",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function selectionValue(value: string | null): string {
  return value ?? "unknown";
}

function isDimensionCorrect(scoreBreakdown: ScoreBreakdown, dimension: DimensionKey): boolean {
  return scoreBreakdown[dimension];
}

function buildPrompt(profile: Profile, selections: DimSelections, scoreBreakdown: ScoreBreakdown): string {
  const correctProfile: DimSelections = {
    DR: profile.answerDR,
    SE: profile.answerSE,
    SR: profile.answerSR,
    CV: profile.answerCV,
  };

  const wrongDimensions = DIMENSIONS.filter((dimension) => !isDimensionCorrect(scoreBreakdown, dimension));

  const wrongDimensionInstructions =
    wrongDimensions.length === 0
      ? [
          "Perfect score behavior:",
          "- Reinforce what exact signals clinched DR, SE, SR, and CV.",
          "- Keep tone concise and confident.",
        ]
      : [
          "Wrong dimension instructions:",
          ...wrongDimensions.map((dimension) => {
            const selected = selectionValue(selections[dimension]);
            const correct = selectionValue(correctProfile[dimension]);
            return `- ${dimension}: selected=${selected}, correct=${correct}. Give the exact phrase they should have caught from the scenario and a one-line contrast between chosen vs correct.`;
          }),
        ];

  return [
    `Profile: ${profile.name}`,
    `Context: ${profile.context}`,
    "Scenario:",profile.scenario,
    `Correct answers: DR=${profile.answerDR}, SE=${profile.answerSE}, SR=${profile.answerSR}, CV=${profile.answerCV}`,
    `Player answers: DR=${selectionValue(selections.DR)}, SE=${selectionValue(selections.SE)}, SR=${selectionValue(selections.SR)}, CV=${selectionValue(selections.CV)}`,
    `Wrong dimensions: ${wrongDimensions.length > 0 ? wrongDimensions.join(", ") : "none"}`,
    "",
    ...wrongDimensionInstructions,
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
    profile: Profile,
    selections: DimSelections,
    scoreBreakdown: ScoreBreakdown
  ): AsyncIterable<string> {
    const correctProfile: DimSelections = {
      DR: profile.answerDR,
      SE: profile.answerSE,
      SR: profile.answerSR,
      CV: profile.answerCV,
    };

    if (!anthropic) {
      yield this.generateFeedbackFallback(scoreBreakdown, correctProfile, selections);
      return;
    }

    const prompt = buildPrompt(profile, selections, scoreBreakdown);

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const stream = anthropic.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
          max_tokens: 256,
          system: SYSTEM_PROMPT,
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
          if (finalText.trim().length === 0) {
            throw new Error("Anthropic stream produced no text");
          }
          yield finalText;
        }

        return;
      } catch (error) {
        logger.warn({ err: error, attempt }, "Feedback streaming failed");

        const retryDelay = RETRY_DELAYS_MS[attempt];
        if (retryDelay !== undefined) {
          await delay(retryDelay);
          continue;
        }

        yield this.generateFeedbackFallback(scoreBreakdown, correctProfile, selections);
        return;
      }
    }
  }

  static generateFeedbackFallback(
    scoreBreakdown: ScoreBreakdown,
    correctProfile: DimSelections,
    selections: DimSelections
  ): string {
    if (scoreBreakdown.total === 4) {
      return "You scored 4/4. You read the cues accurately across DR, SE, SR, and CV. Keep anchoring your choices to exact scenario language and continue distinguishing trigger words from general tone.";
    }

    const lines: string[] = [`You scored ${scoreBreakdown.total}/4.`];

    for (const dimension of DIMENSIONS) {
      if (isDimensionCorrect(scoreBreakdown, dimension)) {
        lines.push(`${dimension} was correct.`);
        continue;
      }

      lines.push(
        `${dimension} was off: you chose ${selectionValue(selections[dimension])}, correct is ${selectionValue(correctProfile[dimension])}. ${DIMENSION_CONTRASTS[dimension]}`
      );
    }

    return lines.join(" ");
  }
}
