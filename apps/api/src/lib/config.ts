import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env from cwd and workspace folders
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

// Force mock provider during automated test execution
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  process.env.AI_PROVIDER = 'mock';
}

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Supabase
  SUPABASE_URL: z.string().default('https://mock-project.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('mock-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('mock-service-role-key'),

  // AI Provider & models
  AI_PROVIDER: z
    .enum(['mock', 'groq', 'openai'])
    .default(process.env.NODE_ENV === 'test' || process.env.VITEST ? 'mock' : 'mock'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_STT_MODEL: z.string().default('whisper-large-v3'),
  OPENAI_LLM_MODEL: z.string().default('openai/gpt-oss-120b'),
  OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),
  OPENAI_TTS_VOICE: z.string().default('nova'),

  // Rate Limiting
  RATE_LIMIT_PER_DAY: z.string().default('20').transform(Number),
  RATE_LIMIT_ANON_PER_DAY: z.string().default('5').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const config = parsed.data;

