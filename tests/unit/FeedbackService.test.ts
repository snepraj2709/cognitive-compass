import type { Profile } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DimSelections } from '@/lib/constants';
import type { ScoreBreakdown } from '@/utils/scoring';

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

function createProfile(): Profile {
  return {
    id: 'profile-1',
    slug: 'profile-1',
    name: 'Profile 1',
    avatar: 'avatar',
    difficulty: 'MEDIUM',
    scenario: 'The subject tried multiple methods, then paused to reassess assumptions.',
    context: 'Context',
    clues: ['clue'],
    answerDR: 'Deep',
    answerSE: 'Single',
    answerSR: 'Regular',
    answerCV: 'Clarity',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date('2026-03-02T00:00:00.000Z'),
    updatedAt: new Date('2026-03-02T00:00:00.000Z'),
  };
}

describe('FeedbackService fallback behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to generateFeedbackFallback when Anthropic streaming throws', async () => {
    const stream = vi.fn().mockImplementation(() => {
      throw new Error('Anthropic unavailable');
    });

    vi.doMock('@/lib/anthropic', () => ({
      anthropic: {
        messages: {
          stream,
        },
      },
    }));

    const { FeedbackService } = await import('@/services/FeedbackService');

    const scoreBreakdown: ScoreBreakdown = {
      DR: false,
      SE: true,
      SR: false,
      CV: true,
      total: 2,
    };

    const selections: DimSelections = {
      DR: 'Surface',
      SE: 'Single',
      SR: 'Rare',
      CV: 'Clarity',
    };

    const runPromise = collect(
      FeedbackService.generateFeedbackStream(createProfile(), selections, scoreBreakdown)
    );

    await vi.runAllTimersAsync();
    const chunks = await runPromise;
    const output = chunks.join('');

    expect(stream).toHaveBeenCalledTimes(3);
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain('SE was correct.');
    expect(output).toContain('CV was correct.');
    expect(output).toContain('DR was off');
    expect(output).toContain('SR was off');
  });
});
