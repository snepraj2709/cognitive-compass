export const DR_VALUES = ["Surface", "Intermediate", "Deep", "Meta"] as const;
export const SE_VALUES = ["Single", "DualTrack", "MultiTrack", "Divergent"] as const;
export const SR_VALUES = ["Rare", "Selective", "Regular", "Constant"] as const;
export const CV_VALUES = ["Deadline", "Clarity", "InfoExhaustion", "Intuition"] as const;

export const DIMENSION_KEYS = ["DR", "SE", "SR", "CV"] as const;
export const DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;

export type DRValue = typeof DR_VALUES[number];
export type SEValue = typeof SE_VALUES[number];
export type SRValue = typeof SR_VALUES[number];
export type CVValue = typeof CV_VALUES[number];
export type DimensionKey = typeof DIMENSION_KEYS[number];
export type DimSelections = Record<DimensionKey, string | null>;
export type Difficulty = typeof DIFFICULTY_LEVELS[number];

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

export const DR_OPTIONS: Array<{ value: DRValue; label: string; description: string }> = [
  { value: "Surface", label: "Surface", description: "1-2 causal links. Reacts to surface signals." },
  { value: "Intermediate", label: "Intermediate", description: "3-4 causal links. Connects patterns." },
  { value: "Deep", label: "Deep", description: "5+ links, systems thinking." },
  { value: "Meta", label: "Meta", description: "Recursive models. Thinks about thinking." },
];

export const SE_OPTIONS: Array<{ value: SEValue; label: string; description: string }> = [
  { value: "Single", label: "Single", description: "One solution, tests it. Stops early." },
  { value: "DualTrack", label: "Dual-Track", description: "2-3 options before committing." },
  { value: "MultiTrack", label: "Multi-Track", description: "Parallel hypotheses simultaneously." },
  { value: "Divergent", label: "Divergent", description: "Novel, non-obvious search paths." },
];

export const SR_OPTIONS: Array<{ value: SRValue; label: string; description: string }> = [
  { value: "Rare", label: "Rare", description: "Reflects only when externally forced." },
  { value: "Selective", label: "Selective", description: "Reflects when specific triggers occur." },
  { value: "Regular", label: "Regular", description: "Periodic, scheduled self-checks." },
  { value: "Constant", label: "Constant", description: "Real-time metacognitive monitoring." },
];

export const CV_OPTIONS: Array<{ value: CVValue; label: string; description: string }> = [
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

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

export const SESSION_TTL_SECONDS = 7200;
export const PROFILE_CACHE_TTL_SECONDS = 86_400;
export const MAX_FEEDBACK_TOKENS = 1000;
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 10;

export const XP_BASE: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 35,
};

export const RATE_LIMIT = {
  CREATE_SESSION_PER_MINUTE: 20,
  GET_SESSION_PER_MINUTE: 60,
  SUBMIT_PER_MINUTE: 45,
  COMPLETE_PER_MINUTE: 20,
} as const;

export const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
export const COGOS_SESSION_STORAGE_KEY = "cogos:sessionId";
export const COGOS_DR_SHORTCUT_TIP_SEEN_KEY = "cogos:drShortcutTipSeen";

export const META_INSIGHT_BY_DIMENSION: Record<DimensionKey, string> = {
  CV: "Convergence Style is your blind spot. Watch for somatic language: 'feel', 'sense', 'gut', 'instinct' signals Intuition. 'pattern finally clicked' signals Clarity. External pressure signals Deadline.",
  DR: "Reasoning Depth trips you up most. Count causal links explicitly: how many 'because' or 'therefore' steps are in the thinking? Meta thinkers describe the rules they use to make rules.",
  SE: "Exploration Width is where you lose points. Look for how many options they generate before deciding — Single stops at 1, Divergent generates novel paths not in the original problem space.",
  SR: "Reflection Frequency is subtle. Rare = only when crisis hits. Selective = pattern-triggered. Regular = scheduled. Constant = real-time, happening mid-decision, not just after.",
};
