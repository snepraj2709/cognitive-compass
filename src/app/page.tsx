"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IntroScreen } from "@/components/game/IntroScreen";
import { useGameStore } from "@/stores/gameStore";

export default function HomePage() {
  const router = useRouter();
  const { status, startGame } = useGameStore();

  useEffect(() => {
    if (status === "PLAYING" || status === "SUBMITTING" || status === "FEEDBACK") {
      router.replace("/play");
      return;
    }

    if (status === "COMPLETE") {
      router.replace("/results");
    }
  }, [status, router]);

  const handleStart = () => {
    startGame();
    router.push("/play");
  };

  return <IntroScreen onStart={handleStart} />;
}
