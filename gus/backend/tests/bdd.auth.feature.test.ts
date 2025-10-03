import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './utils/testApp.js';
import { resetDatabase } from './utils/resetDatabase.js';
import { AppDataSource } from '../src/config/data-source.js';

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

describe('Feature: User authentication', () => {
  it('Scenario: Player registers and receives a session token', async () => {
    const response = await request(app.server)
      .post('/login')
      .send({ username: 'PlayerOne', password: 'hunter2' })
      .expect(200);

    expect(response.body.user).toMatchObject({ username: 'PlayerOne', role: 'player' });
    expect(response.body.token).toBeTypeOf('string');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('Scenario: Admin login returns admin role', async () => {
    const response = await request(app.server)
      .post('/login')
      .send({ username: 'admin', password: 'rootpass' })
      .expect(200);

    expect(response.body.user.role).toBe('admin');
  });

  it('Scenario: Existing user enters a wrong password', async () => {
    await request(app.server)
      .post('/login')
      .send({ username: 'Mira', password: 'correct' })
      .expect(200);

    const failed = await request(app.server)
      .post('/login')
      .send({ username: 'Mira', password: 'incorrect' })
      .expect(401);

    expect(failed.body.message).toMatch(/Неверный пароль/);
  });

  it('Scenario: Login without credentials is rejected', async () => {
    const response = await request(app.server).post('/login').send({}).expect(400);
    expect(response.body.message).toMatch(/обязательны/i);
  });
});
