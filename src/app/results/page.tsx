"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionSummary } from "@/components/game/SessionSummary";
import { useGameStore } from "@/stores/gameStore";

export default function ResultsPage() {
  const router = useRouter();
  const { status, summary, resetGame } = useGameStore();

  useEffect(() => {
    if (status !== "COMPLETE" || !summary) {
      router.replace("/");
    }
  }, [status, summary, router]);

  const handlePlayAgain = () => {
    resetGame();
    router.push("/");
  };

  if (status !== "COMPLETE" || !summary) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <SessionSummary summary={summary} onPlayAgain={handlePlayAgain} />
    </main>
  );
}
