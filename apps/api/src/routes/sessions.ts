import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { checkSessionRateLimit, getRateLimitStatus } from '../middleware/rate-limit.js';
import { store } from '../lib/store.js';
import { processSessionPipeline, getComputedMetrics } from '../services/pipeline.js';
import { generateImprovedTTS } from '../services/tts.js';
import { logger } from '../lib/logger.js';
import type { SessionRecord } from '@speaksharp/shared';

export const sessionsRouter = Router();

// Configure multer memory storage with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimePrefixes = ['audio/'];
    const isAllowed = allowedMimePrefixes.some((prefix) => file.mimetype.startsWith(prefix));
    if (isAllowed || file.mimetype === 'video/webm' || file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio recordings are supported.'));
    }
  },
});

/**
 * POST /api/sessions
 * Upload an audio recording and start async coaching analysis
 */
sessionsRouter.post(
  '/',
  requireAuth,
  checkSessionRateLimit,
  upload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: 'No audio file uploaded. Send audio file as multipart field "audio".',
          code: 'MISSING_FILE',
        });
        return;
      }

      const promptId = typeof req.body.promptId === 'string' ? req.body.promptId : null;
      const sessionId = randomUUID();
      const ext = req.file.mimetype.includes('mp4') ? 'mp4' : 'webm';
      const storagePath = `audio/${user.id}/${sessionId}.${ext}`;

      // Save audio to storage
      await store.uploadAudio(storagePath, req.file.buffer, req.file.mimetype);

      // Create session in processing state
      const newSession: SessionRecord = {
        id: sessionId,
        user_id: user.id,
        prompt_id: promptId,
        audio_path: storagePath,
        duration_sec: null,
        status: 'processing',
        error: null,
        created_at: new Date().toISOString(),
      };

      await store.createSession(newSession);

      // Launch async pipeline in background
      processSessionPipeline(sessionId, req.file.buffer, req.file.mimetype, promptId).catch(
        (err) => {
          logger.error('Unhandled pipeline background error', {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        },
      );

      // Return 202 Accepted immediately
      res.status(202).json({
        sessionId,
        status: 'processing',
      });
    } catch (err) {
      logger.error('Error handling session upload', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({
        error: 'Failed to process audio upload',
        code: 'UPLOAD_FAILED',
      });
    }
  },
);

/**
 * GET /api/sessions/quota
 * Retrieve current user's remaining daily session allowance
 */
sessionsRouter.get(
  '/quota',
  requireAuth,
  (req: Request, res: Response): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
      return;
    }

    const quota = getRateLimitStatus(user.id, user.isAnonymous);
    res.status(200).json(quota);
  },
);

/**
 * POST /api/sessions/:id/tts
 * Generate or return cached TTS audio for the improved answer
 */
sessionsRouter.post(
  '/:id/tts',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const sessionId = req.params['id'];
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'Session ID is required', code: 'INVALID_ID' });
        return;
      }

      const session = await store.getSessionById(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
        return;
      }

      if (session.user_id !== user.id) {
        res.status(403).json({ error: 'Access denied to this session', code: 'FORBIDDEN' });
        return;
      }

      const feedback = await store.getFeedback(sessionId);
      if (!feedback?.payload?.improvedAnswer) {
        res.status(400).json({
          error: 'Session does not have an improved answer to synthesize',
          code: 'NO_IMPROVED_ANSWER',
        });
        return;
      }

      const ttsAudioUrl = await generateImprovedTTS(
        sessionId,
        feedback.payload.improvedAnswer,
      );

      res.status(200).json({ ttsAudioUrl });
    } catch (err) {
      logger.error('Failed to handle session TTS request', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'TTS generation failed', code: 'TTS_FAILED' });
    }
  },
);

/**
 * GET /api/sessions/:id
 * Retrieve details, transcript, metrics, and coaching feedback for a session
 */
sessionsRouter.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const sessionId = req.params['id'];
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'Session ID is required', code: 'INVALID_ID' });
        return;
      }

      const computedMetrics = getComputedMetrics(sessionId);
      const detail = await store.getSessionDetail(sessionId, computedMetrics);

      if (!detail) {
        res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
        return;
      }

      // Check ownership (security: users can only view their own sessions)
      if (detail.session.user_id !== user.id) {
        res.status(403).json({
          error: 'Access denied: You do not own this speaking session',
          code: 'FORBIDDEN',
        });
        return;
      }

      res.status(200).json(detail);
    } catch (err) {
      logger.error('Error fetching session detail', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to retrieve session', code: 'SERVER_ERROR' });
    }
  },
);

/**
 * GET /api/sessions
 * List past sessions for the authenticated user
 */
sessionsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const sessions = await store.getUserSessions(user.id);
      res.status(200).json({ sessions });
    } catch (err) {
      logger.error('Error fetching user sessions', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to list sessions', code: 'SERVER_ERROR' });
    }
  },
);
