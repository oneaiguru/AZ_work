import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppDataSource } from './config/data-source.js';
import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { roundRoutes } from './routes/rounds.js';

async function bootstrap() {
  await AppDataSource.initialize();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(roundRoutes);

  await app.listen({ port: env.port, host: '0.0.0.0' });
  console.log(`🚀 The Last of Guss backend running on port ${env.port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
