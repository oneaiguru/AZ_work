import { describe, expect, it } from 'vitest';
import type { Round } from '../src/entities/Round.js';
import { resolveRoundStatus } from '../src/utils/roundStatus.js';

describe('resolveRoundStatus', () => {
  const baseRound = (): Round =>
    ({
      id: 'round',
      totalScore: 0,
      createdAt: new Date(),
      startTime: new Date(),
      endTime: new Date(),
      scores: []
    } as Round);

  it('returns cooldown when the round has not started yet', () => {
    const round = baseRound();
    const now = new Date();
    round.startTime = new Date(now.getTime() + 60_000);
    round.endTime = new Date(now.getTime() + 120_000);

    const status = resolveRoundStatus(round, now);

    expect(status).toBe('cooldown');
  });

  it('returns active when the round is in progress', () => {
    const round = baseRound();
    const now = new Date();
    round.startTime = new Date(now.getTime() - 60_000);
    round.endTime = new Date(now.getTime() + 60_000);

    const status = resolveRoundStatus(round, now);

    expect(status).toBe('active');
  });

  it('returns finished when the round already ended', () => {
    const round = baseRound();
    const now = new Date();
    round.startTime = new Date(now.getTime() - 120_000);
    round.endTime = new Date(now.getTime() - 60_000);

    const status = resolveRoundStatus(round, now);

    expect(status).toBe('finished');
  });
});
