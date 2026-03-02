"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { SessionSummary as SummaryType } from "@/types/game";
import { DIMENSION_LABELS } from "@/lib/constants";
import type { DimensionKey } from "@/types/game";
import type { SessionRadarChartDatum } from "@/components/game/SessionRadarChart";

interface SessionSummaryProps {
  summary: SummaryType;
  onPlayAgain: () => void;
}

const RadarChart = dynamic(() => import("@/components/game/SessionRadarChart"), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-white/5" />,
});

export function SessionSummary({ summary, onPlayAgain }: SessionSummaryProps) {
  const radarData: SessionRadarChartDatum[] = (["DR", "SE", "SR", "CV"] as DimensionKey[]).map((dim) => ({
    dimension: DIMENSION_LABELS[dim],
    accuracy: Math.round(summary.dimensionAccuracy[dim]),
    fullMark: 100,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-xl space-y-6"
    >
      <div className="text-center">
        <div className="dim-label mb-2">Session Complete</div>
        <motion.h1
          className="text-4xl font-bold text-gradient-primary"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
        >
          {summary.totalScore}/{summary.maxScore}
        </motion.h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {summary.accuracy.toFixed(1)}% accuracy · {summary.xpEarned} XP earned
        </p>
      </div>

      {/* Radar Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="surface-glass rounded-lg p-4"
      >
        <div className="dim-label mb-2 text-center">Cognitive Profile</div>
        <RadarChart radarData={radarData} />
      </motion.div>

      {/* Profile Results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="surface-glass rounded-lg p-4"
      >
        <div className="dim-label mb-3">Profile Breakdown</div>
        <div className="space-y-2">
          {summary.profileResults.map((r) => (
            <div key={r.profileId} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
              <span className="text-sm">{r.profileName}</span>
              <span
                className={`font-mono text-sm font-bold ${
                  r.score.total === 4
                    ? "text-score-perfect"
                    : r.score.total >= 2
                    ? "text-score-good"
                    : "text-score-poor"
                }`}
              >
                {r.score.total}/4
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Meta Insight */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="surface-glass rounded-lg p-5"
      >
        <div className="dim-label mb-2">Meta-Cognitive Insight</div>
        <p className="text-sm leading-relaxed text-foreground/85">{summary.metaInsight}</p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="flex gap-3"
      >
        <button
          onClick={onPlayAgain}
          className="flex-1 rounded-lg bg-primary py-3 font-mono text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          aria-label="Play again"
        >
          Play Again
        </button>
      </motion.div>
    </motion.div>
  );
}
