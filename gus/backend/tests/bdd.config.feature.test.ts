import { describe, expect, it } from 'vitest';
import { resolveDataSourceOptions } from '../src/config/data-source.js';
import { parseEnv } from '../src/config/env.js';
import { getDateColumnType } from '../src/config/dateColumnType.js';

describe('Feature: Data source configuration', () => {
  it('Scenario: Test environment leverages an in-memory sqlite database', () => {
    const options = resolveDataSourceOptions('test');
    expect(options.type).toBe('sqlite');
    expect(options).toMatchObject({ database: ':memory:', synchronize: true, logging: false });
  });

  it('Scenario: Non-test environments fall back to Postgres connection string', () => {
    const options = resolveDataSourceOptions('production');
    expect(options.type).toBe('postgres');
    expect(options).toMatchObject({ url: process.env.DATABASE_URL });
    expect(options.logging).toBe(false);
  });

  it('Scenario: Development mode enables verbose logging for the datasource', () => {
    const options = resolveDataSourceOptions('development');
    expect(options.type).toBe('postgres');
    expect(options.logging).toBe(true);
  });

  it('Scenario: Date column helper switches types between environments', () => {
    expect(getDateColumnType('test')).toBe('datetime');
    expect(getDateColumnType('production')).toBe('timestamptz');
  });

  it('Scenario: Missing critical secrets causes a descriptive validation error', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_URL: 'postgres://example/test',
        JWT_SECRET: 'short',
        ROUND_DURATION: '60',
        COOLDOWN_DURATION: '30'
      })
    ).toThrow(/Invalid environment configuration/);
  });
});
