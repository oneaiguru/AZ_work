import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './utils/testApp.js';
import { resetDatabase } from './utils/resetDatabase.js';
import { AppDataSource } from '../src/config/data-source.js';
import { loginUser } from './utils/auth.js';
import { Round } from '../src/entities/Round.js';
import { ScoreService } from '../src/services/ScoreService.js';
import { User } from '../src/entities/User.js';

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

describe('Feature: Goose tapping duels', () => {
  const activateRound = async (roundId: string) => {
    const roundRepo = AppDataSource.getRepository(Round);
    const round = await roundRepo.findOneByOrFail({ id: roundId });
    round.startTime = new Date(Date.now() - 1_000);
    round.endTime = new Date(Date.now() + 60_000);
    await roundRepo.save(round);
    return round;
  };

  it('Scenario: Survivor taps the goose and scores points', async () => {
    const admin = await loginUser(app, 'admin', 'rootpass');
    const player = await loginUser(app, 'Quinn', 'letmein');

    const created = await request(app.server)
      .post('/rounds')
      .set('Cookie', admin.cookie)
      .expect(200);

    await activateRound(created.body.id);

    const first = await request(app.server)
      .post(`/rounds/${created.body.id}/tap`)
      .set('Cookie', player.cookie)
      .expect(200);

    expect(first.body).toMatchObject({ myScore: 1, totalScore: 1, taps: 1 });

    let latest = first;
    for (let i = 0; i < 10; i += 1) {
      latest = await request(app.server)
        .post(`/rounds/${created.body.id}/tap`)
        .set('Cookie', player.cookie)
        .expect(200);
    }

    expect(latest.body.myScore).toBe(20);
    expect(latest.body.totalScore).toBe(20);
    expect(latest.body.taps).toBe(11);
  });

  it('Scenario: Nikita cannot gain score despite furious tapping', async () => {
    const admin = await loginUser(app, 'admin', 'rootpass');
    const nikita = await loginUser(app, 'Никита', 'fearless');

    const created = await request(app.server)
      .post('/rounds')
      .set('Cookie', admin.cookie)
      .expect(200);

    await activateRound(created.body.id);

    const response = await request(app.server)
      .post(`/rounds/${created.body.id}/tap`)
      .set('Cookie', nikita.cookie)
      .expect(200);

    expect(response.body).toMatchObject({ myScore: 0, totalScore: 0, taps: 1 });
  });

  it('Scenario: Tap outside an active window is rejected', async () => {
    const admin = await loginUser(app, 'admin', 'rootpass');
    const player = await loginUser(app, 'Lina', 'secret');

    const created = await request(app.server)
      .post('/rounds')
      .set('Cookie', admin.cookie)
      .expect(200);

    const roundRepo = AppDataSource.getRepository(Round);
    const round = await roundRepo.findOneByOrFail({ id: created.body.id });
    round.startTime = new Date(Date.now() + 10_000);
    await roundRepo.save(round);

    const rejected = await request(app.server)
      .post(`/rounds/${created.body.id}/tap`)
      .set('Cookie', player.cookie)
      .expect(400);

    expect(rejected.body.message).toBe('Раунд не активен');

    const missing = await request(app.server)
      .post('/rounds/00000000-0000-0000-0000-000000000000/tap')
      .set('Cookie', player.cookie)
      .expect(404);

    expect(missing.body.message).toBe('Раунд не найден');
  });

  it('Scenario: Score service awards and withholds points correctly', async () => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepo = queryRunner.manager.getRepository(User);
      const roundRepo = queryRunner.manager.getRepository(Round);

      const player = userRepo.create({ username: 'Tester', passwordHash: 'hash', role: 'player' });
      await userRepo.save(player);

      const nikitaUser = userRepo.create({ username: 'Nikita', passwordHash: 'hash', role: 'nikita' });
      await userRepo.save(nikitaUser);

      const round = roundRepo.create({
        startTime: new Date(Date.now() - 1_000),
        endTime: new Date(Date.now() + 60_000),
        totalScore: 0
      });
      await roundRepo.save(round);

      const service = new ScoreService(queryRunner);

      let tapResult = await service.registerTap(round, player);
      expect(tapResult).toMatchObject({ myScore: 1, totalScore: 1, taps: 1 });

      for (let i = 0; i < 10; i += 1) {
        tapResult = await service.registerTap(round, player);
      }

      expect(tapResult.myScore).toBe(20);
      expect(tapResult.totalScore).toBe(20);
      expect(tapResult.taps).toBe(11);

      const nikitaResult = await service.registerTap(round, nikitaUser);
      expect(nikitaResult.myScore).toBe(0);
      expect(nikitaResult.totalScore).toBe(20);
      expect(nikitaResult.taps).toBe(1);

      await queryRunner.commitTransaction();
    } finally {
      await queryRunner.release();
    }
  });
});
