import { ColumnType } from 'typeorm';
import { env } from './env.js';

export const getDateColumnType = (nodeEnv = env.NODE_ENV): ColumnType =>
  nodeEnv === 'test' ? 'datetime' : 'timestamptz';
