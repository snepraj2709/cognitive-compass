export type DRValue = "Surface" | "Intermediate" | "Deep" | "Meta";
export type SEValue = "Single" | "DualTrack" | "MultiTrack" | "Divergent";
export type SRValue = "Rare" | "Selective" | "Regular" | "Constant";
export type CVValue = "Deadline" | "Clarity" | "InfoExhaustion" | "Intuition";

export type DimensionKey = "DR" | "SE" | "SR" | "CV";
export type DimensionValue = DRValue | SEValue | SRValue | CVValue;
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface Profile {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  difficulty: Difficulty;
  scenario: string;
  context: string;
  clues: string[];
  sortOrder: number;
  answerDR: DRValue;
  answerSE: SEValue;
  answerSR: SRValue;
  answerCV: CVValue;
}

export interface PublicProfile {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  difficulty: Difficulty;
  scenario: string;
  context: string;
  clues: string[];
  sortOrder: number;
}

export interface DimSelections {
  DR: DRValue | null;
  SE: SEValue | null;
  SR: SRValue | null;
  CV: CVValue | null;
}

export interface ScoreBreakdown {
  DR: boolean;
  SE: boolean;
  SR: boolean;
  CV: boolean;
  total: number;
  maxScore: number;
}

export interface AttemptResult {
  profileId: string;
  profileName: string;
  selections: { DR: DRValue; SE: SEValue; SR: SRValue; CV: CVValue };
  correctAnswers: { DR: DRValue; SE: SEValue; SR: SRValue; CV: CVValue };
  score: ScoreBreakdown;
  feedback: string;
  clueUsed: boolean;
  timeTakenMs: number;
}

export interface DimensionAccuracy {
  DR: number;
  SE: number;
  SR: number;
  CV: number;
}

export interface SessionSummary {
  totalScore: number;
  maxScore: number;
  accuracy: number;
  profileResults: AttemptResult[];
  dimensionAccuracy: DimensionAccuracy;
  weakestDimension: DimensionKey;
  strongestDimension: DimensionKey;
  metaInsight: string;
  xpEarned: number;
}

export interface SessionStateResponse {
  sessionId: string;
  guestToken: string | null;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  profileIndex: number;
  totalProfiles: number;
  totalScore: number;
  maxScore: number;
  currentProfile: PublicProfile | null;
  completedScores: number[];
  expiresAt: string;
}

export type GameStatus =
  | "IDLE"
  | "RESTORING"
  | "PLAYING"
  | "SUBMITTING"
  | "FEEDBACK"
  | "COMPLETE";
