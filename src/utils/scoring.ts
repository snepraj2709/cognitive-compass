import { DIMENSION_KEYS, type DimSelections, type Difficulty, type DimensionKey, XP_BASE } from "@/lib/constants";

export interface ScoreBreakdown {
  DR: boolean;
  SE: boolean;
  SR: boolean;
  CV: boolean;
  total: number;
}

export interface DimensionAccuracy {
  DR: number;
  SE: number;
  SR: number;
  CV: number;
}

function isCorrectSelection(selected: string | null, correct: string | null): boolean {
  return selected !== null && correct !== null && selected === correct;
}

export function scoreAttempt(selections: DimSelections, answer: DimSelections): ScoreBreakdown {
  const DR = isCorrectSelection(selections.DR, answer.DR);
  const SE = isCorrectSelection(selections.SE, answer.SE);
  const SR = isCorrectSelection(selections.SR, answer.SR);
  const CV = isCorrectSelection(selections.CV, answer.CV);

  const total = [DR, SE, SR, CV].filter(Boolean).length;
  return { DR, SE, SR, CV, total };
}

export function computeSessionAccuracy(attempts: ScoreBreakdown[]): DimensionAccuracy {
  if (attempts.length === 0) {
    return { DR: 0, SE: 0, SR: 0, CV: 0 };
  }

  const totals = attempts.reduce(
    (acc, attempt) => {
      if (attempt.DR) acc.DR += 1;
      if (attempt.SE) acc.SE += 1;
      if (attempt.SR) acc.SR += 1;
      if (attempt.CV) acc.CV += 1;
      return acc;
    },
    { DR: 0, SE: 0, SR: 0, CV: 0 }
  );

  return {
    DR: (totals.DR / attempts.length) * 100,
    SE: (totals.SE / attempts.length) * 100,
    SR: (totals.SR / attempts.length) * 100,
    CV: (totals.CV / attempts.length) * 100,
  };
}

export function identifyWeakDimension(accuracy: DimensionAccuracy): DimensionKey {
  return DIMENSION_KEYS.reduce((weakest, current) =>
    accuracy[current] < accuracy[weakest] ? current : weakest
  );
}

export function identifyStrongDimension(accuracy: DimensionAccuracy): DimensionKey {
  return DIMENSION_KEYS.reduce((strongest, current) =>
    accuracy[current] > accuracy[strongest] ? current : strongest
  );
}

export function computeXP(
  score: number,
  difficulty: Difficulty,
  timeTakenMs: number,
  clueUsed: boolean
): number {
  if (score <= 0) {
    return 0;
  }

  const base = XP_BASE[difficulty];
  const scoreMultiplier = (score / 4) * 2;
  const speedBonus = timeTakenMs < 30_000 ? 5 : timeTakenMs < 60_000 ? 2 : 0;
  const cluePenalty = clueUsed ? 3 : 0;

  return Math.max(0, Math.round(base * scoreMultiplier + speedBonus - cluePenalty));
}
