import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  IVY_API_KEY:      z.string().min(1, 'IVY_API_KEY is required'),
  IVY_BASE_URL:     z.string().url().default('https://solve.ivy.homes'),
  PORT:             z.coerce.number().int().positive().default(4000),
  NODE_ENV:         z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_ORIGIN:  z.string().url().default('http://localhost:5173'),
  COOKIE_SECRET:    z.string().min(8, 'COOKIE_SECRET must be at least 8 chars'),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('❌ Environment validation failed:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
