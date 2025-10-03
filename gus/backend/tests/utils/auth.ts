import request from 'supertest';
import { FastifyInstance } from 'fastify';

export async function loginUser(app: FastifyInstance, username: string, password: string) {
  const response = await request(app.server)
    .post('/login')
    .send({ username, password })
    .expect(200);

  const cookies = response.headers['set-cookie'];
  if (!cookies || cookies.length === 0) {
    throw new Error('Отсутствует cookie авторизации');
  }

  return { cookie: cookies.map((value) => value.split(';')[0]).join('; '), body: response.body };
}
