"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { ProfileCard } from "@/components/game/ProfileCard";
import { DimensionSelector } from "@/components/game/DimensionSelector";
import { FeedbackPanel } from "@/components/game/FeedbackPanel";
import { ProgressDots } from "@/components/game/ProgressDots";

export default function PlayPage() {
  const router = useRouter();
  const {
    status,
    currentProfile,
    profileIndex,
    totalProfiles,
    selections,
    clueRevealed,
    currentScore,
    currentFeedback,
    attempts,
    setSelection,
    revealClue,
    submitAnswer,
    goToNextProfile,
  } = useGameStore();

  useEffect(() => {
    if (status === "IDLE") {
      router.replace("/");
      return;
    }

    if (status === "COMPLETE") {
      router.replace("/results");
    }
  }, [status, router]);

  const allSelected = selections.DR && selections.SE && selections.SR && selections.CV;
  const completedScores = attempts.map((a) => a.score.total);

  if (status === "IDLE" || status === "COMPLETE") {
    return null;
  }

  return (
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
                onClick={submitAnswer}
                disabled={!allSelected || status === "SUBMITTING"}
                className="w-full rounded-lg bg-primary py-3 font-mono text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Submit classification"
              >
                {status === "SUBMITTING" ? "Analyzing..." : "Submit Classification"}
              </button>
            </motion.div>
          )}

          {status === "FEEDBACK" && currentScore && (
            <motion.div key={`feedback-${profileIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FeedbackPanel
                score={currentScore}
                feedback={currentFeedback}
                onNext={goToNextProfile}
                isLastProfile={profileIndex === totalProfiles - 1}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
