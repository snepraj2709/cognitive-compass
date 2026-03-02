"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Info } from "lucide-react";
import { motion } from "framer-motion";
import type { DimensionKey, DimensionValue } from "@/types/game";
import {
  COGOS_DR_SHORTCUT_TIP_SEEN_KEY,
  DIMENSION_LABELS,
  DIMENSION_DESCRIPTIONS,
  DIMENSION_OPTIONS,
} from "@/lib/constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DimensionSelectorProps {
  onSelect: (dim: DimensionKey, value: DimensionValue) => void;
  selections: Record<DimensionKey, DimensionValue | null>;
}

export function DimensionSelector({ onSelect, selections }: DimensionSelectorProps) {
  const [showDRShortcutTip, setShowDRShortcutTip] = useState(false);
  const dims: DimensionKey[] = ["DR", "SE", "SR", "CV"];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isTipSeen = window.localStorage.getItem(COGOS_DR_SHORTCUT_TIP_SEEN_KEY) === "1";
    if (!isTipSeen) {
      setShowDRShortcutTip(true);
    }
  }, []);

  const dismissShortcutTip = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COGOS_DR_SHORTCUT_TIP_SEEN_KEY, "1");
    }
    setShowDRShortcutTip(false);
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    dim: DimensionKey,
    value: DimensionValue
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(dim, value);
    }
  };

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
            <div className="mb-1 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-primary">
              <span>
                {dim} — {DIMENSION_LABELS[dim]}
              </span>
              {dim === "DR" && (
                <Tooltip open={showDRShortcutTip} onOpenChange={(open) => !open && dismissShortcutTip()}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={dismissShortcutTip}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 text-primary/80 transition-colors hover:text-primary"
                      aria-label="Reasoning Depth shortcut help"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Press 1-4 to set Reasoning Depth quickly
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {DIMENSION_DESCRIPTIONS[dim]}
            </p>
            <div className="flex flex-col gap-1.5">
              {options.map((opt) => {
                const isSelected = selected === opt.value;
                const optionValue = opt.value as DimensionValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelect(dim, optionValue)}
                    onKeyDown={(event) => handleOptionKeyDown(event, dim, optionValue)}
                    className={`group relative rounded-md px-3 py-2 text-left text-sm transition-all ${
                      isSelected
                        ? "bg-primary/15 text-foreground ring-1 ring-primary/50"
                        : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                    aria-label={`${DIMENSION_LABELS[dim]}: ${opt.label} — ${opt.description}`}
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
