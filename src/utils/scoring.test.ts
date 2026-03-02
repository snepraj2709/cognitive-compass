import { describe, expect, it } from "vitest";
import { computeSessionAccuracy, computeXP, identifyStrongDimension, identifyWeakDimension, scoreAttempt } from "@/utils/scoring";
import type { DimSelections } from "@/lib/constants";

describe("scoring utilities", () => {
  it("scores each dimension and total correctly", () => {
    const selections: DimSelections = {
      DR: "Surface",
      SE: "DualTrack",
      SR: "Rare",
      CV: "Deadline",
    };
    const answer: DimSelections = {
      DR: "Surface",
      SE: "Single",
      SR: "Rare",
      CV: "Clarity",
    };

    expect(scoreAttempt(selections, answer)).toEqual({
      DR: true,
      SE: false,
      SR: true,
      CV: false,
      total: 2,
    });
  });

  it("computes per-dimension accuracy percentages", () => {
    const accuracy = computeSessionAccuracy([
      { DR: true, SE: false, SR: true, CV: false, total: 2 },
      { DR: true, SE: true, SR: false, CV: false, total: 2 },
      { DR: false, SE: true, SR: true, CV: true, total: 3 },
    ]);

    expect(accuracy).toEqual({
      DR: (2 / 3) * 100,
      SE: (2 / 3) * 100,
      SR: (2 / 3) * 100,
      CV: (1 / 3) * 100,
    });
  });

  it("selects deterministic weak/strong dimensions on ties", () => {
    const tied = {
      DR: 50,
      SE: 50,
      SR: 50,
      CV: 50,
    };

    expect(identifyWeakDimension(tied)).toBe("DR");
    expect(identifyStrongDimension(tied)).toBe("DR");
  });

  it("computes xp using score multiplier, speed bonus, and clue penalty", () => {
    expect(computeXP(4, "EASY", 20_000, false)).toBe(25);
    expect(computeXP(2, "MEDIUM", 45_000, true)).toBe(19);
    expect(computeXP(0, "HARD", 80_000, true)).toBe(0);
  });
});
