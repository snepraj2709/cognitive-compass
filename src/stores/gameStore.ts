"use client";

import { create } from "zustand";
import type {
  DimSelections,
  DimensionKey,
  DimensionValue,
  GameStatus,
  PublicProfile,
  SessionStateResponse,
  SessionSummary,
} from "@/types/game";

interface ScoreEventPayload {
  total: number;
  breakdown: {
    DR: boolean;
    SE: boolean;
    SR: boolean;
    CV: boolean;
  };
}

interface CreateSessionResponse {
  sessionId: string;
  guestToken: string | null;
  currentProfile: PublicProfile;
  totalProfiles: number;
  profileIndex: number;
  completedScores: number[];
}

interface GameState {
  status: GameStatus;
  sessionId: string | null;
  guestToken: string | null;
  currentProfile: PublicProfile | null;
  profileIndex: number;
  totalProfiles: number;
  selections: DimSelections;
  clueRevealed: boolean;
  startTimestamp: number | null;
  completedScores: number[];
  currentFeedback: string;
  streamedFeedback: string;
  currentScore: ScoreEventPayload | null;
  summary: SessionSummary | null;
  nextProfile: PublicProfile | null;
  pendingSessionComplete: boolean;
  hasBootstrapped: boolean;
  error: string | null;

  bootstrapSession: () => Promise<void>;
  startGame: () => Promise<void>;
  restoreSessionById: (sessionId: string) => Promise<void>;
  setSelection: (dim: DimensionKey, value: DimensionValue) => void;
  revealClue: () => void;
  beginSubmitFlow: () => void;
  applyScoreEvent: (payload: ScoreEventPayload) => void;
  appendFeedbackChunk: (chunk: string) => void;
  applyNextProfileEvent: (profile: PublicProfile | null, profileIndex: number) => void;
  applySessionCompleteEvent: (profileIndex: number) => void;
  finalizeSubmitFlow: () => void;
  handleNextAfterFeedback: () => Promise<void>;
  resetGame: () => void;
}

const EMPTY_SELECTIONS: DimSelections = {
  DR: null,
  SE: null,
  SR: null,
  CV: null,
};

const STORAGE_SESSION_KEY = "cogos:sessionId";

function getStoredSessionId() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(STORAGE_SESSION_KEY);
}

function persistSessionId(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (sessionId) {
    window.localStorage.setItem(STORAGE_SESSION_KEY, sessionId);
  } else {
    window.localStorage.removeItem(STORAGE_SESSION_KEY);
  }
}

async function parseError(response: Response) {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data.error?.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function toPlayingState(session: SessionStateResponse) {
  return {
    sessionId: session.sessionId,
    guestToken: session.guestToken,
    status: "PLAYING" as const,
    currentProfile: session.currentProfile,
    profileIndex: session.profileIndex,
    totalProfiles: session.totalProfiles,
    completedScores: session.completedScores,
    selections: { ...EMPTY_SELECTIONS },
    clueRevealed: false,
    startTimestamp: Date.now(),
    currentFeedback: "",
    streamedFeedback: "",
    currentScore: null,
    summary: null,
    nextProfile: null,
    pendingSessionComplete: false,
    error: null,
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  status: "IDLE",
  sessionId: null,
  guestToken: null,
  currentProfile: null,
  profileIndex: 0,
  totalProfiles: 0,
  selections: { ...EMPTY_SELECTIONS },
  clueRevealed: false,
  startTimestamp: null,
  completedScores: [],
  currentFeedback: "",
  streamedFeedback: "",
  currentScore: null,
  summary: null,
  nextProfile: null,
  pendingSessionComplete: false,
  hasBootstrapped: false,
  error: null,

  bootstrapSession: async () => {
    const state = get();
    if (state.hasBootstrapped) {
      return;
    }

    set({ status: "RESTORING", hasBootstrapped: true, error: null });

    const storedSessionId = getStoredSessionId();
    if (!storedSessionId) {
      set({ status: "IDLE" });
      return;
    }

    await get().restoreSessionById(storedSessionId);
  },

  restoreSessionById: async (sessionId) => {
    try {
      const response = await fetch(`/api/game/session/${sessionId}`, {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 404 || response.status === 410) {
        persistSessionId(null);
        set({
          status: "IDLE",
          sessionId: null,
          currentProfile: null,
          totalProfiles: 0,
          completedScores: [],
          error: null,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const data = (await response.json()) as SessionStateResponse;

      if (data.status === "COMPLETED") {
        const summaryResponse = await fetch(`/api/game/session/${data.sessionId}/complete`, {
          method: "POST",
        });

        if (!summaryResponse.ok) {
          throw new Error(await parseError(summaryResponse));
        }

        const summary = (await summaryResponse.json()) as SessionSummary;
        set({
          ...toPlayingState(data),
          status: "COMPLETE",
          summary,
        });
        return;
      }

      if (data.status === "EXPIRED") {
        persistSessionId(null);
        set({
          status: "IDLE",
          sessionId: null,
          currentProfile: null,
          totalProfiles: 0,
          completedScores: [],
          error: null,
        });
        return;
      }

      persistSessionId(data.sessionId);
      set(toPlayingState(data));
    } catch (error) {
      persistSessionId(null);
      set({
        status: "IDLE",
        sessionId: null,
        currentProfile: null,
        totalProfiles: 0,
        completedScores: [],
        error: error instanceof Error ? error.message : "Failed to restore session",
      });
    }
  },

  startGame: async () => {
    const state = get();

    set({
      status: "SUBMITTING",
      error: null,
      currentFeedback: "",
      streamedFeedback: "",
      currentScore: null,
      summary: null,
      nextProfile: null,
      pendingSessionComplete: false,
    });

    try {
      const response = await fetch("/api/game/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const data = (await response.json()) as CreateSessionResponse;

      persistSessionId(data.sessionId);
      set({
        status: "PLAYING",
        sessionId: data.sessionId,
        guestToken: data.guestToken,
        currentProfile: data.currentProfile,
        profileIndex: data.profileIndex,
        totalProfiles: data.totalProfiles,
        selections: { ...EMPTY_SELECTIONS },
        clueRevealed: false,
        startTimestamp: Date.now(),
        completedScores: data.completedScores,
        currentFeedback: "",
        streamedFeedback: "",
        currentScore: null,
        summary: null,
        nextProfile: null,
        pendingSessionComplete: false,
        error: null,
      });
    } catch (error) {
      set({
        status: "IDLE",
        error: error instanceof Error ? error.message : "Failed to start game",
      });
    }
  },

  setSelection: (dim, value) => {
    const { selections } = get();
    set({ selections: { ...selections, [dim]: value } });
  },

  revealClue: () => set({ clueRevealed: true }),

  beginSubmitFlow: () => {
    set({
      status: "SUBMITTING",
      currentFeedback: "",
      streamedFeedback: "",
      currentScore: null,
      nextProfile: null,
      pendingSessionComplete: false,
      error: null,
    });
  },

  applyScoreEvent: (payload) => {
    set((state) => ({
      currentScore: payload,
      completedScores: [...state.completedScores, payload.total],
    }));
  },

  appendFeedbackChunk: (chunk) => {
    set((state) => ({
      streamedFeedback: `${state.streamedFeedback}${chunk}`,
    }));
  },

  applyNextProfileEvent: (profile, profileIndex) => {
    set({
      nextProfile: profile,
      profileIndex,
      pendingSessionComplete: false,
    });
  },

  applySessionCompleteEvent: (profileIndex) => {
    set({
      profileIndex,
      nextProfile: null,
      pendingSessionComplete: true,
    });
  },

  finalizeSubmitFlow: () => {
    const state = get();
    set({
      status: "FEEDBACK",
      currentFeedback: state.streamedFeedback,
    });
  },

  handleNextAfterFeedback: async () => {
    const state = get();

    if (state.pendingSessionComplete) {
      if (!state.sessionId) {
        set({ status: "IDLE" });
        return;
      }

      try {
        const response = await fetch(`/api/game/session/${state.sessionId}/complete`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

        const summary = (await response.json()) as SessionSummary;

        set({
          status: "COMPLETE",
          summary,
          currentScore: null,
          currentFeedback: "",
          streamedFeedback: "",
          nextProfile: null,
          pendingSessionComplete: false,
          selections: { ...EMPTY_SELECTIONS },
          clueRevealed: false,
          startTimestamp: null,
          error: null,
        });
      } catch (error) {
        set({
          status: "IDLE",
          error: error instanceof Error ? error.message : "Failed to complete session",
        });
      }

      return;
    }

    if (!state.nextProfile) {
      set({ status: "IDLE", error: "Next profile not available" });
      return;
    }

    set({
      status: "PLAYING",
      currentProfile: state.nextProfile,
      nextProfile: null,
      selections: { ...EMPTY_SELECTIONS },
      clueRevealed: false,
      startTimestamp: Date.now(),
      currentScore: null,
      currentFeedback: "",
      streamedFeedback: "",
      error: null,
    });
  },

  resetGame: () => {
    persistSessionId(null);
    set({
      status: "IDLE",
      sessionId: null,
      currentProfile: null,
      profileIndex: 0,
      totalProfiles: 0,
      selections: { ...EMPTY_SELECTIONS },
      clueRevealed: false,
      startTimestamp: null,
      completedScores: [],
      currentFeedback: "",
      streamedFeedback: "",
      currentScore: null,
      summary: null,
      nextProfile: null,
      pendingSessionComplete: false,
      error: null,
    });
  },
}));
