import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env.js';
import { User } from '../entities/User.js';
import { Round } from '../entities/Round.js';
import { RoundScore } from '../entities/RoundScore.js';

export const resolveDataSourceOptions = (nodeEnv = env.NODE_ENV): DataSourceOptions => {
  if (nodeEnv === 'test') {
    return {
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Round, RoundScore],
      synchronize: true,
      logging: false
    };
  }

  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    entities: [User, Round, RoundScore],
    synchronize: true,
    logging: nodeEnv === 'development'
  };
};

export const AppDataSource = new DataSource(resolveDataSourceOptions());
