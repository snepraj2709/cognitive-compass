import type { DimSelections, ScoreBreakdown, DimensionAccuracy, DimensionKey, Difficulty, AttemptResult } from "@/types/game";
import { XP_BASE } from "@/lib/constants";

export function scoreAttempt(
  selections: DimSelections,
  answer: { DR: string; SE: string; SR: string; CV: string }
): ScoreBreakdown {
  const DR = selections.DR === answer.DR;
  const SE = selections.SE === answer.SE;
  const SR = selections.SR === answer.SR;
  const CV = selections.CV === answer.CV;
  const total = [DR, SE, SR, CV].filter(Boolean).length;
  return { DR, SE, SR, CV, total, maxScore: 4 };
}

export function computeSessionAccuracy(attempts: AttemptResult[]): DimensionAccuracy {
  if (attempts.length === 0) return { DR: 0, SE: 0, SR: 0, CV: 0 };
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];
  const result: DimensionAccuracy = { DR: 0, SE: 0, SR: 0, CV: 0 };
  for (const dim of dims) {
    const correct = attempts.filter((a) => a.score[dim]).length;
    result[dim] = (correct / attempts.length) * 100;
  }
  return result;
}

export function identifyWeakDimension(accuracy: DimensionAccuracy): DimensionKey {
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];
  let weakest: DimensionKey = "DR";
  let lowest = Infinity;
  for (const dim of dims) {
    if (accuracy[dim] < lowest) {
      lowest = accuracy[dim];
      weakest = dim;
    }
  }
  return weakest;
}

export function identifyStrongDimension(accuracy: DimensionAccuracy): DimensionKey {
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];
  let strongest: DimensionKey = "DR";
  let highest = -Infinity;
  for (const dim of dims) {
    if (accuracy[dim] > highest) {
      highest = accuracy[dim];
      strongest = dim;
    }
  }
  return strongest;
}

export function computeXP(score: number, difficulty: Difficulty, timeTakenMs: number, clueUsed: boolean): number {
  const base = XP_BASE[difficulty] || 10;
  const scoreMultiplier = (score / 4) * 2;
  let speedBonus = 0;
  if (timeTakenMs < 30000) speedBonus = 5;
  else if (timeTakenMs < 60000) speedBonus = 2;
  const cluePenalty = clueUsed ? 3 : 0;
  return Math.max(0, Math.round(base * scoreMultiplier + speedBonus - cluePenalty));
}
