import Fastify from 'fastify';
import cors from '@fastify/cors';
import { setTimeout as delay } from 'timers/promises';
import fastifyWebsocket from '@fastify/websocket';
import { AppDataSource } from './config/data-source.js';
import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { roundRoutes } from './routes/rounds.js';
import { websocketRoutes } from './routes/ws.js';

async function initializeDataSourceWithRetry(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      return;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      console.error(
        `Failed to initialize data source (attempt ${attempt}/${retries})`,
        error
      );

      if (isLastAttempt) {
        throw error;
      }

      await delay(delayMs);
    }
  }
}

async function bootstrap() {
  await initializeDataSourceWithRetry();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(fastifyWebsocket);
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(roundRoutes);
  await app.register(websocketRoutes);

  await app.listen({ port: env.port, host: '0.0.0.0' });
  console.log(`🚀 The Last of Guss backend running on port ${env.port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
