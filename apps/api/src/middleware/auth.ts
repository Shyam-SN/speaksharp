import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  isAnonymous: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or malformed Authorization header. Bearer token required.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      error: 'Invalid Authorization token.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  // Support demo / guest reviewer mode instantly
  if (token === 'demo-token' || token.startsWith('demo-')) {
    req.user = {
      id: token === 'demo-token' ? 'demo-user-default' : token,
      isAnonymous: true,
    };
    next();
    return;
  }

  const supabase = getSupabaseAdmin();

  // If Supabase is not configured (offline zero-cost mode), create an anonymous user session
  if (!supabase) {
    req.user = {
      id: `local-user-${token.slice(0, 12)}`,
      isAnonymous: true,
    };
    next();
    return;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Token validation failed', { error: error?.message });
      res.status(401).json({
        error: 'Invalid or expired session token.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const isAnonymous =
      user.app_metadata?.['provider'] === 'anonymous' ||
      user.is_anonymous === true;

    req.user = {
      id: user.id,
      email: user.email,
      isAnonymous,
    };

    next();
  } catch (err) {
    logger.error('Unexpected auth verification error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      error: 'Authentication verification failed.',
      code: 'AUTH_ERROR',
    });
  }
}

