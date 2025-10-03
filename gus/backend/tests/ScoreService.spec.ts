import 'reflect-metadata';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';
vi.mock('../src/entities/Round.js', () => ({
  Round: class Round {}
}));

vi.mock('../src/entities/RoundScore.js', () => ({
  RoundScore: class RoundScore {}
}));

vi.mock('../src/entities/User.js', () => ({
  User: class User {}
}));

import type { Round } from '../src/entities/Round.js';
import type { RoundScore } from '../src/entities/RoundScore.js';
import type { User } from '../src/entities/User.js';

type TestContextOptions = {
  existingScore?: RoundScore | null;
  lockFailsAfterCreate?: boolean;
};

type TestContext = {
  queryRunner: QueryRunner;
  savedRoundScores: RoundScore[];
  savedRounds: Round[];
};

let ScoreServiceCtor: typeof import('../src/services/ScoreService.js').ScoreService;

beforeAll(async () => {
  ({ ScoreService: ScoreServiceCtor } = await import(
    '../src/services/ScoreService.js'
  ));
});

const createRound = (overrides: Partial<Round> = {}): Round =>
  ({
    id: overrides.id ?? 'round-id',
    startTime: overrides.startTime ?? new Date(Date.now() - 10_000),
    endTime: overrides.endTime ?? new Date(Date.now() + 10_000),
    totalScore: overrides.totalScore ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    scores: overrides.scores ?? []
  } as Round);

const createUser = (overrides: Partial<User> = {}): User =>
  ({
    id: overrides.id ?? 'user-id',
    username: overrides.username ?? 'player',
    passwordHash: overrides.passwordHash ?? 'hash',
    role: overrides.role ?? 'player',
    createdAt: overrides.createdAt ?? new Date(),
    scores: overrides.scores ?? []
  } as User);

const createScore = (
  round: Round,
  user: User,
  overrides: Partial<RoundScore> = {}
): RoundScore =>
  ({
    id: overrides.id ?? 'score-id',
    round,
    user,
    taps: overrides.taps ?? 0,
    score: overrides.score ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date()
  } as RoundScore);

const isRoundScore = (value: unknown): value is RoundScore =>
  typeof value === 'object' &&
  value !== null &&
  'taps' in value &&
  'score' in value &&
  'round' in value &&
  'user' in value;

const isRound = (value: unknown): value is Round =>
  typeof value === 'object' &&
  value !== null &&
  'totalScore' in value &&
  'startTime' in value &&
  'endTime' in value;

const createTestContext = (options: TestContextOptions = {}): TestContext => {
  let currentScore: RoundScore | null = options.existingScore ?? null;
  let lockCalls = 0;
  const savedRoundScores: RoundScore[] = [];
  const savedRounds: Round[] = [];

  const repository = {
    create(data: Partial<RoundScore>) {
      const score = createScore(
        data.round as Round,
        data.user as User,
        data
      );
      currentScore = score;
      return score;
    },
    async save(score: RoundScore) {
      currentScore = score;
      savedRoundScores.push(score);
      return score;
    },
    createQueryBuilder() {
      return {
        setLock() {
          return this;
        },
        where() {
          return this;
        },
        andWhere() {
          return this;
        },
        async getOne() {
          lockCalls += 1;
          if (options.lockFailsAfterCreate && lockCalls >= 2) {
            return null;
          }
          return currentScore;
        }
      };
    }
  };

  const manager = {
    getRepository() {
      return repository;
    },
    async save(entity: unknown) {
      if (isRoundScore(entity)) {
        currentScore = entity;
        savedRoundScores.push(entity);
      }
      if (isRound(entity)) {
        savedRounds.push(entity);
      }
      return entity;
    }
  };

  const queryRunner = { manager } as unknown as QueryRunner;

  return {
    queryRunner,
    savedRoundScores,
    savedRounds
  };
};

describe('ScoreService', () => {
  it('creates a new score entry and awards one point for the first tap', async () => {
    const round = createRound();
    const user = createUser();
    const context = createTestContext();
    const service = new ScoreServiceCtor(context.queryRunner);

    const result = await service.registerTap(round, user);

    expect(result).toEqual({ myScore: 1, totalScore: 1, taps: 1 });
    expect(round.totalScore).toBe(1);
    expect(context.savedRoundScores.length).toBeGreaterThan(0);
    expect(context.savedRounds).toHaveLength(1);
  });

  it('rewards a combo bonus every eleventh tap', async () => {
    const round = createRound({ totalScore: 7 });
    const user = createUser();
    const existingScore = createScore(round, user, {
      taps: 10,
      score: 9
    });
    const context = createTestContext({ existingScore });
    const service = new ScoreServiceCtor(context.queryRunner);

    const result = await service.registerTap(round, user);

    expect(result).toEqual({ myScore: 19, totalScore: 17, taps: 11 });
    expect(round.totalScore).toBe(17);
    expect(context.savedRounds).toHaveLength(1);
  });

  it('does not award points to a nikita user but still tracks taps', async () => {
    const round = createRound();
    const user = createUser({ role: 'nikita' });
    const context = createTestContext();
    const service = new ScoreServiceCtor(context.queryRunner);

    const result = await service.registerTap(round, user);

    expect(result).toEqual({ myScore: 0, totalScore: 0, taps: 1 });
    expect(round.totalScore).toBe(0);
    expect(context.savedRounds).toHaveLength(0);
  });

  it('throws when the score cannot be locked after creation', async () => {
    const round = createRound();
    const user = createUser();
    const context = createTestContext({ lockFailsAfterCreate: true });
    const service = new ScoreServiceCtor(context.queryRunner);

    await expect(service.registerTap(round, user)).rejects.toThrow(
      'Не удалось зафиксировать счёт игрока'
    );
  });
});
