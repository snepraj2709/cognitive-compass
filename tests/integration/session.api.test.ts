import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

interface CreateSessionResponse {
  sessionId: string;
  guestToken: string | null;
  currentProfile: {
    id: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    scenario: string;
  };
  totalProfiles: number;
  profileIndex: number;
  completedScores: number[];
}

interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

function parseSseEvents(body: string): ParsedSseEvent[] {
  return body
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const eventLine = block
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('event:'));
      const dataLine = block
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('data:'));

      if (!eventLine || !dataLine) {
        throw new Error(`Invalid SSE block: ${block}`);
      }

      return {
        event: eventLine.slice('event:'.length).trim(),
        data: JSON.parse(dataLine.slice('data:'.length).trim()) as unknown,
      };
    });
}

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getPrismaClient(url: string | undefined): PrismaClient | null {
  if (!url) {
    return null;
  }

  return new PrismaClient({
    datasourceUrl: url,
  });
}

function ensurePrisma(prisma: PrismaClient | null): PrismaClient {
  if (!prisma) {
    throw new Error('TEST_DATABASE_URL is required for integration tests.');
  }
  return prisma;
}

function buildProfiles() {
  return [
    {
      id: 'test-easy-1',
      slug: 'test-easy-1',
      name: 'Test Easy 1',
      avatar: 'A',
      difficulty: 'EASY' as const,
      scenario: 'Scenario 1',
      context: 'Context',
      clues: ['clue-1'],
      answerDR: 'Surface' as const,
      answerSE: 'Single' as const,
      answerSR: 'Rare' as const,
      answerCV: 'Deadline' as const,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'test-easy-2',
      slug: 'test-easy-2',
      name: 'Test Easy 2',
      avatar: 'B',
      difficulty: 'EASY' as const,
      scenario: 'Scenario 2',
      context: 'Context',
      clues: ['clue-2'],
      answerDR: 'Surface' as const,
      answerSE: 'Single' as const,
      answerSR: 'Rare' as const,
      answerCV: 'Deadline' as const,
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'test-medium-1',
      slug: 'test-medium-1',
      name: 'Test Medium 1',
      avatar: 'C',
      difficulty: 'MEDIUM' as const,
      scenario: 'Scenario 3',
      context: 'Context',
      clues: ['clue-3'],
      answerDR: 'Intermediate' as const,
      answerSE: 'DualTrack' as const,
      answerSR: 'Selective' as const,
      answerCV: 'Clarity' as const,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'test-medium-2',
      slug: 'test-medium-2',
      name: 'Test Medium 2',
      avatar: 'D',
      difficulty: 'MEDIUM' as const,
      scenario: 'Scenario 4',
      context: 'Context',
      clues: ['clue-4'],
      answerDR: 'Intermediate' as const,
      answerSE: 'DualTrack' as const,
      answerSR: 'Selective' as const,
      answerCV: 'Clarity' as const,
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'test-medium-3',
      slug: 'test-medium-3',
      name: 'Test Medium 3',
      avatar: 'E',
      difficulty: 'MEDIUM' as const,
      scenario: 'Scenario 5',
      context: 'Context',
      clues: ['clue-5'],
      answerDR: 'Intermediate' as const,
      answerSE: 'DualTrack' as const,
      answerSR: 'Selective' as const,
      answerCV: 'Clarity' as const,
      isActive: true,
      sortOrder: 3,
    },
    {
      id: 'test-hard-1',
      slug: 'test-hard-1',
      name: 'Test Hard 1',
      avatar: 'F',
      difficulty: 'HARD' as const,
      scenario: 'Scenario 6',
      context: 'Context',
      clues: ['clue-6'],
      answerDR: 'Deep' as const,
      answerSE: 'MultiTrack' as const,
      answerSR: 'Regular' as const,
      answerCV: 'InfoExhaustion' as const,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'test-hard-2',
      slug: 'test-hard-2',
      name: 'Test Hard 2',
      avatar: 'G',
      difficulty: 'HARD' as const,
      scenario: 'Scenario 7',
      context: 'Context',
      clues: ['clue-7'],
      answerDR: 'Deep' as const,
      answerSE: 'MultiTrack' as const,
      answerSR: 'Regular' as const,
      answerCV: 'InfoExhaustion' as const,
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'test-hard-3',
      slug: 'test-hard-3',
      name: 'Test Hard 3',
      avatar: 'H',
      difficulty: 'HARD' as const,
      scenario: 'Scenario 8',
      context: 'Context',
      clues: ['clue-8'],
      answerDR: 'Deep' as const,
      answerSE: 'MultiTrack' as const,
      answerSR: 'Regular' as const,
      answerCV: 'InfoExhaustion' as const,
      isActive: true,
      sortOrder: 3,
    },
  ];
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('Session API integration', () => {
  const testPrisma = getPrismaClient(process.env.TEST_DATABASE_URL);
  const redisStore = new Map<string, string | number>();
  const redisExpiresAt = new Map<string, number>();

  let createSessionPost: ((request: NextRequest) => Promise<Response>) | null = null;
  let submitSessionPost:
    | ((
        request: NextRequest,
        context: { params: Record<string, string | string[] | undefined> }
      ) => Promise<Response>)
    | null = null;
  let completeSessionPost:
    | ((
        request: NextRequest,
        context: { params: Record<string, string | string[] | undefined> }
      ) => Promise<Response>)
    | null = null;

  function purgeExpiredRedisEntries() {
    const now = Date.now();
    for (const [key, expiresAt] of redisExpiresAt.entries()) {
      if (expiresAt <= now) {
        redisExpiresAt.delete(key);
        redisStore.delete(key);
      }
    }
  }

  function resetRedisMock() {
    redisStore.clear();
    redisExpiresAt.clear();
  }

  async function createSession(): Promise<CreateSessionResponse> {
    if (!createSessionPost) {
      throw new Error('Create session route is not initialized');
    }

    const response = await createSessionPost(
      createJsonRequest('http://localhost/api/game/session', {})
    );

    expect(response.status).toBe(200);
    return (await response.json()) as CreateSessionResponse;
  }

  beforeAll(async () => {
    vi.resetModules();

    vi.doMock('@/lib/prisma', () => ({
      prisma: ensurePrisma(testPrisma),
    }));

    vi.doMock('@/lib/redis', () => ({
      redis: {},
      async setEx(key: string, value: string, ttlSeconds: number) {
        redisStore.set(key, value);
        redisExpiresAt.set(key, Date.now() + ttlSeconds * 1000);
      },
      async get(key: string) {
        purgeExpiredRedisEntries();
        const value = redisStore.get(key);
        if (value === undefined) {
          return null;
        }
        return typeof value === 'string' ? value : String(value);
      },
      async del(key: string) {
        redisStore.delete(key);
        redisExpiresAt.delete(key);
      },
      async incr(key: string) {
        purgeExpiredRedisEntries();
        const next = Number(redisStore.get(key) ?? 0) + 1;
        redisStore.set(key, next);
        return next;
      },
      async expire(key: string, ttlSeconds: number) {
        if (!redisStore.has(key)) {
          return;
        }
        redisExpiresAt.set(key, Date.now() + ttlSeconds * 1000);
      },
    }));

    vi.doMock('@/auth', () => ({
      auth: vi.fn().mockResolvedValue(null),
      handlers: {
        GET: vi.fn(),
        POST: vi.fn(),
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
    }));

    vi.doMock('@/services/FeedbackService', () => ({
      FeedbackService: class {
        static async *generateFeedbackStream() {
          yield 'Deterministic feedback chunk.';
        }

        static generateFeedbackFallback() {
          return 'Deterministic fallback feedback.';
        }
      },
    }));

    const createRoute = await import('@/app/api/game/session/route');
    const submitRoute = await import('@/app/api/game/session/[sessionId]/submit/route');
    const completeRoute = await import('@/app/api/game/session/[sessionId]/complete/route');

    createSessionPost = createRoute.POST;
    submitSessionPost = submitRoute.POST;
    completeSessionPost = completeRoute.POST;
  });

  beforeEach(async () => {
    const prisma = ensurePrisma(testPrisma);
    resetRedisMock();

    await prisma.attempt.deleteMany();
    await prisma.gameSession.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.profile.createMany({ data: buildProfiles() });
  });

  afterAll(async () => {
    if (testPrisma) {
      await testPrisma.$disconnect();
    }
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('POST /api/game/session returns sessionId and first profile', async () => {
    const response = await createSession();

    expect(response.sessionId).toBeTruthy();
    expect(response.currentProfile).toBeTruthy();
    expect(response.currentProfile.id).toBe('test-easy-1');
    expect(response.totalProfiles).toBe(8);
    expect(response.profileIndex).toBe(0);
  });

  it('POST /api/game/session/{id}/submit streams score and feedback_chunk events', async () => {
    if (!submitSessionPost) {
      throw new Error('Submit session route is not initialized');
    }

    const created = await createSession();

    const response = await submitSessionPost(
      createJsonRequest(
        `http://localhost/api/game/session/${created.sessionId}/submit`,
        {
          profileId: created.currentProfile.id,
          selections: {
            DR: 'Surface',
            SE: 'Single',
            SR: 'Rare',
            CV: 'Deadline',
          },
          clueUsed: false,
          timeTakenMs: 20_000,
        }
      ),
      {
        params: { sessionId: created.sessionId },
      }
    );

    expect(response.status).toBe(200);

    const sseEvents = parseSseEvents(await response.text());
    expect(sseEvents.some((event) => event.event === 'score')).toBe(true);
    expect(sseEvents.some((event) => event.event === 'feedback_chunk')).toBe(true);
  });

  it('POST /api/game/session/{id}/submit returns 409 for wrong profileId', async () => {
    if (!submitSessionPost) {
      throw new Error('Submit session route is not initialized');
    }

    const created = await createSession();

    const response = await submitSessionPost(
      createJsonRequest(
        `http://localhost/api/game/session/${created.sessionId}/submit`,
        {
          profileId: 'test-hard-3',
          selections: {
            DR: 'Surface',
            SE: 'Single',
            SR: 'Rare',
            CV: 'Deadline',
          },
          clueUsed: false,
          timeTakenMs: 20_000,
        }
      ),
      {
        params: { sessionId: created.sessionId },
      }
    );

    expect(response.status).toBe(409);
  });

  it('POST /api/game/session/{id}/submit returns 409 PROFILE_ALREADY_ANSWERED on duplicate', async () => {
    if (!submitSessionPost) {
      throw new Error('Submit session route is not initialized');
    }

    const prisma = ensurePrisma(testPrisma);
    const created = await createSession();

    await prisma.attempt.create({
      data: {
        sessionId: created.sessionId,
        profileId: created.currentProfile.id,
        selectionDR: 'Surface',
        selectionSE: 'Single',
        selectionSR: 'Rare',
        selectionCV: 'Deadline',
        scoreDR: true,
        scoreSE: true,
        scoreSR: true,
        scoreCV: true,
        totalScore: 4,
        clueUsed: false,
        timeTakenMs: 10_000,
      },
    });

    const response = await submitSessionPost(
      createJsonRequest(
        `http://localhost/api/game/session/${created.sessionId}/submit`,
        {
          profileId: created.currentProfile.id,
          selections: {
            DR: 'Surface',
            SE: 'Single',
            SR: 'Rare',
            CV: 'Deadline',
          },
          clueUsed: false,
          timeTakenMs: 20_000,
        }
      ),
      {
        params: { sessionId: created.sessionId },
      }
    );

    expect(response.status).toBe(409);
    const payload = (await response.json()) as ApiErrorEnvelope;
    expect(payload.error.code).toBe('PROFILE_ALREADY_ANSWERED');
  });

  it('POST /api/game/session/{id}/complete returns SessionSummary after 8 submits', async () => {
    if (!submitSessionPost || !completeSessionPost) {
      throw new Error('Submit/complete session routes are not initialized');
    }

    const created = await createSession();
    let currentProfileId = created.currentProfile.id;

    for (let index = 0; index < 8; index += 1) {
      const submitResponse = await submitSessionPost(
        createJsonRequest(
          `http://localhost/api/game/session/${created.sessionId}/submit`,
          {
            profileId: currentProfileId,
            selections: {
              DR: 'Surface',
              SE: 'Single',
              SR: 'Rare',
              CV: 'Deadline',
            },
            clueUsed: false,
            timeTakenMs: 20_000,
          }
        ),
        {
          params: { sessionId: created.sessionId },
        }
      );

      expect(submitResponse.status).toBe(200);
      const events = parseSseEvents(await submitResponse.text());

      const scoreEvent = events.find((event) => event.event === 'score');
      expect(scoreEvent).toBeTruthy();
      expect(events.some((event) => event.event === 'feedback_chunk')).toBe(true);

      if (index < 7) {
        const nextProfileEvent = events.find((event) => event.event === 'next_profile');
        expect(nextProfileEvent).toBeTruthy();

        const payload = nextProfileEvent?.data as {
          profile: { id: string } | null;
        };
        if (!payload.profile) {
          throw new Error('Expected next profile payload');
        }
        currentProfileId = payload.profile.id;
      } else {
        expect(events.some((event) => event.event === 'session_complete')).toBe(true);
      }
    }

    const completeResponse = await completeSessionPost(
      createJsonRequest(
        `http://localhost/api/game/session/${created.sessionId}/complete`,
        {}
      ),
      {
        params: { sessionId: created.sessionId },
      }
    );

    expect(completeResponse.status).toBe(200);
    const summary = (await completeResponse.json()) as {
      totalScore: number;
      maxScore: number;
      profileResults: unknown[];
      weakestDimension: string;
    };

    expect(summary.totalScore).toBeGreaterThanOrEqual(0);
    expect(summary.maxScore).toBe(32);
    expect(summary.profileResults).toHaveLength(8);
    expect(summary.weakestDimension).toMatch(/DR|SE|SR|CV/);
  });
});
