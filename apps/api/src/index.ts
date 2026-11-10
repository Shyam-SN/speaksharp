import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { sessionsRouter } from './routes/sessions.js';
import { promptsRouter } from './routes/prompts.js';
import { audioRouter } from './routes/audio.js';

export const app = express();

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (mobile apps, curl) or any Vercel/localhost/tunnel origin
      if (!requestOrigin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.use(express.json());

// Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/prompts', promptsRouter);
app.use('/api/audio', audioRouter);

// Healthcheck endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'SpeakSharp API',
    provider: config.AI_PROVIDER,
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  logger.error('Unhandled request error', { error: message });
  res.status(500).json({
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
  });
});

if (process.env['NODE_ENV'] !== 'test') {
  app.listen(config.PORT, () => {
    logger.info(`SpeakSharp API server listening on port ${config.PORT}`, {
      port: config.PORT,
      provider: config.AI_PROVIDER,
      nodeEnv: config.NODE_ENV,
    });
  });
}
