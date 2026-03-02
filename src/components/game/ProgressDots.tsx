import { motion } from "framer-motion";

interface ProgressDotsProps {
  total: number;
  current: number;
  completedScores: number[];
}

export function ProgressDots({ total, current, completedScores }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-label="Profile progress" aria-valuenow={current + 1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => {
        const isCompleted = i < completedScores.length;
        const isCurrent = i === current;
        const score = completedScores[i];

        return (
          <motion.div
            key={i}
            className={`relative h-2.5 w-2.5 rounded-full transition-colors ${
              isCurrent
                ? "bg-primary glow-primary"
                : isCompleted
                ? score === 4
                  ? "bg-score-perfect"
                  : score >= 2
                  ? "bg-score-good"
                  : "bg-score-poor"
                : "bg-muted"
            }`}
            initial={false}
            animate={isCurrent ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
            aria-label={`Profile ${i + 1}${isCurrent ? " (current)" : isCompleted ? ` (score: ${score}/4)` : ""}`}
          />
        );
      })}
    </div>
  );
}
