"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { COGOS_SESSION_STORAGE_KEY } from "@/lib/constants";

interface GameErrorBoundaryProps {
  children: ReactNode;
}

interface GameErrorBoundaryState {
  hasError: boolean;
}

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): GameErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GameErrorBoundary caught render error", error, errorInfo);
  }

  private handleStartNewGame = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(COGOS_SESSION_STORAGE_KEY);
      window.location.assign("/");
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="surface-glass w-full max-w-lg rounded-lg p-6 text-center">
            <p className="text-sm leading-relaxed text-foreground">
              Something went wrong. Your progress may be lost.
            </p>
            <button
              type="button"
              onClick={this.handleStartNewGame}
              className="mt-4 min-h-[44px] w-full rounded-lg bg-primary px-4 py-3 font-mono text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
              aria-label="Start new game"
            >
              Start New Game
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
