import { randomUUID } from "crypto";
import type {
  Attempt,
  CVValue,
  DRValue,
  GameSession,
  Profile,
  SEValue,
  SRValue,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { del, get, setEx } from "@/lib/redis";
import {
  DIFFICULTY_ORDER,
  META_INSIGHT_BY_DIMENSION,
  PROFILE_CACHE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  type DimSelections,
  type DimensionKey,
} from "@/lib/constants";
import type { PublicProfile, SessionStateResponse, SessionSummary } from "@/types/game";
import {
  APIError,
  PROFILE_ALREADY_ANSWERED,
  SESSION_ALREADY_COMPLETE,
  SESSION_EXPIRED,
  SESSION_NOT_FOUND,
} from "@/utils/apiError";
import {
  computeSessionAccuracy,
  computeXP,
  identifyStrongDimension,
  identifyWeakDimension,
  scoreAttempt,
  type ScoreBreakdown,
} from "@/utils/scoring";

interface CachedProfile extends Omit<Profile, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

interface CachedSession extends Omit<GameSession, "startedAt" | "completedAt" | "expiresAt" | "createdAt" | "updatedAt"> {
  startedAt: string;
  completedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionAttemptForStats {
  scoreDR: boolean;
  scoreSE: boolean;
  scoreSR: boolean;
  scoreCV: boolean;
  totalScore: number;
}

const PROFILE_CACHE_KEY = "profiles:all";
const SESSION_CACHE_PREFIX = "session:";

function getSessionCacheKey(sessionId: string): string {
  return `${SESSION_CACHE_PREFIX}${sessionId}`;
}

function isProfile(value: unknown): value is CachedProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CachedProfile>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.slug === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.difficulty === "string" &&
    Array.isArray(candidate.clues)
  );
}

function fromCachedProfile(cached: CachedProfile): Profile {
  return {
    ...cached,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
  };
}

function parseProfilesCache(raw: string | null): Profile[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isProfile)) {
      return null;
    }

    return parsed.map(fromCachedProfile);
  } catch {
    return null;
  }
}

function isCachedSession(value: unknown): value is CachedSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CachedSession>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.profileOrder) &&
    typeof candidate.currentIndex === "number" &&
    typeof candidate.expiresAt === "string"
  );
}

function fromCachedSession(cached: CachedSession): GameSession {
  return {
    ...cached,
    startedAt: new Date(cached.startedAt),
    completedAt: cached.completedAt ? new Date(cached.completedAt) : null,
    expiresAt: new Date(cached.expiresAt),
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
  };
}

function parseSessionCache(raw: string | null): GameSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isCachedSession(parsed)) {
      return null;
    }

    return fromCachedSession(parsed);
  } catch {
    return null;
  }
}

function sortProfiles(profiles: Profile[]): Profile[] {
  return [...profiles].sort((a, b) => {
    const difficultyDelta = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    if (difficultyDelta !== 0) {
      return difficultyDelta;
    }
    return a.sortOrder - b.sortOrder;
  });
}

function mapProfileToSelections(profile: Profile): DimSelections {
  return {
    DR: profile.answerDR,
    SE: profile.answerSE,
    SR: profile.answerSR,
    CV: profile.answerCV,
  };
}

function ensureSelection(value: string | null, dimension: DimensionKey): string {
  if (!value) {
    throw new APIError("INVALID_SELECTIONS", `Missing ${dimension} selection`, 422);
  }

  return value;
}

export class SessionService {
  static toPublicProfile(profile: Profile): PublicProfile {
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

  private static async cacheSession(session: GameSession): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    await setEx(getSessionCacheKey(session.id), JSON.stringify(session), ttlSeconds);
  }

  private static async getProfiles(): Promise<Profile[]> {
    const cachedProfiles = parseProfilesCache(await get(PROFILE_CACHE_KEY));
    if (cachedProfiles) {
      return sortProfiles(cachedProfiles);
    }

    const profiles = await prisma.profile.findMany({
      where: { isActive: true },
    });

    const sorted = sortProfiles(profiles);
    await setEx(PROFILE_CACHE_KEY, JSON.stringify(sorted), PROFILE_CACHE_TTL_SECONDS);
    return sorted;
  }

  static async getProfileById(profileId: string): Promise<Profile | null> {
    const profiles = await this.getProfiles();
    const fromCache = profiles.find((profile) => profile.id === profileId);
    if (fromCache) {
      return fromCache;
    }

    return prisma.profile.findUnique({ where: { id: profileId } });
  }

  private static async getProfilesByIds(profileIds: string[]): Promise<Profile[]> {
    const profiles = await this.getProfiles();
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const ordered = profileIds
      .map((profileId) => profileMap.get(profileId))
      .filter((profile): profile is Profile => Boolean(profile));

    if (ordered.length === profileIds.length) {
      return ordered;
    }

    const dbProfiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
    });

    const dbMap = new Map(dbProfiles.map((profile) => [profile.id, profile]));
    return profileIds
      .map((profileId) => dbMap.get(profileId))
      .filter((profile): profile is Profile => Boolean(profile));
  }

  static async createSession(
    userId?: string,
    guestToken?: string
  ): Promise<{ session: GameSession; firstProfile: Profile }> {
    const profiles = await this.getProfiles();
    if (profiles.length === 0) {
      throw new APIError("NO_ACTIVE_PROFILES", "No active profiles available", 500);
    }

    const firstProfile = profiles[0];
    if (!firstProfile) {
      throw new APIError("NO_ACTIVE_PROFILES", "No active profiles available", 500);
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const session = await prisma.gameSession.create({
      data: {
        userId: userId ?? null,
        guestToken: userId ? null : guestToken ?? randomUUID(),
        status: "ACTIVE",
        profileOrder: profiles.map((profile) => profile.id),
        currentIndex: 0,
        totalScore: 0,
        maxScore: profiles.length * 4,
        expiresAt,
      },
    });

    await this.cacheSession(session);
    return { session, firstProfile };
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    const cached = parseSessionCache(await get(getSessionCacheKey(sessionId)));
    if (cached) {
      if (cached.status === "EXPIRED") {
        return null;
      }

      if (cached.status === "ACTIVE" && cached.expiresAt.getTime() < Date.now()) {
        await prisma.gameSession.updateMany({
          where: { id: sessionId, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        await del(getSessionCacheKey(sessionId));
        return null;
      }

      return cached;
    }

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    if (session.status === "EXPIRED") {
      return null;
    }

    if (session.status === "ACTIVE" && session.expiresAt.getTime() < Date.now()) {
      await prisma.gameSession.updateMany({
        where: { id: sessionId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      return null;
    }

    await this.cacheSession(session);
    return session;
  }

  static async isSessionExpired(sessionId: string): Promise<boolean> {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, expiresAt: true },
    });

    if (!session) {
      return false;
    }

    if (session.status === "EXPIRED") {
      return true;
    }

    if (session.status === "ACTIVE" && session.expiresAt.getTime() < Date.now()) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      await del(getSessionCacheKey(sessionId));
      return true;
    }

    return false;
  }

  static async getCurrentProfile(session: GameSession): Promise<Profile | null> {
    const profileId = session.profileOrder[session.currentIndex];
    if (!profileId) {
      return null;
    }

    return this.getProfileById(profileId);
  }

  static async submitAnswer(
    sessionId: string,
    profileId: string,
    selections: DimSelections,
    metadata: { clueUsed: boolean; timeTakenMs: number }
  ): Promise<{ scoreBreakdown: ScoreBreakdown; isLastProfile: boolean }> {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new APIError(SESSION_NOT_FOUND.code, "Session not found", SESSION_NOT_FOUND.statusCode);
    }

    if (session.status === "EXPIRED") {
      throw new APIError(SESSION_EXPIRED.code, "Session has expired", SESSION_EXPIRED.statusCode);
    }

    if (session.status === "ACTIVE" && session.expiresAt.getTime() < Date.now()) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      await del(getSessionCacheKey(sessionId));
      throw new APIError(SESSION_EXPIRED.code, "Session has expired", SESSION_EXPIRED.statusCode);
    }

    if (session.status !== "ACTIVE") {
      throw new APIError(
        SESSION_ALREADY_COMPLETE.code,
        "Session is not active",
        SESSION_ALREADY_COMPLETE.statusCode
      );
    }

    const expectedProfileId = session.profileOrder[session.currentIndex];
    if (expectedProfileId !== profileId) {
      throw new APIError("PROFILE_MISMATCH", "Submitted profile does not match current profile", 409);
    }

    const existingAttempt = await prisma.attempt.findUnique({
      where: {
        sessionId_profileId: {
          sessionId,
          profileId,
        },
      },
    });

    if (existingAttempt) {
      throw new APIError(
        PROFILE_ALREADY_ANSWERED.code,
        "Attempt already submitted for this profile",
        PROFILE_ALREADY_ANSWERED.statusCode
      );
    }

    const profile = await this.getProfileById(profileId);
    if (!profile) {
      throw new APIError("PROFILE_NOT_FOUND", "Profile not found", 404);
    }

    const normalizedSelections = {
      DR: ensureSelection(selections.DR, "DR") as DRValue,
      SE: ensureSelection(selections.SE, "SE") as SEValue,
      SR: ensureSelection(selections.SR, "SR") as SRValue,
      CV: ensureSelection(selections.CV, "CV") as CVValue,
    };

    const correctSelections = mapProfileToSelections(profile);
    const scoreBreakdown = scoreAttempt(normalizedSelections, correctSelections);
    const isLastProfile = session.currentIndex + 1 >= session.profileOrder.length;

    computeXP(scoreBreakdown.total, profile.difficulty, metadata.timeTakenMs, metadata.clueUsed);

    await prisma.$transaction([
      prisma.attempt.create({
        data: {
          sessionId,
          profileId,
          selectionDR: normalizedSelections.DR,
          selectionSE: normalizedSelections.SE,
          selectionSR: normalizedSelections.SR,
          selectionCV: normalizedSelections.CV,
          scoreDR: scoreBreakdown.DR,
          scoreSE: scoreBreakdown.SE,
          scoreSR: scoreBreakdown.SR,
          scoreCV: scoreBreakdown.CV,
          totalScore: scoreBreakdown.total,
          clueUsed: metadata.clueUsed,
          timeTakenMs: metadata.timeTakenMs,
        },
      }),
      prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          totalScore: { increment: scoreBreakdown.total },
          currentIndex: { increment: 1 },
        },
      }),
    ]);

    const updatedSession = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (updatedSession) {
      await this.cacheSession(updatedSession);
    }

    return { scoreBreakdown, isLastProfile };
  }

  static async saveAttemptFeedback(sessionId: string, profileId: string, feedbackText: string): Promise<void> {
    await prisma.attempt.updateMany({
      where: { sessionId, profileId },
      data: { feedbackText },
    });
  }

  private static async updateUserStats(
    userId: string,
    attempts: SessionAttemptForStats[],
    sessionAccuracy: { DR: number; SE: number; SR: number; CV: number }
  ): Promise<void> {
    const existing = await prisma.userStats.findUnique({
      where: { userId },
    });

    const profileCount = attempts.length;
    const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.totalScore, 0);

    if (!existing) {
      await prisma.userStats.create({
        data: {
          userId,
          totalSessions: 1,
          totalProfiles: profileCount,
          totalCorrect,
          drAccuracy: sessionAccuracy.DR,
          seAccuracy: sessionAccuracy.SE,
          srAccuracy: sessionAccuracy.SR,
          cvAccuracy: sessionAccuracy.CV,
          weakestDimension: identifyWeakDimension(sessionAccuracy),
          strongestDimension: identifyStrongDimension(sessionAccuracy),
        },
      });
      return;
    }

    const nextProfiles = existing.totalProfiles + profileCount;

    const mergedAccuracy = {
      DR: nextProfiles
        ? (existing.drAccuracy * existing.totalProfiles + sessionAccuracy.DR * profileCount) / nextProfiles
        : 0,
      SE: nextProfiles
        ? (existing.seAccuracy * existing.totalProfiles + sessionAccuracy.SE * profileCount) / nextProfiles
        : 0,
      SR: nextProfiles
        ? (existing.srAccuracy * existing.totalProfiles + sessionAccuracy.SR * profileCount) / nextProfiles
        : 0,
      CV: nextProfiles
        ? (existing.cvAccuracy * existing.totalProfiles + sessionAccuracy.CV * profileCount) / nextProfiles
        : 0,
    };

    await prisma.userStats.update({
      where: { userId },
      data: {
        totalSessions: existing.totalSessions + 1,
        totalProfiles: nextProfiles,
        totalCorrect: existing.totalCorrect + totalCorrect,
        drAccuracy: mergedAccuracy.DR,
        seAccuracy: mergedAccuracy.SE,
        srAccuracy: mergedAccuracy.SR,
        cvAccuracy: mergedAccuracy.CV,
        weakestDimension: identifyWeakDimension(mergedAccuracy),
        strongestDimension: identifyStrongDimension(mergedAccuracy),
      },
    });
  }

  static async completeSession(sessionId: string): Promise<SessionSummary> {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new APIError(SESSION_NOT_FOUND.code, "Session not found", SESSION_NOT_FOUND.statusCode);
    }

    if (session.status === "ACTIVE" && session.expiresAt.getTime() < Date.now()) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      await del(getSessionCacheKey(sessionId));
      throw new APIError(SESSION_EXPIRED.code, "Session has expired", SESSION_EXPIRED.statusCode);
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

    const attempts = await prisma.attempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    const profiles = await this.getProfilesByIds(session.profileOrder);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    const scoreBreakdowns = attempts.map((attempt) => ({
      DR: attempt.scoreDR,
      SE: attempt.scoreSE,
      SR: attempt.scoreSR,
      CV: attempt.scoreCV,
      total: attempt.totalScore,
    }));

    const dimensionAccuracy = computeSessionAccuracy(scoreBreakdowns);
    const weakestDimension = identifyWeakDimension(dimensionAccuracy);
    const strongestDimension = identifyStrongDimension(dimensionAccuracy);

    const xpEarned = attempts.reduce((sum, attempt) => {
      const profile = profileMap.get(attempt.profileId);
      if (!profile) {
        return sum;
      }

      return (
        sum +
        computeXP(
          attempt.totalScore,
          profile.difficulty,
          attempt.timeTakenMs ?? 120_000,
          attempt.clueUsed
        )
      );
    }, 0);

    if (session.userId) {
      await this.updateUserStats(session.userId, attempts, dimensionAccuracy);

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, xp: true },
      });

      if (user) {
        const nextXp = user.xp + xpEarned;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            xp: nextXp,
            level: Math.floor(nextXp / 100) + 1,
          },
        });
      }
    }

    const profileResults = attempts.map((attempt) => {
      const profile = profileMap.get(attempt.profileId);
      if (!profile) {
        throw new APIError("PROFILE_NOT_FOUND", "Profile data missing for attempt summary", 500);
      }

      return {
        profileId: attempt.profileId,
        profileName: profile.name,
        selections: {
          DR: attempt.selectionDR,
          SE: attempt.selectionSE,
          SR: attempt.selectionSR,
          CV: attempt.selectionCV,
        },
        correctAnswers: {
          DR: profile.answerDR,
          SE: profile.answerSE,
          SR: profile.answerSR,
          CV: profile.answerCV,
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
      dimensionAccuracy,
      weakestDimension,
      strongestDimension,
      metaInsight: META_INSIGHT_BY_DIMENSION[weakestDimension],
      xpEarned,
    };

    await del(getSessionCacheKey(sessionId));
    return summary;
  }

  static async toSessionStateResponse(session: GameSession): Promise<SessionStateResponse> {
    const currentProfile = await this.getCurrentProfile(session);
    const attempts = await prisma.attempt.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: { totalScore: true },
    });

    return {
      sessionId: session.id,
      guestToken: session.guestToken,
      status: session.status,
      profileIndex: session.currentIndex,
      totalProfiles: session.profileOrder.length,
      totalScore: session.totalScore,
      maxScore: session.maxScore,
      currentProfile: currentProfile ? this.toPublicProfile(currentProfile) : null,
      completedScores: attempts.map((attempt) => attempt.totalScore),
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}
