import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppDataSource } from '../../src/config/data-source.js';
import { authPlugin } from '../../src/plugins/auth.js';
import { authRoutes } from '../../src/routes/auth.js';
import { roundRoutes } from '../../src/routes/rounds.js';

export async function buildTestApp() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const app = Fastify();

  await app.register(cors, { origin: true, credentials: true });
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(roundRoutes);

  await app.ready();

  return app;
}
