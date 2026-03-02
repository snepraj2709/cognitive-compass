import type {
  CVValue,
  DRValue,
  Difficulty,
  DimensionAccuracy,
  DimensionKey,
  SEValue,
  SRValue,
  ScoreBreakdown,
} from "@/types/game";
import { DIMENSION_KEYS, XP_BASE } from "@/lib/constants";

export interface AttemptSelections {
  DR: DRValue;
  SE: SEValue;
  SR: SRValue;
  CV: CVValue;
}

export function scoreAttempt(
  selections: AttemptSelections,
  correct: AttemptSelections
): ScoreBreakdown {
  const DR = selections.DR === correct.DR;
  const SE = selections.SE === correct.SE;
  const SR = selections.SR === correct.SR;
  const CV = selections.CV === correct.CV;
  const total = [DR, SE, SR, CV].filter(Boolean).length;

  return {
    DR,
    SE,
    SR,
    CV,
    total,
    maxScore: 4,
  };
}

export function computeXP(score: number, difficulty: Difficulty, timeTakenMs: number, clueUsed: boolean): number {
  const base = XP_BASE[difficulty] ?? XP_BASE.EASY;
  const scoreMultiplier = score / 4;
  const speedBonus = timeTakenMs <= 30_000 ? 5 : timeTakenMs <= 60_000 ? 2 : 0;
  const cluePenalty = clueUsed ? 3 : 0;

  return Math.max(0, Math.round(base * scoreMultiplier + speedBonus - cluePenalty));
}

export function computeSessionAccuracy(
  attempts: Array<{ scoreDR: boolean; scoreSE: boolean; scoreSR: boolean; scoreCV: boolean }>
): DimensionAccuracy {
  if (attempts.length === 0) {
    return { DR: 0, SE: 0, SR: 0, CV: 0 };
  }

  const totals = attempts.reduce(
    (acc, attempt) => {
      if (attempt.scoreDR) acc.DR += 1;
      if (attempt.scoreSE) acc.SE += 1;
      if (attempt.scoreSR) acc.SR += 1;
      if (attempt.scoreCV) acc.CV += 1;
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
