import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/index.js';
import { resetRateLimits } from '../src/middleware/rate-limit.js';
import * as stt from '../src/services/stt.js';

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

    it('returns 400 when uploaded audio file exceeds 25MB limit', async () => {
      const hugeBuffer = Buffer.alloc(25 * 1024 * 1024 + 1);
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-token')
        .attach('audio', hugeBuffer, 'huge.wav');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FILE_TOO_LARGE');
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

    it('processes 60-second audio fixture, ignores client words, and computes >50s speaking time', async () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/60s_speech.wav');
      expect(fs.existsSync(fixturePath)).toBe(true);
      const fixtureBuffer = fs.readFileSync(fixturePath);

      // Generate 60s of word timestamps (55s of speaking time: 1.0s to 56.0s)
      const mock60sWords = Array.from({ length: 110 }, (_, i) => ({
        word: i === 0 ? 'Welcome' : i === 50 ? 'basically' : `word${i}`,
        start: 1.0 + i * 0.5,
        end: 1.0 + i * 0.5 + 0.35,
      }));

      const spy = vi.spyOn(stt, 'transcribeAudio').mockResolvedValueOnce({
        text: mock60sWords.map((w) => w.word).join(' '),
        words: mock60sWords,
        duration: 57.0,
      });

      // Upload with fake client words and clientDurationMs = 60000
      const uploadRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-token')
        .field('clientDurationMs', '60000')
        .field('words', JSON.stringify([{ word: 'fake_client_truncated', start: 0, end: 11.5 }]))
        .field('text', 'fake client text')
        .attach('audio', fixtureBuffer, {
          filename: '60s_speech.wav',
          contentType: 'audio/wav',
        });

      expect(uploadRes.status).toBe(202);
      const sessionId = uploadRes.body.sessionId;

      await new Promise((resolve) => setTimeout(resolve, 200));

      const detailRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', 'Bearer demo-token');

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.session.status).toBe('complete');

      // Assert server-side STT was used and client words were completely ignored
      expect(detailRes.body.transcript.text).not.toContain('fake_client_truncated');
      expect(detailRes.body.transcript.text).toContain('Welcome');

      // Assert total speaking time is > 50s
      expect(detailRes.body.metrics.totalSpeakingTimeSeconds).toBeGreaterThan(50);
      expect(detailRes.body.session.recording_duration_sec).toBe(60);
      expect(detailRes.body.session.coverage_warning).toBe(false);

      spy.mockRestore();
    });

    it('flags coverage_warning when 60s recording only has 11.5s transcript', async () => {
      const mockAudio = Buffer.from('SHORT_TRANSCRIPT_TEST_AUDIO');

      // Mock STT returning only 11.5 seconds of speech
      const spy = vi.spyOn(stt, 'transcribeAudio').mockResolvedValueOnce({
        text: 'hello short answer only',
        words: [
          { word: 'hello', start: 1.0, end: 1.5 },
          { word: 'short', start: 1.6, end: 2.0 },
          { word: 'answer', start: 2.1, end: 3.0 },
          { word: 'only', start: 11.0, end: 11.5 },
        ],
        duration: 11.5,
      });

      const uploadRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-token')
        .field('clientDurationMs', '60000') // 60 seconds
        .attach('audio', mockAudio, 'test.webm');

      expect(uploadRes.status).toBe(202);
      const sessionId = uploadRes.body.sessionId;

      await new Promise((resolve) => setTimeout(resolve, 200));

      const detailRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', 'Bearer demo-token');

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.session.status).toBe('complete');
      expect(detailRes.body.session.recording_duration_sec).toBe(60);
      // 11.5s / 60s = 19% coverage (<70%) -> coverage_warning must be true!
      expect(detailRes.body.session.coverage_warning).toBe(true);

      spy.mockRestore();
    });

    it('returns user session list on GET /api/sessions', async () => {
      const res = await request(app)
        .get('/api/sessions')
        .set('Authorization', 'Bearer demo-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBeGreaterThan(0);
    });

    it('generates and returns cached TTS audio on POST /api/sessions/:id/tts', async () => {
      // Create session first
      const mockAudio = Buffer.from('FAKE_AUDIO_FOR_TTS');
      const upload = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer demo-token')
        .attach('audio', mockAudio, 'audio.webm');

      const sessionId = upload.body.sessionId;
      await new Promise((r) => setTimeout(r, 150)); // let pipeline finish

      // Request TTS
      const ttsRes = await request(app)
        .post(`/api/sessions/${sessionId}/tts`)
        .set('Authorization', 'Bearer demo-token');

      expect(ttsRes.status).toBe(200);
      expect(ttsRes.body).toHaveProperty('useBrowserSpeech');
      expect(
        ttsRes.body.ttsAudioUrl === null || typeof ttsRes.body.ttsAudioUrl === 'string',
      ).toBe(true);
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

