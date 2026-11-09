import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetRateLimits } from '../src/middleware/rate-limit.js';

describe('SpeakSharp API Routes (Integration)', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  describe('GET /health', () => {
    it('returns 200 OK and health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('SpeakSharp API');
    });
  });

  describe('GET /api/prompts', () => {
    it('returns a list of available practice prompts', async () => {
      const res = await request(app).get('/api/prompts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.prompts)).toBe(true);
      expect(res.body.prompts.length).toBeGreaterThan(0);
      expect(res.body.prompts[0]).toHaveProperty('title');
      expect(res.body.prompts[0]).toHaveProperty('category');
    });
  });

  describe('Auth and Validation on POST /api/sessions', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).post('/api/sessions');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when no audio file is provided', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-token');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FILE');
    });
  });

  describe('Full Session Lifecycle: Upload -> Process -> Retrieve', () => {
    it('uploads audio, accepts with 202, runs pipeline, and returns full details', async () => {
      // Create a dummy audio buffer (representing webm/opus audio)
      const mockAudioBuffer = Buffer.from('FAKE_WEBM_AUDIO_RECORDING_DATA');

      // 1. Upload audio
      const uploadRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-token')
        .field('promptId', 'p1-intro')
        .attach('audio', mockAudioBuffer, {
          filename: 'recording.webm',
          contentType: 'audio/webm',
        });

      expect(uploadRes.status).toBe(202);
      expect(uploadRes.body).toHaveProperty('sessionId');
      expect(uploadRes.body.status).toBe('processing');

      const sessionId = uploadRes.body.sessionId;

      // Give the async pipeline a brief moment to process
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 2. Retrieve session details
      const detailRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', 'Bearer demo-token');

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.session.id).toBe(sessionId);
      expect(detailRes.body.session.status).toBe('complete');

      // 3. Verify transcript was stored and analyzed
      expect(detailRes.body.transcript).toBeDefined();
      expect(detailRes.body.transcript.words.length).toBeGreaterThan(0);

      // 4. Verify hard metrics were computed
      expect(detailRes.body.metrics).toBeDefined();
      expect(detailRes.body.metrics.wpm).toBeGreaterThan(0);
      expect(detailRes.body.metrics).toHaveProperty('fillerCount');
      expect(detailRes.body.metrics).toHaveProperty('lexicalDiversity');

      // 5. Verify coaching feedback payload
      expect(detailRes.body.feedback).toBeDefined();
      expect(detailRes.body.feedback.overall_score).toBeGreaterThanOrEqual(1);
      expect(detailRes.body.feedback.overall_score).toBeLessThanOrEqual(10);
      expect(detailRes.body.feedback.payload.categories.length).toBe(4);
      expect(detailRes.body.feedback.payload.improvedAnswer).toBeTruthy();
    });

    it('returns user session list on GET /api/sessions', async () => {
      const res = await request(app)
        .get('/api/sessions')
        .set('Authorization', 'Bearer demo-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBeGreaterThan(0);
    });

    it('returns 403 when trying to access another user session', async () => {
      // Upload session as user A
      const mockAudioBuffer = Buffer.from('FAKE_WEBM_DATA');
      const uploadRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-user-A')
        .attach('audio', mockAudioBuffer, 'test.webm');

      const sessionId = uploadRes.body.sessionId;

      // Try to read session as user B
      const accessRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', 'Bearer demo-user-B');

      expect(accessRes.status).toBe(403);
      expect(accessRes.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Rate Limiting', () => {
    it('enforces daily rate limit for anonymous users', async () => {
      const mockAudioBuffer = Buffer.from('TEST_AUDIO');
      const token = 'demo-user-rate-test';

      // Config rate limit for anonymous is 5 per day
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/sessions')
          .set('Authorization', `Bearer ${token}`)
          .attach('audio', mockAudioBuffer, 'audio.webm');
        expect(res.status).toBe(202);
      }

      // 6th request should exceed rate limit
      const blockedRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', mockAudioBuffer, 'audio.webm');

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(blockedRes.headers['retry-after'] || blockedRes.body.retryAfterSeconds).toBeDefined();
    });
  });
});
