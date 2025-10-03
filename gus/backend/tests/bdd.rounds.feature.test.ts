import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './utils/testApp.js';
import { resetDatabase } from './utils/resetDatabase.js';
import { AppDataSource } from '../src/config/data-source.js';
import { loginUser } from './utils/auth.js';
import { Round } from '../src/entities/Round.js';
import { RoundScore } from '../src/entities/RoundScore.js';
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

describe('Feature: Round lifecycle management', () => {
  it('Scenario: Unauthorized visitor cannot see rounds', async () => {
    const response = await request(app.server).get('/rounds').expect(401);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('Scenario: Admin creates a new round and survivors can see it', async () => {
    const admin = await loginUser(app, 'admin', 'rootpass');
    const player = await loginUser(app, 'Dina', 'password123');

    const creation = await request(app.server)
      .post('/rounds')
      .set('Cookie', admin.cookie)
      .expect(200);

    expect(creation.body.status).toBe('cooldown');

    const list = await request(app.server)
      .get('/rounds')
      .set('Cookie', player.cookie)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body[0].id).toBe(creation.body.id);
  });

  it('Scenario: Survivor cannot start a round', async () => {
    await loginUser(app, 'admin', 'rootpass');
    const survivor = await loginUser(app, 'Eli', 'hunter2');

    const forbidden = await request(app.server)
      .post('/rounds')
      .set('Cookie', survivor.cookie)
      .expect(403);

    expect(forbidden.body.message).toBe('Forbidden');
  });

  it('Scenario: Round summary reveals the champion after the storm', async () => {
    const admin = await loginUser(app, 'admin', 'rootpass');
    const alice = await loginUser(app, 'Alice', 'pass1');
    const bob = await loginUser(app, 'Bob', 'pass2');

    const created = await request(app.server)
      .post('/rounds')
      .set('Cookie', admin.cookie)
      .expect(200);

    const roundRepo = AppDataSource.getRepository(Round);
    const scoreRepo = AppDataSource.getRepository(RoundScore);
    const userRepo = AppDataSource.getRepository(User);

    const round = await roundRepo.findOneByOrFail({ id: created.body.id });

    round.startTime = new Date(Date.now() - 10_000);
    round.endTime = new Date(Date.now() - 1000);
    round.totalScore = 42;
    await roundRepo.save(round);

    const aliceUser = await userRepo.findOneByOrFail({ username: alice.body.user.username });
    const bobUser = await userRepo.findOneByOrFail({ username: bob.body.user.username });

    await scoreRepo.save(
      scoreRepo.create({ round, user: aliceUser, taps: 5, score: 30 })
    );
    await scoreRepo.save(
      scoreRepo.create({ round, user: bobUser, taps: 2, score: 12 })
    );

    const detail = await request(app.server)
      .get(`/rounds/${round.id}`)
      .set('Cookie', alice.cookie)
      .expect(200);

    expect(detail.body.status).toBe('finished');
    expect(detail.body.winner).toEqual({ username: 'Alice', score: 30 });
  });
});
