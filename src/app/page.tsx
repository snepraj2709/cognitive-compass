"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IntroScreen } from "@/components/game/IntroScreen";
import { useGameStore } from "@/stores/gameStore";

export default function HomePage() {
  const router = useRouter();
  const { status, startGame, bootstrapSession } = useGameStore();

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (status === "PLAYING" || status === "SUBMITTING" || status === "FEEDBACK") {
      router.replace("/play");
      return;
    }

    if (status === "COMPLETE") {
      router.replace("/results");
    }
  }, [status, router]);

  const handleStart = async () => {
    await startGame();
    if (useGameStore.getState().status === "PLAYING") {
      router.push("/play");
    }
  };

  if (status === "RESTORING") {
    return null;
  }

  return <IntroScreen onStart={handleStart} />;
}
