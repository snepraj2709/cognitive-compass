import type { DRValue, SEValue, SRValue, CVValue, DimensionKey } from "@/types/game";

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  DR: "Reasoning Depth",
  SE: "Exploration Width",
  SR: "Reflection Frequency",
  CV: "Convergence Style",
};

export const DIMENSION_SHORT: Record<DimensionKey, string> = {
  DR: "DR",
  SE: "SE",
  SR: "SR",
  CV: "CV",
};

export const DIMENSION_DESCRIPTIONS: Record<DimensionKey, string> = {
  DR: "How many causal links does this person trace?",
  SE: "How many solution paths do they explore?",
  SR: "How often do they reflect on their own thinking?",
  CV: "What triggers their final decision?",
};

export const DR_OPTIONS: { value: DRValue; label: string; description: string }[] = [
  { value: "Surface", label: "Surface", description: "1–2 causal links. Reacts to surface signals." },
  { value: "Intermediate", label: "Intermediate", description: "3–4 causal links. Connects patterns." },
  { value: "Deep", label: "Deep", description: "5+ links, systems thinking." },
  { value: "Meta", label: "Meta", description: "Recursive models. Thinks about thinking." },
];

export const SE_OPTIONS: { value: SEValue; label: string; description: string }[] = [
  { value: "Single", label: "Single", description: "One solution, tests it. Stops early." },
  { value: "DualTrack", label: "Dual-Track", description: "2–3 options before committing." },
  { value: "MultiTrack", label: "Multi-Track", description: "Parallel hypotheses simultaneously." },
  { value: "Divergent", label: "Divergent", description: "Novel, non-obvious search paths." },
];

export const SR_OPTIONS: { value: SRValue; label: string; description: string }[] = [
  { value: "Rare", label: "Rare", description: "Reflects only when externally forced." },
  { value: "Selective", label: "Selective", description: "Reflects when specific triggers occur." },
  { value: "Regular", label: "Regular", description: "Periodic, scheduled self-checks." },
  { value: "Constant", label: "Constant", description: "Real-time metacognitive monitoring." },
];

export const CV_OPTIONS: { value: CVValue; label: string; description: string }[] = [
  { value: "Deadline", label: "Deadline", description: "External pressure forces decision." },
  { value: "Clarity", label: "Clarity", description: "Commits when logical pattern crystallizes." },
  { value: "InfoExhaustion", label: "Info Exhaustion", description: "Commits when data runs out." },
  { value: "Intuition", label: "Intuition", description: "Gut signal drives closure." },
];

export const DIMENSION_OPTIONS = {
  DR: DR_OPTIONS,
  SE: SE_OPTIONS,
  SR: SR_OPTIONS,
  CV: CV_OPTIONS,
} as const;

export const DIFFICULTY_ORDER: Record<string, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

export const XP_BASE: Record<string, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 35,
};
