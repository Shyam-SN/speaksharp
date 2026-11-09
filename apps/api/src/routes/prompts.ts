import { Router, type Request, type Response } from 'express';
import { store } from '../lib/store.js';
import { logger } from '../lib/logger.js';

export const promptsRouter = Router();

promptsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const prompts = await store.getPrompts();
    res.status(200).json({ prompts });
  } catch (err) {
    logger.error('Error fetching prompts', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to retrieve prompts', code: 'SERVER_ERROR' });
  }
});

