import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  ROUND_DURATION: z.string().default('60'),
  COOLDOWN_DURATION: z.string().default('30')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = {
  ...parsed.data,
  roundDuration: Number(parsed.data.ROUND_DURATION),
  cooldownDuration: Number(parsed.data.COOLDOWN_DURATION),
  port: Number(parsed.data.PORT)
};
