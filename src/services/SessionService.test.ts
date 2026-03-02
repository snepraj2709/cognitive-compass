import { afterEach, describe, expect, it, vi } from "vitest";
import type { Attempt, CVValue, DRValue, Difficulty, GameSession, Profile, SEValue, SRValue, SessionStatus } from "@prisma/client";

function createProfile(id: string, difficulty: Difficulty, sortOrder: number): Profile {
  return {
    id,
    slug: id,
    name: id,
    avatar: "avatar",
    difficulty,
    scenario: `scenario-${id}`,
    context: `context-${id}`,
    clues: [`clue-${id}`],
    answerDR: "Surface",
    answerSE: "Single",
    answerSR: "Rare",
    answerCV: "Deadline",
    isActive: true,
    sortOrder,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  };
}

function createSession(overrides: Partial<GameSession>): GameSession {
  return {
    id: "session-1",
    userId: null,
    guestToken: "guest-1",
    status: "ACTIVE",
    profileOrder: ["easy-1", "medium-1", "hard-1"],
    currentIndex: 0,
    totalScore: 0,
    maxScore: 12,
    startedAt: new Date("2026-03-02T10:00:00.000Z"),
    completedAt: null,
    expiresAt: new Date("2026-03-02T12:00:00.000Z"),
    createdAt: new Date("2026-03-02T10:00:00.000Z"),
    updatedAt: new Date("2026-03-02T10:00:00.000Z"),
    ...overrides,
  };
}

function createAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    profileId: "easy-1",
    selectionDR: "Surface",
    selectionSE: "Single",
    selectionSR: "Rare",
    selectionCV: "Deadline",
    scoreDR: true,
    scoreSE: true,
    scoreSR: true,
    scoreCV: true,
    totalScore: 4,
    feedbackText: null,
    clueUsed: false,
    timeTakenMs: 25_000,
    createdAt: new Date("2026-03-02T10:01:00.000Z"),
    ...overrides,
  };
}

type MockFn = ReturnType<typeof vi.fn>;

interface PrismaMock {
  profile: {
    findMany: MockFn;
    findUnique: MockFn;
  };
  gameSession: {
    create: MockFn;
    findUnique: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  attempt: {
    findUnique: MockFn;
    create: MockFn;
    updateMany: MockFn;
    findMany: MockFn;
  };
  userStats: {
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
  };
  user: {
    findUnique: MockFn;
    update: MockFn;
  };
  $transaction: MockFn;
}

interface SessionServiceTestHarness {
  SessionService: typeof import("@/services/SessionService").SessionService;
  prisma: PrismaMock;
  redisGet: MockFn;
  redisSetEx: MockFn;
  redisDel: MockFn;
}

async function setupHarness(): Promise<SessionServiceTestHarness> {
  vi.resetModules();

  const redisGet = vi.fn();
  const redisSetEx = vi.fn();
  const redisDel = vi.fn();

  const prisma: PrismaMock = {
    profile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    gameSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    attempt: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  vi.doMock("@/lib/redis", () => ({
    redis: {},
    get: redisGet,
    setEx: redisSetEx,
    del: redisDel,
    incr: vi.fn(),
    expire: vi.fn(),
  }));

  vi.doMock("@/lib/prisma", () => ({
    prisma,
  }));

  const { SessionService } = await import("@/services/SessionService");
  return { SessionService, prisma, redisGet, redisSetEx, redisDel };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("SessionService", () => {
  it("creates session with EASY -> MEDIUM -> HARD profile order and caches session", async () => {
    const { SessionService, prisma, redisGet, redisSetEx } = await setupHarness();

    const easy1 = createProfile("easy-1", "EASY", 1);
    const easy2 = createProfile("easy-2", "EASY", 2);
    const medium = createProfile("medium-1", "MEDIUM", 1);
    const hard = createProfile("hard-1", "HARD", 1);

    redisGet.mockResolvedValue(null);
    prisma.profile.findMany.mockResolvedValue([hard, medium, easy2, easy1]);

    const createdSession = createSession({
      id: "session-abc",
      profileOrder: ["easy-1", "easy-2", "medium-1", "hard-1"],
      maxScore: 16,
    });
    prisma.gameSession.create.mockResolvedValue(createdSession);

    const result = await SessionService.createSession();

    expect(result.firstProfile.id).toBe("easy-1");
    expect(prisma.gameSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileOrder: ["easy-1", "easy-2", "medium-1", "hard-1"],
        }),
      })
    );
    expect(redisSetEx).toHaveBeenCalledWith("profiles:all", expect.any(String), 86_400);
    expect(redisSetEx).toHaveBeenCalledWith("session:session-abc", expect.any(String), expect.any(Number));
  });

  it("rejects duplicate profile submission", async () => {
    const { SessionService, prisma } = await setupHarness();

    prisma.gameSession.findUnique.mockResolvedValue(
      createSession({
        profileOrder: ["profile-1"],
        currentIndex: 0,
      })
    );

    prisma.attempt.findUnique.mockResolvedValue(createAttempt({ profileId: "profile-1" }));

    await expect(
      SessionService.submitAnswer(
        "session-1",
        "profile-1",
        {
          DR: "Surface",
          SE: "Single",
          SR: "Rare",
          CV: "Deadline",
        },
        { clueUsed: false, timeTakenMs: 1000 }
      )
    ).rejects.toMatchObject({ code: "PROFILE_ALREADY_ANSWERED" });
  });

  it("submits answer, increments index, and returns score breakdown", async () => {
    const { SessionService, prisma, redisGet, redisSetEx } = await setupHarness();

    const profile = createProfile("easy-1", "EASY", 1);
    const nextProfile = createProfile("easy-2", "EASY", 2);
    redisGet.mockResolvedValue(JSON.stringify([profile, nextProfile]));

    prisma.gameSession.findUnique
      .mockResolvedValueOnce(
        createSession({
          profileOrder: ["easy-1", "easy-2"],
          currentIndex: 0,
          totalScore: 0,
          maxScore: 8,
        })
      )
      .mockResolvedValueOnce(
        createSession({
          profileOrder: ["easy-1", "easy-2"],
          currentIndex: 1,
          totalScore: 3,
          maxScore: 8,
        })
      );

    prisma.attempt.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([]);

    const result = await SessionService.submitAnswer(
      "session-1",
      "easy-1",
      {
        DR: "Surface",
        SE: "Single",
        SR: "Rare",
        CV: "Clarity",
      },
      { clueUsed: true, timeTakenMs: 45_000 }
    );

    expect(result).toEqual({
      scoreBreakdown: {
        DR: true,
        SE: true,
        SR: true,
        CV: false,
        total: 3,
      },
      isLastProfile: false,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(redisSetEx).toHaveBeenCalledWith("session:session-1", expect.any(String), expect.any(Number));
  });

  it("completes session, updates stats, and invalidates cache", async () => {
    const { SessionService, prisma, redisGet, redisDel } = await setupHarness();

    const easy = createProfile("easy-1", "EASY", 1);
    const medium = createProfile("medium-1", "MEDIUM", 2);
    redisGet.mockResolvedValue(JSON.stringify([easy, medium]));

    const completedSession = createSession({
      userId: "user-1",
      profileOrder: ["easy-1", "medium-1"],
      totalScore: 5,
      maxScore: 8,
      status: "ACTIVE" as SessionStatus,
    });

    prisma.gameSession.findUnique.mockResolvedValue(completedSession);
    prisma.gameSession.update.mockResolvedValue({
      ...completedSession,
      status: "COMPLETED" as SessionStatus,
      completedAt: new Date("2026-03-02T11:00:00.000Z"),
    });

    prisma.attempt.findMany.mockResolvedValue([
      createAttempt({
        id: "attempt-1",
        profileId: "easy-1",
        scoreDR: true,
        scoreSE: false,
        scoreSR: true,
        scoreCV: true,
        totalScore: 3,
      }),
      createAttempt({
        id: "attempt-2",
        profileId: "medium-1",
        scoreDR: true,
        scoreSE: false,
        scoreSR: false,
        scoreCV: true,
        totalScore: 2,
      }),
    ]);

    prisma.userStats.findUnique.mockResolvedValue(null);
    prisma.userStats.create.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", xp: 50 });
    prisma.user.update.mockResolvedValue(undefined);

    const summary = await SessionService.completeSession("session-1");

    expect(summary.totalScore).toBe(5);
    expect(summary.maxScore).toBe(8);
    expect(summary.weakestDimension).toBe("SE");
    expect(summary.strongestDimension).toBe("DR");
    expect(summary.metaInsight).toBe(
      "Exploration Width is where you lose points. Look for how many options they generate before deciding — Single stops at 1, Divergent generates novel paths not in the original problem space."
    );
    expect(prisma.userStats.create).toHaveBeenCalledTimes(1);
    expect(redisDel).toHaveBeenCalledWith("session:session-1");
  });
});
