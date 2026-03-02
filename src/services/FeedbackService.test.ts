import { describe, expect, it } from "vitest";
import { FeedbackService } from "@/services/FeedbackService";
import type { DimSelections } from "@/lib/constants";
import type { ScoreBreakdown } from "@/utils/scoring";

describe("FeedbackService.generateFeedbackFallback", () => {
  it("returns reinforcement text for perfect score", () => {
    const score: ScoreBreakdown = {
      DR: true,
      SE: true,
      SR: true,
      CV: true,
      total: 4,
    };

    const selections: DimSelections = {
      DR: "Surface",
      SE: "Single",
      SR: "Rare",
      CV: "Deadline",
    };

    const fallback = FeedbackService.generateFeedbackFallback(score, selections, selections);
    expect(fallback).toContain("You scored 4/4");
    expect(fallback).toContain("DR, SE, SR, and CV");
  });

  it("calls out wrong dimensions with static contrast guidance", () => {
    const score: ScoreBreakdown = {
      DR: false,
      SE: true,
      SR: false,
      CV: true,
      total: 2,
    };

    const correct: DimSelections = {
      DR: "Deep",
      SE: "Single",
      SR: "Regular",
      CV: "Clarity",
    };

    const selected: DimSelections = {
      DR: "Surface",
      SE: "Single",
      SR: "Rare",
      CV: "Clarity",
    };

    const fallback = FeedbackService.generateFeedbackFallback(score, correct, selected);

    expect(fallback).toContain("You scored 2/4");
    expect(fallback).toContain("DR was off");
    expect(fallback).toContain("SR was off");
    expect(fallback).toContain("SE was correct");
    expect(fallback).toContain("DR contrast");
    expect(fallback).toContain("SR contrast");
  });
});
