"use client";

import { motion } from "framer-motion";
import type { DimensionKey, DimensionValue } from "@/types/game";
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS, DIMENSION_OPTIONS } from "@/lib/constants";

interface DimensionSelectorProps {
  onSelect: (dim: DimensionKey, value: DimensionValue) => void;
  selections: Record<DimensionKey, DimensionValue | null>;
}

export function DimensionSelector({ onSelect, selections }: DimensionSelectorProps) {
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {dims.map((dim, dimIndex) => {
        const options = DIMENSION_OPTIONS[dim];
        const selected = selections[dim];

        return (
          <motion.div
            key={dim}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: dimIndex * 0.05 }}
            className="surface-glass rounded-lg p-4"
          >
            <div className="mb-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-primary">
              {dim} — {DIMENSION_LABELS[dim]}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {DIMENSION_DESCRIPTIONS[dim]}
            </p>
            <div className="flex flex-col gap-1.5">
              {options.map((opt) => {
                const isSelected = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onSelect(dim, opt.value as DimensionValue)}
                    className={`group relative rounded-md px-3 py-2 text-left text-sm transition-all ${
                      isSelected
                        ? "bg-primary/15 text-foreground ring-1 ring-primary/50"
                        : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                    aria-label={`${DIMENSION_LABELS[dim]}: ${opt.label}`}
                    aria-pressed={isSelected}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="ml-2 text-xs opacity-60">{opt.description}</span>
                    {isSelected && (
                      <motion.div
                        layoutId={`sel-${dim}`}
                        className="absolute inset-0 rounded-md ring-1 ring-primary/50"
                        transition={{ type: "spring", duration: 0.3 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
