import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/data-source.js';
import { env } from '../config/env.js';
import { Round } from '../entities/Round.js';
import { RoundScore } from '../entities/RoundScore.js';
import { User } from '../entities/User.js';
import { ScoreService } from '../services/ScoreService.js';
import { resolveRoundStatus, RoundStatus } from '../utils/roundStatus.js';

interface RoundResponse {
  id: string;
  startTime: string;
  endTime: string;
  status: RoundStatus;
  totalScore: number;
}

export async function roundRoutes(app: FastifyInstance) {
  const roundRepository = AppDataSource.getRepository(Round);
  const scoreRepository = AppDataSource.getRepository(RoundScore);

  app.get('/rounds', { preHandler: app.authenticate }, async () => {
    const now = new Date();
    const rounds = await roundRepository.find({ order: { startTime: 'DESC' } });

    return rounds.map<RoundResponse>((round) => ({
      id: round.id,
      startTime: round.startTime.toISOString(),
      endTime: round.endTime.toISOString(),
      status: resolveRoundStatus(round, now),
      totalScore: round.totalScore
    }));
  });

  app.post('/rounds', { preHandler: app.requireAdmin }, async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + env.cooldownDuration * 1000);
    const endTime = new Date(startTime.getTime() + env.roundDuration * 1000);

    const round = roundRepository.create({ startTime, endTime, totalScore: 0 });
    await roundRepository.save(round);

    return {
      id: round.id,
      startTime: round.startTime.toISOString(),
      endTime: round.endTime.toISOString(),
      status: resolveRoundStatus(round),
      totalScore: round.totalScore
    } satisfies RoundResponse;
  });

  app.get<{ Params: { id: string } }>('/rounds/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const round = await roundRepository.findOne({ where: { id: request.params.id } });

    if (!round) {
      reply.status(404).send({ message: 'Раунд не найден' });
      return;
    }

    const status = resolveRoundStatus(round);
    const myScoreRecord = await scoreRepository.findOne({
      where: { round: { id: round.id }, user: { id: request.user.sub } }
    });

    let winner: { username: string; score: number } | null = null;

    if (status === 'finished') {
      const bestScore = await scoreRepository
        .createQueryBuilder('score')
        .leftJoinAndSelect('score.user', 'user')
        .where('score.round_id = :roundId', { roundId: round.id })
        .orderBy('score.score', 'DESC')
        .addOrderBy('score.updatedAt', 'ASC')
        .getOne();

      if (bestScore && bestScore.score > 0) {
        winner = { username: bestScore.user.username, score: bestScore.score };
      }
    }

    reply.send({
      id: round.id,
      startTime: round.startTime.toISOString(),
      endTime: round.endTime.toISOString(),
      status,
      totalScore: round.totalScore,
      myScore: myScoreRecord?.score ?? 0,
      myTaps: myScoreRecord?.taps ?? 0,
      winner
    });
  });

  app.post<{ Params: { id: string } }>('/rounds/:id/tap', { preHandler: app.authenticate }, async (request, reply) => {
    const round = await roundRepository.findOne({ where: { id: request.params.id } });
    if (!round) {
      reply.status(404).send({ message: 'Раунд не найден' });
      return;
    }

    const status = resolveRoundStatus(round);
    if (status !== 'active') {
      reply.status(400).send({ message: 'Раунд не активен' });
      return;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driverType = queryRunner.connection.options.type as string;
      const supportsLock = !['sqlite', 'better-sqlite3'].includes(driverType);

      const lockedRound = await queryRunner.manager.findOneOrFail(Round, {
        where: { id: round.id },
        ...(supportsLock ? { lock: { mode: 'pessimistic_write' as const } } : {})
      });

      const user = await queryRunner.manager.findOneOrFail(User, {
        where: { id: request.user.sub }
      });

      const scoreService = new ScoreService(queryRunner);
      const tapResult = await scoreService.registerTap(lockedRound, user);

      await queryRunner.commitTransaction();

      reply.send({
        myScore: tapResult.myScore,
        totalScore: tapResult.totalScore,
        taps: tapResult.taps
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      app.log.error(error);
      reply.status(500).send({ message: 'Не удалось обработать тап' });
    } finally {
      await queryRunner.release();
    }
  });
}
