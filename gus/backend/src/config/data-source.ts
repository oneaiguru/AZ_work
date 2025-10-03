import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env.js';
import { User } from '../entities/User.js';
import { Round } from '../entities/Round.js';
import { RoundScore } from '../entities/RoundScore.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [User, Round, RoundScore],
  synchronize: true,
  logging: env.NODE_ENV === 'development'
});
