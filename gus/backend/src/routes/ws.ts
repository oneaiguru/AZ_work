import type { RawData, WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/data-source.js';
import { Round } from '../entities/Round.js';
import { User } from '../entities/User.js';
import { ScoreService } from '../services/ScoreService.js';
import { resolveRoundStatus } from '../utils/roundStatus.js';
import type { AuthTokenPayload } from '../plugins/auth.js';

interface ClientContext {
  auth: AuthTokenPayload;
  subscriptions: Set<string>;
}

type ClientMessage =
  | { type: 'subscribe'; roundId: string }
  | { type: 'tap'; roundId: string };

type ServerMessage =
  | { type: 'subscribed'; roundId: string }
  | { type: 'tap:result'; roundId: string; myScore: number; totalScore: number; taps: number }
  | { type: 'round:update'; roundId: string; totalScore: number }
  | { type: 'error'; message: string };

const roundSubscribers = new Map<string, Set<WebSocket>>();
const clientContexts = new WeakMap<WebSocket, ClientContext>();

function send(ws: WebSocket, payload: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function cleanupConnection(ws: WebSocket) {
  const context = clientContexts.get(ws);
  if (!context) {
    return;
  }

  for (const roundId of context.subscriptions) {
    const subscribers = roundSubscribers.get(roundId);
    if (!subscribers) {
      continue;
    }
    subscribers.delete(ws);
    if (subscribers.size === 0) {
      roundSubscribers.delete(roundId);
    }
  }

  clientContexts.delete(ws);
}

function parseMessage(raw: RawData): ClientMessage | null {
  try {
    const data = JSON.parse(raw.toString());
    if (!data || typeof data !== 'object') {
      return null;
    }

    if (data.type === 'subscribe' && typeof data.roundId === 'string' && data.roundId.length > 0) {
      return { type: 'subscribe', roundId: data.roundId };
    }

    if (data.type === 'tap' && typeof data.roundId === 'string' && data.roundId.length > 0) {
      return { type: 'tap', roundId: data.roundId };
    }

    return null;
  } catch (error) {
    return null;
  }
}

export async function websocketRoutes(app: FastifyInstance) {
  const roundRepository = AppDataSource.getRepository(Round);

  app.get<{ Querystring: { token?: string } }>('/ws', { websocket: true }, (connection, request) => {
    const ws = connection.socket;
    const { token } = request.query;

    if (!token) {
      ws.close(4001, 'TOKEN_REQUIRED');
      return;
    }

    (async () => {
      try {
        const auth = await app.jwt.verify<AuthTokenPayload>(token);
        const context: ClientContext = { auth, subscriptions: new Set() };
        clientContexts.set(ws, context);

        ws.on('message', async (raw: RawData) => {
          const message = parseMessage(raw);

          if (!message) {
            send(ws, { type: 'error', message: 'Некорректный формат сообщения' });
            return;
          }

          if (message.type === 'subscribe') {
            context.subscriptions.add(message.roundId);
            let subscribers = roundSubscribers.get(message.roundId);
            if (!subscribers) {
              subscribers = new Set();
              roundSubscribers.set(message.roundId, subscribers);
            }
            subscribers.add(ws);
            send(ws, { type: 'subscribed', roundId: message.roundId });
            return;
          }

          const round = await roundRepository.findOne({ where: { id: message.roundId } });
          if (!round) {
            send(ws, { type: 'error', message: 'Раунд не найден' });
            return;
          }

          const status = resolveRoundStatus(round);
          if (status !== 'active') {
            send(ws, { type: 'error', message: 'Раунд не активен' });
            return;
          }

          const queryRunner = AppDataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const lockedRound = await queryRunner.manager.findOneOrFail(Round, {
              where: { id: round.id },
              lock: { mode: 'pessimistic_write' }
            });

            const user = await queryRunner.manager.findOneOrFail(User, {
              where: { id: context.auth.sub }
            });

            const scoreService = new ScoreService(queryRunner);
            const tapResult = await scoreService.registerTap(lockedRound, user);

            await queryRunner.commitTransaction();

            send(ws, {
              type: 'tap:result',
              roundId: message.roundId,
              myScore: tapResult.myScore,
              totalScore: tapResult.totalScore,
              taps: tapResult.taps
            });

            const broadcastPayload: ServerMessage = {
              type: 'round:update',
              roundId: message.roundId,
              totalScore: tapResult.totalScore
            };

            const subscribers = roundSubscribers.get(message.roundId);
            if (subscribers) {
              for (const client of subscribers) {
                if (client !== ws) {
                  send(client, broadcastPayload);
                }
              }
            }
          } catch (error) {
            await queryRunner.rollbackTransaction();
            app.log.error(error);
            send(ws, { type: 'error', message: 'Не удалось обработать тап' });
          } finally {
            await queryRunner.release();
          }
        });

        ws.on('close', () => {
          cleanupConnection(ws);
        });

        ws.on('error', () => {
          cleanupConnection(ws);
        });
      } catch (error) {
        app.log.error(error);
        ws.close(4002, 'INVALID_TOKEN');
      }
    })();
  });
}
