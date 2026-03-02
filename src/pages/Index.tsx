import { useGameStore } from "@/stores/gameStore";
import { IntroScreen } from "@/components/game/IntroScreen";
import { ProfileCard } from "@/components/game/ProfileCard";
import { DimensionSelector } from "@/components/game/DimensionSelector";
import { FeedbackPanel } from "@/components/game/FeedbackPanel";
import { SessionSummary } from "@/components/game/SessionSummary";
import { ProgressDots } from "@/components/game/ProgressDots";
import { AnimatePresence, motion } from "framer-motion";

const Index = () => {
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
    summary,
    startGame,
    setSelection,
    revealClue,
    submitAnswer,
    goToNextProfile,
    resetGame,
  } = useGameStore();

  const allSelected = selections.DR && selections.SE && selections.SR && selections.CV;
  const completedScores = attempts.map((a) => a.score.total);

  if (status === "IDLE") {
    return <IntroScreen onStart={startGame} />;
  }

  if (status === "COMPLETE" && summary) {
    return (
      <main className="min-h-screen px-4 py-10">
        <SessionSummary summary={summary} onPlayAgain={resetGame} />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
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
              <ProfileCard
                profile={currentProfile}
                clueRevealed={clueRevealed}
                onRevealClue={revealClue}
              />

              <DimensionSelector
                onSelect={setSelection}
                selections={selections}
              />

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
            <motion.div
              key={`feedback-${profileIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
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
};

export default Index;
