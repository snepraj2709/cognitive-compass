"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BootingCogOS } from "@/components/game/BootingCogOS";
import { SessionSummary } from "@/components/game/SessionSummary";
import { GameErrorBoundary } from "@/components/ui/GameErrorBoundary";
import { useGameStore } from "@/stores/gameStore";

export default function ResultsPage() {
  const router = useRouter();
  const { status, summary, resetGame, bootstrapSession } = useGameStore();

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (status === "PLAYING" || status === "SUBMITTING" || status === "FEEDBACK") {
      router.replace("/play");
      return;
    }

    if (status !== "COMPLETE" || !summary) {
      router.replace("/");
    }
  }, [status, summary, router]);

  const handlePlayAgain = () => {
    resetGame();
    router.push("/");
  };

  if (status === "RESTORING") {
    return (
      <GameErrorBoundary>
        <BootingCogOS />
      </GameErrorBoundary>
    );
  }

  if (status !== "COMPLETE" || !summary) {
    return null;
  }

  return (
    <GameErrorBoundary>
      <main className="min-h-screen px-4 py-10">
        <SessionSummary summary={summary} onPlayAgain={handlePlayAgain} />
      </main>
    </GameErrorBoundary>
  );
}
