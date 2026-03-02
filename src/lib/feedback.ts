import type { Profile, ScoreBreakdown, DimSelections, DimensionKey } from "@/types/game";
import { DIMENSION_LABELS, DIMENSION_OPTIONS } from "@/lib/constants";

function getOptionLabel(dim: DimensionKey, value: string): string {
  const options = DIMENSION_OPTIONS[dim];
  const opt = options.find((o) => o.value === value);
  return opt ? opt.label : value;
}

export function generateFeedback(
  profile: Profile,
  selections: DimSelections,
  score: ScoreBreakdown
): string {
  if (score.total === 4) {
    return `Perfect read. You correctly identified all four cognitive dimensions for ${profile.name}. The clues were clear — "${profile.clues[0]}" and "${profile.clues[1]}" — and you read them precisely. This profile tests ${profile.context.toLowerCase()}, and you nailed it.`;
  }

  const parts: string[] = [];
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];
  const correct = dims.filter((d) => score[d]);
  const wrong = dims.filter((d) => !score[d]);

  if (correct.length > 0) {
    const correctLabels = correct.map((d) => DIMENSION_LABELS[d]).join(" and ");
    parts.push(`Your ${correctLabels} read${correct.length === 1 ? " was" : "s were"} spot-on.`);
  }

  for (const dim of wrong) {
    const userChoice = getOptionLabel(dim, selections[dim] || "");
    const correctChoice = getOptionLabel(dim, profile[`answer${dim}` as keyof Profile] as string);
    const dimLabel = DIMENSION_LABELS[dim];

    let clueHint = "";
    if (dim === "CV") {
      clueHint = profile.clues.length > 0
        ? ` The signal was "${profile.clues[0]}" — `
        : "";
    } else if (dim === "DR") {
      clueHint = profile.clues.length > 1
        ? ` Notice "${profile.clues[1]}" — `
        : "";
    } else {
      const idx = Math.min(2, profile.clues.length - 1);
      clueHint = idx >= 0 ? ` Look at "${profile.clues[idx]}" — ` : "";
    }

    parts.push(
      `For ${dimLabel}, you chose ${userChoice}, but the answer is ${correctChoice}.${clueHint}this points to a different cognitive pattern.`
    );
  }

  return parts.join(" ");
}

export function generateMetaInsight(
  weakest: DimensionKey,
  strongest: DimensionKey,
  accuracy: Record<DimensionKey, number>
): string {
  const weakLabel = DIMENSION_LABELS[weakest];
  const strongLabel = DIMENSION_LABELS[strongest];

  const insights: Record<DimensionKey, string> = {
    DR: "You tend to over- or under-estimate reasoning depth. Watch for clues about causal chain length — words like 'trace back', 'model', and 'systems' signal deeper processing.",
    SE: "Exploration width is your blind spot. Pay attention to how many alternatives someone generates before committing — 'one option' vs '5 different ways' tells the story.",
    SR: "Reflection frequency trips you up. The difference between Rare and Constant reflection is in the language: 'never thought about it' vs 'I constantly check my assumptions'.",
    CV: "Convergence style is where you misread most. Listen for what triggers the final decision: deadlines, logical clarity, data exhaustion, or gut instinct.",
  };

  return `Your ${strongLabel} reads are consistently strong (${accuracy[strongest].toFixed(0)}%). ${weakLabel} is your growth edge at ${accuracy[weakest].toFixed(0)}%. ${insights[weakest]}`;
}
