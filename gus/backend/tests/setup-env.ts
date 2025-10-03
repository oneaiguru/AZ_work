process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost/test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-test';
process.env.ROUND_DURATION = process.env.ROUND_DURATION ?? '3';
process.env.COOLDOWN_DURATION = process.env.COOLDOWN_DURATION ?? '1';
