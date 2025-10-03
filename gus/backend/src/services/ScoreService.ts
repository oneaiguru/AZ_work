import { QueryRunner } from 'typeorm';
import { Round } from '../entities/Round.js';
import { RoundScore } from '../entities/RoundScore.js';
import { User } from '../entities/User.js';

export interface TapResult {
  myScore: number;
  totalScore: number;
  taps: number;
}

export class ScoreService {
  constructor(private readonly queryRunner: QueryRunner) {}

  async registerTap(round: Round, user: User): Promise<TapResult> {
    const manager = this.queryRunner.manager;

    let roundScore = await manager.findOne(RoundScore, {
      where: { round: { id: round.id }, user: { id: user.id } },
      lock: { mode: 'pessimistic_write' }
    });

    if (!roundScore) {
      roundScore = manager.create(RoundScore, {
        round,
        user,
        taps: 0,
        score: 0
      });
      roundScore = await manager.save(roundScore);
      // lock after creation to prevent race during first tap
      roundScore = await manager.findOneOrFail(RoundScore, {
        where: { id: roundScore.id },
        lock: { mode: 'pessimistic_write' }
      });
    }

    const nextTapCount = roundScore.taps + 1;
    const points = user.role === 'nikita' ? 0 : nextTapCount % 11 === 0 ? 10 : 1;

    roundScore.taps = nextTapCount;
    if (points > 0) {
      roundScore.score += points;
    }

    await manager.save(roundScore);

    if (points > 0) {
      round.totalScore += points;
      await manager.save(round);
    }

    return {
      myScore: roundScore.score,
      totalScore: round.totalScore,
      taps: roundScore.taps
    };
  }
}
