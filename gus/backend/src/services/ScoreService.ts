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

    const scoreRepository = manager.getRepository(RoundScore);
    const supportsPessimisticLock = !['sqlite', 'better-sqlite3'].includes(
      this.queryRunner.connection.options.type as string
    );

    const findLockedScore = () => {
      const query = scoreRepository
        .createQueryBuilder('score')
        .where('score.round_id = :roundId', { roundId: round.id })
        .andWhere('score.user_id = :userId', { userId: user.id });

      if (supportsPessimisticLock) {
        query.setLock('pessimistic_write');
      }

      return query.getOne();
    };

    let roundScore = await findLockedScore();

    if (!roundScore) {
      roundScore = scoreRepository.create({
        round,
        user,
        taps: 0,
        score: 0
      });
      await scoreRepository.save(roundScore);
      roundScore = await findLockedScore();
      if (!roundScore) {
        throw new Error('Не удалось зафиксировать счёт игрока');
      }
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
