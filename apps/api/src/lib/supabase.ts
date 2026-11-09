import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';

let supabaseAdmin: SupabaseClient | null = null;

export function isMockSupabase(): boolean {
  return (
    !config.SUPABASE_URL ||
    config.SUPABASE_URL.includes('mock-project') ||
    !config.SUPABASE_SERVICE_ROLE_KEY ||
    config.SUPABASE_SERVICE_ROLE_KEY.includes('mock')
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (isMockSupabase()) {
    return null;
  }

  if (!supabaseAdmin) {
    try {
      supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      logger.info('Supabase admin client initialized');
    } catch (err) {
      logger.error('Failed to initialize Supabase client', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  return supabaseAdmin;
}

