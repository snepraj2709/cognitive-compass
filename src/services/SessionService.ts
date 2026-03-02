import { randomUUID } from "crypto";
import type {
  Attempt,
  CVValue,
  DimensionCode,
  DRValue,
  GameSession,
  Profile,
  SEValue,
  SessionStatus,
  SRValue,
  UserStats,
} from "@prisma/client";
import { Difficulty } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  DIFFICULTY_ORDER,
  META_INSIGHT_BY_DIMENSION,
  PROFILE_CACHE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from "@/lib/constants";
import { APIError } from "@/utils/apiError";
import {
  computeSessionAccuracy,
  computeXP,
  identifyStrongDimension,
  identifyWeakDimension,
  scoreAttempt,
  type AttemptSelections,
} from "@/utils/scoring";

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

export interface SessionState {
  sessionId: string;
  guestToken: string | null;
  status: SessionStatus;
  profileIndex: number;
  totalProfiles: number;
  totalScore: number;
  maxScore: number;
  currentProfile: PublicProfile | null;
  completedScores: number[];
  expiresAt: string;
}

export interface SubmitAnswerMetadata {
  clueUsed?: boolean;
  timeTakenMs?: number;
}

export interface SubmitAnswerResult {
  score: {
    total: number;
    breakdown: {
      DR: boolean;
      SE: boolean;
      SR: boolean;
      CV: boolean;
    };
  };
  correct: AttemptSelections;
  selected: AttemptSelections;
  nextProfile: PublicProfile | null;
  isSessionComplete: boolean;
  nextIndex: number;
  profileForFeedback: {
    name: string;
    context: string;
    scenario: string;
    clues: string[];
    answerDR: DRValue;
    answerSE: SEValue;
    answerSR: SRValue;
    answerCV: CVValue;
  };
}

export interface SessionSummary {
  totalScore: number;
  maxScore: number;
  accuracy: number;
  profileResults: Array<{
    profileId: string;
    profileName: string;
    selections: AttemptSelections;
    correctAnswers: AttemptSelections;
    score: {
      DR: boolean;
      SE: boolean;
      SR: boolean;
      CV: boolean;
      total: number;
      maxScore: number;
    };
    feedback: string;
    clueUsed: boolean;
    timeTakenMs: number;
  }>;
  dimensionAccuracy: {
    DR: number;
    SE: number;
    SR: number;
    CV: number;
  };
  weakestDimension: "DR" | "SE" | "SR" | "CV";
  strongestDimension: "DR" | "SE" | "SR" | "CV";
  metaInsight: string;
  xpEarned: number;
}

interface StoredProfile {
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

const PROFILE_CACHE_KEY = "profiles:all";

function toPublicProfile(profile: StoredProfile): PublicProfile {
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    avatar: profile.avatar,
    difficulty: profile.difficulty,
    scenario: profile.scenario,
    context: profile.context,
    clues: profile.clues,
    sortOrder: profile.sortOrder,
  };
}

function getSessionCacheKey(sessionId: string) {
  return `session:${sessionId}`;
}

function sortProfiles(profiles: StoredProfile[]) {
  return [...profiles].sort((a, b) => {
    const difficultyDelta = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    if (difficultyDelta !== 0) {
      return difficultyDelta;
    }
    return a.sortOrder - b.sortOrder;
  });
}

function toDimensionCode(value: "DR" | "SE" | "SR" | "CV"): DimensionCode {
  return value;
}

function isStoredProfileArray(value: unknown): value is StoredProfile[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((profile) => {
    if (!profile || typeof profile !== "object") {
      return false;
    }
    const candidate = profile as Partial<StoredProfile>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.slug === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.answerDR === "string" &&
      typeof candidate.answerSE === "string" &&
      typeof candidate.answerSR === "string" &&
      typeof candidate.answerCV === "string"
    );
  });
}

function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SessionState>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.profileIndex === "number" &&
    typeof candidate.totalProfiles === "number" &&
    typeof candidate.totalScore === "number" &&
    typeof candidate.maxScore === "number" &&
    typeof candidate.expiresAt === "string" &&
    Array.isArray(candidate.completedScores)
  );
}

export class SessionService {
  private static async loadProfiles(): Promise<StoredProfile[]> {
    if (redis) {
      const cached = await redis.get<unknown>(PROFILE_CACHE_KEY);
      if (isStoredProfileArray(cached)) {
        return sortProfiles(cached);
      }
    }

    const profiles = await prisma.profile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        avatar: true,
        difficulty: true,
        scenario: true,
        context: true,
        clues: true,
        sortOrder: true,
        answerDR: true,
        answerSE: true,
        answerSR: true,
        answerCV: true,
      },
    });

    const sorted = sortProfiles(profiles);

    if (redis) {
      await redis.set(PROFILE_CACHE_KEY, sorted, { ex: PROFILE_CACHE_TTL_SECONDS });
    }

    return sorted;
  }

  private static async getProfilesByIds(profileIds: string[]): Promise<StoredProfile[]> {
    const allProfiles = await this.loadProfiles();
    const byId = new Map(allProfiles.map((profile) => [profile.id, profile]));
    const ordered = profileIds
      .map((profileId) => byId.get(profileId))
      .filter((profile): profile is StoredProfile => Boolean(profile));

    if (ordered.length === profileIds.length) {
      return ordered;
    }

    const dbProfiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        slug: true,
        name: true,
        avatar: true,
        difficulty: true,
        scenario: true,
        context: true,
        clues: true,
        sortOrder: true,
        answerDR: true,
        answerSE: true,
        answerSR: true,
        answerCV: true,
      },
    });

    const fallback = new Map(dbProfiles.map((profile) => [profile.id, profile]));
    return profileIds
      .map((profileId) => fallback.get(profileId))
      .filter((profile): profile is StoredProfile => Boolean(profile));
  }

  private static buildSessionState(
    session: Pick<GameSession, "id" | "guestToken" | "status" | "currentIndex" | "totalScore" | "maxScore" | "expiresAt">,
    profiles: StoredProfile[],
    attempts: Array<Pick<Attempt, "totalScore">>
  ): SessionState {
    return {
      sessionId: session.id,
      guestToken: session.guestToken,
      status: session.status,
      profileIndex: session.currentIndex,
      totalProfiles: profiles.length,
      totalScore: session.totalScore,
      maxScore: session.maxScore,
      currentProfile: profiles[session.currentIndex] ? toPublicProfile(profiles[session.currentIndex]) : null,
      completedScores: attempts.map((attempt) => attempt.totalScore),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private static async cacheSession(state: SessionState) {
    if (!redis) {
      return;
    }
    const ttl = Math.max(1, Math.floor((new Date(state.expiresAt).getTime() - Date.now()) / 1000));
    await redis.set(getSessionCacheKey(state.sessionId), state, { ex: ttl });
  }

  private static async refreshSessionCache(sessionId: string) {
    const dbSession = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          select: { totalScore: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!dbSession) {
      return null;
    }

    const profiles = await this.getProfilesByIds(dbSession.profileOrder);
    const state = this.buildSessionState(dbSession, profiles, dbSession.attempts);
    await this.cacheSession(state);
    return state;
  }

  static async createSession(userId?: string, guestToken?: string): Promise<SessionState> {
    const profiles = await this.loadProfiles();

    if (profiles.length === 0) {
      throw new APIError(500, "NO_ACTIVE_PROFILES", "No active profiles are available");
    }

    const finalGuestToken = userId ? null : guestToken ?? randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    const session = await prisma.gameSession.create({
      data: {
        userId,
        guestToken: finalGuestToken,
        status: "ACTIVE",
        profileOrder: profiles.map((profile) => profile.id),
        maxScore: profiles.length * 4,
        expiresAt,
      },
    });

    const state = this.buildSessionState(session, profiles, []);
    await this.cacheSession(state);
    return state;
  }

  static async getSession(sessionId: string): Promise<SessionState | null> {
    if (redis) {
      const cached = await redis.get<unknown>(getSessionCacheKey(sessionId));
      if (isSessionState(cached)) {
        if (new Date(cached.expiresAt).getTime() < Date.now()) {
          await prisma.gameSession.updateMany({
            where: { id: sessionId, status: "ACTIVE" },
            data: { status: "EXPIRED" },
          });
          return {
            ...cached,
            status: "EXPIRED",
          };
        }
        return cached;
      }
    }

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          select: { totalScore: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() < Date.now() && session.status === "ACTIVE") {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      session.status = "EXPIRED";
    }

    const profiles = await this.getProfilesByIds(session.profileOrder);
    const state = this.buildSessionState(session, profiles, session.attempts);
    await this.cacheSession(state);

    return state;
  }

  static async submitAnswer(
    sessionId: string,
    profileId: string,
    selections: AttemptSelections,
    metadata: SubmitAnswerMetadata
  ): Promise<SubmitAnswerResult> {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          where: { profileId },
          select: { id: true },
        },
      },
    });

    if (!session) {
      throw new APIError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      throw new APIError(410, "SESSION_EXPIRED", "Session has expired");
    }

    if (session.status !== "ACTIVE") {
      throw new APIError(409, "SESSION_NOT_ACTIVE", "Session is not active");
    }

    const expectedProfileId = session.profileOrder[session.currentIndex];
    if (expectedProfileId !== profileId) {
      throw new APIError(409, "PROFILE_MISMATCH", "Submitted profile does not match current session index");
    }

    if (session.attempts.length > 0) {
      throw new APIError(409, "DUPLICATE_ATTEMPT", "Attempt already submitted for this profile");
    }

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        slug: true,
        name: true,
        avatar: true,
        difficulty: true,
        scenario: true,
        context: true,
        clues: true,
        sortOrder: true,
        answerDR: true,
        answerSE: true,
        answerSR: true,
        answerCV: true,
      },
    });

    if (!profile) {
      throw new APIError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    const correct: AttemptSelections = {
      DR: profile.answerDR,
      SE: profile.answerSE,
      SR: profile.answerSR,
      CV: profile.answerCV,
    };

    const score = scoreAttempt(selections, correct);
    const nextIndex = session.currentIndex + 1;

    await prisma.$transaction([
      prisma.attempt.create({
        data: {
          sessionId,
          profileId,
          selectionDR: selections.DR,
          selectionSE: selections.SE,
          selectionSR: selections.SR,
          selectionCV: selections.CV,
          scoreDR: score.DR,
          scoreSE: score.SE,
          scoreSR: score.SR,
          scoreCV: score.CV,
          totalScore: score.total,
          clueUsed: metadata.clueUsed ?? false,
          timeTakenMs: metadata.timeTakenMs,
        },
      }),
      prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          currentIndex: nextIndex,
          totalScore: { increment: score.total },
        },
      }),
    ]);

    const sessionProfiles = await this.getProfilesByIds(session.profileOrder);
    const nextProfile = sessionProfiles[nextIndex] ? toPublicProfile(sessionProfiles[nextIndex]) : null;

    await this.refreshSessionCache(sessionId);

    return {
      score: {
        total: score.total,
        breakdown: {
          DR: score.DR,
          SE: score.SE,
          SR: score.SR,
          CV: score.CV,
        },
      },
      correct,
      selected: selections,
      nextProfile,
      isSessionComplete: nextIndex >= session.profileOrder.length,
      nextIndex,
      profileForFeedback: {
        name: profile.name,
        context: profile.context,
        scenario: profile.scenario,
        clues: profile.clues,
        answerDR: profile.answerDR,
        answerSE: profile.answerSE,
        answerSR: profile.answerSR,
        answerCV: profile.answerCV,
      },
    };
  }

  static async saveAttemptFeedback(sessionId: string, profileId: string, feedbackText: string): Promise<void> {
    await prisma.attempt.updateMany({
      where: {
        sessionId,
        profileId,
      },
      data: {
        feedbackText,
      },
    });

    await this.refreshSessionCache(sessionId);
  }

  private static async upsertUserStats(
    userId: string,
    attempts: Array<Pick<Attempt, "scoreDR" | "scoreSE" | "scoreSR" | "scoreCV" | "totalScore">>,
    accuracy: { DR: number; SE: number; SR: number; CV: number }
  ) {
    const existing = await prisma.userStats.findUnique({ where: { userId } });

    const profilesCount = attempts.length;
    const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.totalScore, 0);

    if (!existing) {
      const weakest = identifyWeakDimension(accuracy);
      const strongest = identifyStrongDimension(accuracy);

      await prisma.userStats.create({
        data: {
          userId,
          totalSessions: 1,
          totalProfiles: profilesCount,
          totalCorrect,
          drAccuracy: accuracy.DR,
          seAccuracy: accuracy.SE,
          srAccuracy: accuracy.SR,
          cvAccuracy: accuracy.CV,
          weakestDimension: toDimensionCode(weakest),
          strongestDimension: toDimensionCode(strongest),
        },
      });
      return;
    }

    const weightedProfiles = existing.totalProfiles + profilesCount;
    const drAccuracy = weightedProfiles
      ? (existing.drAccuracy * existing.totalProfiles + accuracy.DR * profilesCount) / weightedProfiles
      : 0;
    const seAccuracy = weightedProfiles
      ? (existing.seAccuracy * existing.totalProfiles + accuracy.SE * profilesCount) / weightedProfiles
      : 0;
    const srAccuracy = weightedProfiles
      ? (existing.srAccuracy * existing.totalProfiles + accuracy.SR * profilesCount) / weightedProfiles
      : 0;
    const cvAccuracy = weightedProfiles
      ? (existing.cvAccuracy * existing.totalProfiles + accuracy.CV * profilesCount) / weightedProfiles
      : 0;

    const mergedAccuracy = {
      DR: drAccuracy,
      SE: seAccuracy,
      SR: srAccuracy,
      CV: cvAccuracy,
    };

    const weakest = identifyWeakDimension(mergedAccuracy);
    const strongest = identifyStrongDimension(mergedAccuracy);

    await prisma.userStats.update({
      where: { userId },
      data: {
        totalSessions: existing.totalSessions + 1,
        totalProfiles: weightedProfiles,
        totalCorrect: existing.totalCorrect + totalCorrect,
        drAccuracy,
        seAccuracy,
        srAccuracy,
        cvAccuracy,
        weakestDimension: toDimensionCode(weakest),
        strongestDimension: toDimensionCode(strongest),
      },
    });
  }

  static async completeSession(sessionId: string): Promise<SessionSummary> {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw new APIError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      throw new APIError(410, "SESSION_EXPIRED", "Session has expired");
    }

    if (session.status !== "COMPLETED") {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    const profiles = await this.getProfilesByIds(session.profileOrder);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    const accuracy = computeSessionAccuracy(session.attempts);
    const weakestDimension = identifyWeakDimension(accuracy);
    const strongestDimension = identifyStrongDimension(accuracy);

    const xpEarned = session.attempts.reduce((sum, attempt) => {
      const profile = profileMap.get(attempt.profileId);
      const difficulty = profile?.difficulty ?? "EASY";
      return sum + computeXP(attempt.totalScore, difficulty, attempt.timeTakenMs ?? 120_000, attempt.clueUsed);
    }, 0);

    if (session.userId) {
      await this.upsertUserStats(session.userId, session.attempts, accuracy);

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (user) {
        const updatedXp = user.xp + xpEarned;
        const level = Math.floor(updatedXp / 100) + 1;
        await prisma.user.update({
          where: { id: session.userId },
          data: {
            xp: updatedXp,
            level,
          },
        });
      }
    }

    const profileResults = session.attempts.map((attempt) => {
      const profile = profileMap.get(attempt.profileId);
      const fallback: StoredProfile = {
        id: attempt.profileId,
        slug: "unknown",
        name: "Unknown Profile",
        avatar: "",
        difficulty: "EASY",
        scenario: "",
        context: "",
        clues: [],
        sortOrder: 0,
        answerDR: "Surface",
        answerSE: "Single",
        answerSR: "Rare",
        answerCV: "Deadline",
      };
      const resolved = profile ?? fallback;

      return {
        profileId: attempt.profileId,
        profileName: resolved.name,
        selections: {
          DR: attempt.selectionDR,
          SE: attempt.selectionSE,
          SR: attempt.selectionSR,
          CV: attempt.selectionCV,
        },
        correctAnswers: {
          DR: resolved.answerDR,
          SE: resolved.answerSE,
          SR: resolved.answerSR,
          CV: resolved.answerCV,
        },
        score: {
          DR: attempt.scoreDR,
          SE: attempt.scoreSE,
          SR: attempt.scoreSR,
          CV: attempt.scoreCV,
          total: attempt.totalScore,
          maxScore: 4,
        },
        feedback: attempt.feedbackText ?? "",
        clueUsed: attempt.clueUsed,
        timeTakenMs: attempt.timeTakenMs ?? 0,
      };
    });

    const summary: SessionSummary = {
      totalScore: session.totalScore,
      maxScore: session.maxScore,
      accuracy: session.maxScore > 0 ? (session.totalScore / session.maxScore) * 100 : 0,
      profileResults,
      dimensionAccuracy: accuracy,
      weakestDimension,
      strongestDimension,
      metaInsight: META_INSIGHT_BY_DIMENSION[weakestDimension],
      xpEarned,
    };

    await this.refreshSessionCache(sessionId);

    return summary;
  }
}
