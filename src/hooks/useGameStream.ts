"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";
import type { CVValue, DRValue, SEValue, SRValue } from "@/types/game";

interface ScoreEventPayload {
  total: number;
  breakdown: {
    DR: boolean;
    SE: boolean;
    SR: boolean;
    CV: boolean;
  };
}

interface NextProfileEventPayload {
  profileIndex: number;
  profile: {
    id: string;
    slug: string;
    name: string;
    avatar: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    scenario: string;
    context: string;
    clues: string[];
    sortOrder: number;
  } | null;
}

interface SessionCompleteEventPayload {
  profileIndex: number;
}

function parseSseEvent(block: string): { event: string; data: string } | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));

  if (!eventLine || !dataLine) {
    return null;
  }

  return {
    event: eventLine.slice("event:".length).trim(),
    data: dataLine.slice("data:".length).trim(),
  };
}

export function useGameStream() {
  const abortRef = useRef<AbortController | null>(null);

  const submitCurrentAnswer = useCallback(async () => {
    const store = useGameStore.getState();
    const { sessionId, currentProfile, selections, clueRevealed, startTimestamp } = store;

    if (!sessionId || !currentProfile) {
      return;
    }

    if (!selections.DR || !selections.SE || !selections.SR || !selections.CV) {
      return;
    }

    const selectionPayload: {
      DR: DRValue;
      SE: SEValue;
      SR: SRValue;
      CV: CVValue;
    } = {
      DR: selections.DR,
      SE: selections.SE,
      SR: selections.SR,
      CV: selections.CV,
    };

    useGameStore.getState().beginSubmitFlow();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const elapsedMs = startTimestamp ? Date.now() - startTimestamp : 1;
      const timeTakenMs = Math.max(1, elapsedMs);

      const response = await fetch(`/api/game/session/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: currentProfile.id,
          selections: selectionPayload,
          clueUsed: clueRevealed,
          timeTakenMs,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Submit failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDoneEvent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const parsed = parseSseEvent(block);
          if (!parsed) {
            continue;
          }

          if (parsed.event === "score") {
            const payload = JSON.parse(parsed.data) as ScoreEventPayload;
            useGameStore.getState().applyScoreEvent(payload);
            continue;
          }

          if (parsed.event === "feedback_chunk") {
            const payload = JSON.parse(parsed.data) as { chunk: string };
            useGameStore.getState().appendFeedbackChunk(payload.chunk);
            continue;
          }

          if (parsed.event === "next_profile") {
            const payload = JSON.parse(parsed.data) as NextProfileEventPayload;
            useGameStore.getState().applyNextProfileEvent(payload.profile, payload.profileIndex);
            continue;
          }

          if (parsed.event === "session_complete") {
            const payload = JSON.parse(parsed.data) as SessionCompleteEventPayload;
            useGameStore.getState().applySessionCompleteEvent(payload.profileIndex);
            continue;
          }

          if (parsed.event === "done") {
            sawDoneEvent = true;
            useGameStore.getState().finalizeSubmitFlow();
          }
        }
      }

      if (!sawDoneEvent) {
        useGameStore.getState().finalizeSubmitFlow();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        useGameStore.setState({
          status: "IDLE",
          error: error instanceof Error ? error.message : "Failed to stream feedback",
        });
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    submitCurrentAnswer,
    cancel,
  };
}
