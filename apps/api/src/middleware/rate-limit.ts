import type { Request, Response, NextFunction } from 'express';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp in ms
}

// In-memory rate limit store: userId -> entry
const usageMap = new Map<string, RateLimitEntry>();

export function getRateLimitStatus(userId: string, isAnonymous: boolean) {
  const limit = isAnonymous
    ? config.RATE_LIMIT_ANON_PER_DAY
    : config.RATE_LIMIT_PER_DAY;

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let record = usageMap.get(userId);
  if (!record || now >= record.resetAt) {
    record = {
      count: 0,
      resetAt: now + ONE_DAY_MS,
    };
    usageMap.set(userId, record);
  }

  const remaining = Math.max(0, limit - record.count);
  const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

  return {
    limit,
    used: record.count,
    remaining,
    resetSeconds,
  };
}

export function checkSessionRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  const status = getRateLimitStatus(user.id, user.isAnonymous);

  res.setHeader('X-RateLimit-Limit', status.limit);
  res.setHeader('X-RateLimit-Remaining', status.remaining);
  res.setHeader('X-RateLimit-Reset', status.resetSeconds);

  if (status.used >= status.limit) {
    logger.warn('Rate limit exceeded', {
      userId: user.id,
      isAnonymous: user.isAnonymous,
      limit: status.limit,
    });
    res.status(429).json({
      error: `Daily session limit reached (${status.limit} sessions/day). Please try again tomorrow${
        user.isAnonymous ? ' or sign in for a higher quota' : ''
      }.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: status.resetSeconds,
      quota: status,
    });
    return;
  }

  // Increment usage
  const entry = usageMap.get(user.id);
  if (entry) {
    entry.count += 1;
  }

  next();
}

/**
 * Resets rate limit for tests
 */
export function resetRateLimits(): void {
  usageMap.clear();
}
