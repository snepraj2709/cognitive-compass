"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useGameStream } from "@/hooks/useGameStream";
import { ProfileCard } from "@/components/game/ProfileCard";
import { DimensionSelector } from "@/components/game/DimensionSelector";
import { FeedbackPanel } from "@/components/game/FeedbackPanel";
import { ProgressDots } from "@/components/game/ProgressDots";
import { BootingCogOS } from "@/components/game/BootingCogOS";
import { GameErrorBoundary } from "@/components/ui/GameErrorBoundary";
import { DR_VALUES, type DRValue } from "@/lib/constants";

const DR_SHORTCUTS: Partial<Record<string, DRValue>> = {
  "1": DR_VALUES[0],
  "2": DR_VALUES[1],
  "3": DR_VALUES[2],
  "4": DR_VALUES[3],
};

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable ||
    target.closest("[contenteditable='true']") !== null
  );
}

export default function PlayPage() {
  const router = useRouter();
  const { submitCurrentAnswer } = useGameStream();
  const {
    status,
    hasBootstrapped,
    bootstrapSession,
    currentProfile,
    profileIndex,
    totalProfiles,
    selections,
    clueRevealed,
    currentScore,
    currentFeedback,
    streamedFeedback,
    completedScores,
    pendingSessionComplete,
    setSelection,
    revealClue,
    handleNextAfterFeedback,
  } = useGameStore();

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (status === "IDLE" && hasBootstrapped) {
      router.replace("/");
      return;
    }

    if (status === "COMPLETE") {
      router.replace("/results");
    }
  }, [status, hasBootstrapped, router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (status !== "PLAYING") {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (isEditableElement(event.target)) {
        return;
      }

      const mapped = DR_SHORTCUTS[event.key];
      if (!mapped) {
        return;
      }

      event.preventDefault();
      setSelection("DR", mapped);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelection, status]);

  const allSelected = Boolean(selections.DR && selections.SE && selections.SR && selections.CV);

  if (status === "RESTORING") {
    return (
      <GameErrorBoundary>
        <BootingCogOS />
      </GameErrorBoundary>
    );
  }

  if ((status === "IDLE" && hasBootstrapped) || status === "COMPLETE") {
    return null;
  }

  return (
    <GameErrorBoundary>
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-mono text-lg font-bold text-gradient-primary">CogOS</h1>
            </div>
            <ProgressDots total={totalProfiles} current={profileIndex} completedScores={completedScores} />
            <div className="font-mono text-xs text-muted-foreground">
              {profileIndex + 1}/{totalProfiles}
            </div>
          </header>

          <AnimatePresence mode="wait">
            {(status === "PLAYING" || status === "SUBMITTING") && currentProfile && (
              <motion.div
                key={`play-${currentProfile.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <ProfileCard profile={currentProfile} clueRevealed={clueRevealed} onRevealClue={revealClue} />

                <DimensionSelector onSelect={setSelection} selections={selections} />

                <button
                  type="button"
                  onClick={submitCurrentAnswer}
                  disabled={!allSelected || status === "SUBMITTING"}
                  className="w-full min-h-[44px] rounded-lg bg-primary py-3 font-mono text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={allSelected ? "Submit profile analysis" : "Select all 4 dimensions to submit"}
                >
                  {status === "SUBMITTING" ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Analyzing...
                    </span>
                  ) : (
                    "Submit Classification"
                  )}
                </button>

                {status === "SUBMITTING" && streamedFeedback.length === 0 && (
                  <div aria-live="polite" className="surface-glass animate-pulse rounded-lg p-5">
                    <div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      Analysis
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded bg-white/10" />
                      <div className="h-3 rounded bg-white/10" />
                      <div className="h-3 w-2/3 rounded bg-white/10" />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {status === "FEEDBACK" && currentScore && (
              <motion.div
                key={`feedback-${profileIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <FeedbackPanel
                  score={currentScore}
                  feedback={currentFeedback}
                  onNext={handleNextAfterFeedback}
                  isLastProfile={pendingSessionComplete}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </GameErrorBoundary>
  );
}