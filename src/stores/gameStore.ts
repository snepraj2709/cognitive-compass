import { create } from "zustand";
import type {
  GameStatus,
  Profile,
  DimSelections,
  DimensionKey,
  DimensionValue,
  AttemptResult,
  SessionSummary,
} from "@/types/game";
import { PROFILES } from "@/data/profiles";
import { scoreAttempt, computeSessionAccuracy, identifyWeakDimension, identifyStrongDimension, computeXP } from "@/lib/scoring";
import { generateFeedback, generateMetaInsight } from "@/lib/feedback";

interface GameState {
  status: GameStatus;
  currentProfile: Profile | null;
  profileIndex: number;
  totalProfiles: number;
  profiles: Profile[];
  selections: DimSelections;
  clueRevealed: boolean;
  startTimestamp: number | null;
  attempts: AttemptResult[];
  currentFeedback: string;
  currentScore: { total: number; breakdown: { DR: boolean; SE: boolean; SR: boolean; CV: boolean } } | null;
  summary: SessionSummary | null;

  startGame: () => void;
  setSelection: (dim: DimensionKey, value: DimensionValue) => void;
  revealClue: () => void;
  submitAnswer: () => void;
  goToNextProfile: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  status: "IDLE",
  currentProfile: null,
  profileIndex: 0,
  totalProfiles: PROFILES.length,
  profiles: [],
  selections: { DR: null, SE: null, SR: null, CV: null },
  clueRevealed: false,
  startTimestamp: null,
  attempts: [],
  currentFeedback: "",
  currentScore: null,
  summary: null,

  startGame: () => {
    const shuffled = [...PROFILES].sort((a, b) => a.sortOrder - b.sortOrder);
    set({
      status: "PLAYING",
      profiles: shuffled,
      profileIndex: 0,
      currentProfile: shuffled[0],
      totalProfiles: shuffled.length,
      selections: { DR: null, SE: null, SR: null, CV: null },
      clueRevealed: false,
      startTimestamp: Date.now(),
      attempts: [],
      currentFeedback: "",
      currentScore: null,
      summary: null,
    });
  },

  setSelection: (dim, value) => {
    const { selections } = get();
    set({ selections: { ...selections, [dim]: value } });
  },

  revealClue: () => set({ clueRevealed: true }),

  submitAnswer: () => {
    const { currentProfile, selections, clueRevealed, startTimestamp, attempts } = get();
    if (!currentProfile) return;
    if (!selections.DR || !selections.SE || !selections.SR || !selections.CV) return;

    set({ status: "SUBMITTING" });

    const timeTaken = startTimestamp ? Date.now() - startTimestamp : 0;
    const score = scoreAttempt(selections, {
      DR: currentProfile.answerDR,
      SE: currentProfile.answerSE,
      SR: currentProfile.answerSR,
      CV: currentProfile.answerCV,
    });

    const feedback = generateFeedback(currentProfile, selections, score);

    const attempt: AttemptResult = {
      profileId: currentProfile.id,
      profileName: currentProfile.name,
      selections: { ...selections },
      correctAnswers: {
        DR: currentProfile.answerDR,
        SE: currentProfile.answerSE,
        SR: currentProfile.answerSR,
        CV: currentProfile.answerCV,
      },
      score,
      feedback,
      clueUsed: clueRevealed,
      timeTakenMs: timeTaken,
    };

    set({
      status: "FEEDBACK",
      currentFeedback: feedback,
      currentScore: { total: score.total, breakdown: { DR: score.DR, SE: score.SE, SR: score.SR, CV: score.CV } },
      attempts: [...attempts, attempt],
    });
  },

  goToNextProfile: () => {
    const { profileIndex, profiles, attempts } = get();
    const nextIndex = profileIndex + 1;

    if (nextIndex >= profiles.length) {
      const accuracy = computeSessionAccuracy(attempts);
      const weakest = identifyWeakDimension(accuracy);
      const strongest = identifyStrongDimension(accuracy);
      const totalScore = attempts.reduce((sum, a) => sum + a.score.total, 0);
      const maxScore = attempts.length * 4;
      const totalXP = attempts.reduce(
        (sum, a) => sum + computeXP(a.score.total, profiles[attempts.indexOf(a)]?.difficulty || "EASY", a.timeTakenMs, a.clueUsed),
        0
      );

      set({
        status: "COMPLETE",
        summary: {
          totalScore,
          maxScore,
          accuracy: (totalScore / maxScore) * 100,
          profileResults: attempts,
          dimensionAccuracy: accuracy,
          weakestDimension: weakest,
          strongestDimension: strongest,
          metaInsight: generateMetaInsight(weakest, strongest, accuracy),
          xpEarned: totalXP,
        },
      });
      return;
    }

    set({
      status: "PLAYING",
      profileIndex: nextIndex,
      currentProfile: profiles[nextIndex],
      selections: { DR: null, SE: null, SR: null, CV: null },
      clueRevealed: false,
      startTimestamp: Date.now(),
      currentFeedback: "",
      currentScore: null,
    });
  },

  resetGame: () => {
    set({
      status: "IDLE",
      currentProfile: null,
      profileIndex: 0,
      profiles: [],
      selections: { DR: null, SE: null, SR: null, CV: null },
      clueRevealed: false,
      startTimestamp: null,
      attempts: [],
      currentFeedback: "",
      currentScore: null,
      summary: null,
    });
  },
}));
