import { describe, expect, it } from 'vitest';
import { CV_VALUES, DR_VALUES, SE_VALUES, SR_VALUES } from '@/lib/constants';
import {
  computeSessionAccuracy,
  computeXP,
  identifyWeakDimension,
  scoreAttempt,
} from '@/utils/scoring';

describe('scoreAttempt', () => {
  const answer = {
    DR: DR_VALUES[0],
    SE: SE_VALUES[0],
    SR: SR_VALUES[0],
    CV: CV_VALUES[0],
  };

  it('returns 4/4 when all dimensions are correct', () => {
    const result = scoreAttempt(answer, answer);

    expect(result.total).toBe(4);
    expect(result).toMatchObject({
      DR: true,
      SE: true,
      SR: true,
      CV: true,
    });
  });

  it('returns 0/4 when all dimensions are wrong', () => {
    const result = scoreAttempt(
      {
        DR: DR_VALUES[3],
        SE: SE_VALUES[3],
        SR: SR_VALUES[3],
        CV: CV_VALUES[3],
      },
      answer
    );

    expect(result.total).toBe(0);
    expect(result).toMatchObject({
      DR: false,
      SE: false,
      SR: false,
      CV: false,
    });
  });

  it('returns 2/4 when DR+SE are correct and SR+CV are wrong', () => {
    const result = scoreAttempt(
      {
        DR: answer.DR,
        SE: answer.SE,
        SR: SR_VALUES[1],
        CV: CV_VALUES[1],
      },
      answer
    );

    expect(result.total).toBe(2);
    expect(result).toMatchObject({
      DR: true,
      SE: true,
      SR: false,
      CV: false,
    });
  });
});

describe('computeXP', () => {
  it('gives more than 15 XP for EASY 4/4 fast answer without clue', () => {
    const xp = computeXP(4, 'EASY', 20_000, false);
    expect(xp).toBeGreaterThan(15);
  });

  it('gives more than 60 XP for HARD 4/4 fast answer', () => {
    const xp = computeXP(4, 'HARD', 20_000, false);
    expect(xp).toBeGreaterThan(60);
  });

  it('applies a 3 XP penalty when clue is used', () => {
    const withoutClue = computeXP(4, 'MEDIUM', 20_000, false);
    const withClue = computeXP(4, 'MEDIUM', 20_000, true);

    expect(withoutClue - withClue).toBe(3);
  });

  it('returns 0 XP when score is 0', () => {
    expect(computeXP(0, 'HARD', 10_000, false)).toBe(0);
  });

  it('returns higher XP for HARD than EASY at the same score', () => {
    const easy = computeXP(3, 'EASY', 20_000, false);
    const hard = computeXP(3, 'HARD', 20_000, false);

    expect(hard).toBeGreaterThan(easy);
  });
});

describe('session accuracy and weak dimension', () => {
  it('computes DR accuracy as 100 when DR is correct in both attempts', () => {
    const accuracy = computeSessionAccuracy([
      { DR: true, SE: false, SR: false, CV: false, total: 1 },
      { DR: true, SE: true, SR: false, CV: true, total: 3 },
    ]);

    expect(accuracy.DR).toBe(100);
  });

  it('computes DR accuracy as 50 when DR is correct in one of two attempts', () => {
    const accuracy = computeSessionAccuracy([
      { DR: true, SE: false, SR: false, CV: false, total: 1 },
      { DR: false, SE: true, SR: false, CV: true, total: 2 },
    ]);

    expect(accuracy.DR).toBe(50);
  });

  it('identifyWeakDimension returns the lowest-accuracy dimension', () => {
    const weakest = identifyWeakDimension({
      DR: 100,
      SE: 25,
      SR: 50,
      CV: 75,
    });

    expect(weakest).toBe('SE');
  });
});
