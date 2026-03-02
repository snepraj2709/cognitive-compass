import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { DimensionKey } from "@/types/game";
import { DIMENSION_LABELS } from "@/lib/constants";

interface FeedbackPanelProps {
  score: { total: number; breakdown: Record<DimensionKey, boolean> };
  feedback: string;
  onNext: () => void;
  isLastProfile: boolean;
}

export function FeedbackPanel({ score, feedback, onNext, isLastProfile }: FeedbackPanelProps) {
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Score */}
      <div className="surface-glass rounded-lg p-6 text-center">
        <div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Score
        </div>
        <motion.div
          className={`text-5xl font-bold font-mono ${
            score.total === 4
              ? "text-score-perfect"
              : score.total >= 2
              ? "text-score-good"
              : "text-score-poor"
          }`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
        >
          {score.total}/4
        </motion.div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {dims.map((dim, i) => (
          <motion.div
            key={dim}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className={`flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm ${
              score.breakdown[dim]
                ? "bg-score-perfect/10 text-score-perfect"
                : "bg-score-poor/10 text-score-poor"
            }`}
          >
            {score.breakdown[dim] ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            <span>{DIMENSION_LABELS[dim]}</span>
          </motion.div>
        ))}
      </div>

      {/* Feedback */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="surface-glass rounded-lg p-5"
      >
        <div className="mb-2 dim-label">Analysis</div>
        <p className="text-sm leading-relaxed text-foreground/85">{feedback}</p>
      </motion.div>

      {/* Next */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={onNext}
        className="w-full rounded-lg bg-primary py-3 font-mono text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        aria-label={isLastProfile ? "View results" : "Next profile"}
      >
        {isLastProfile ? "View Results →" : "Next Profile →"}
      </motion.button>
    </motion.div>
  );
}
