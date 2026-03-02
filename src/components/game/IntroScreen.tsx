import { motion } from "framer-motion";

interface IntroScreenProps {
  onStart: () => void;
}

export function IntroScreen({ onStart }: IntroScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-lg text-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-gradient-primary">CogOS</span>
          </h1>
          <div className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Cognitive Operating System
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8 font-body text-sm leading-relaxed text-muted-foreground"
        >
          Read behavioral vignettes. Classify thinking styles across
          4&nbsp;cognitive dimensions. Train your pattern recognition for
          understanding how humans think and decide.
        </motion.p>

        {/* Dimensions Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-10 grid grid-cols-2 gap-2"
        >
          {[
            { code: "DR", label: "Reasoning Depth", desc: "Surface → Meta" },
            { code: "SE", label: "Exploration Width", desc: "Single → Divergent" },
            { code: "SR", label: "Reflection Freq", desc: "Rare → Constant" },
            { code: "CV", label: "Convergence Style", desc: "Deadline → Intuition" },
          ].map((dim, i) => (
            <motion.div
              key={dim.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="surface-glass rounded-lg p-3 text-left"
            >
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
                {dim.code}
              </div>
              <div className="text-xs font-medium text-foreground">{dim.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{dim.desc}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tier Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mb-8 flex items-center justify-center gap-4"
        >
          {[
            { label: "Easy", count: 2, color: "text-easy" },
            { label: "Medium", count: 3, color: "text-medium" },
            { label: "Hard", count: 3, color: "text-hard" },
          ].map((tier) => (
            <div key={tier.label} className="text-center">
              <div className={`font-mono text-lg font-bold ${tier.color}`}>{tier.count}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {tier.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onStart}
          className="relative rounded-lg bg-primary px-10 py-3.5 font-mono text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          aria-label="Begin cognitive profiling"
        >
          Begin Profiling
          <span className="ml-2 opacity-60">→</span>
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-4 font-mono text-[10px] text-muted-foreground"
        >
          8 profiles · ~10 min · no account required
        </motion.p>
      </motion.div>
    </div>
  );
}
