import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { store } from '../lib/store.js';

export async function generateImprovedTTS(
  sessionId: string,
  text: string,
): Promise<string> {
  // 1. Check if feedback already has a cached TTS audio path
  const feedback = await store.getFeedback(sessionId);
  if (feedback?.tts_audio_path) {
    logger.info('Returning cached TTS audio URL', { sessionId, path: feedback.tts_audio_path });
    return store.getAudioSignedUrl(feedback.tts_audio_path);
  }

  const storagePath = `tts/${sessionId}.mp3`;

  // 2. If in mock mode or without an OpenAI key, generate a lightweight MP3 or signal browser synthesis
  if (config.AI_PROVIDER === 'mock' || !config.OPENAI_API_KEY) {
    logger.info('Generating zero-cost simulated TTS audio', { sessionId });
    // Minimal valid silent MP3 frame for offline audio playback
    const mockMp3Buffer = Buffer.from([
      0xff, 0xfb, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    await store.uploadAudio(storagePath, mockMp3Buffer, 'audio/mpeg');
    if (feedback) {
      await store.saveFeedback({
        ...feedback,
        tts_audio_path: storagePath,
      });
    }

    return store.getAudioSignedUrl(storagePath);
  }

  // 3. Call OpenAI TTS API
  try {
    const client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
    });

    logger.info('Calling OpenAI TTS API', {
      model: config.OPENAI_TTS_MODEL,
      voice: config.OPENAI_TTS_VOICE,
      charLength: text.length,
    });

    const response = await client.audio.speech.create({
      model: config.OPENAI_TTS_MODEL,
      voice: config.OPENAI_TTS_VOICE as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text.slice(0, 4096),
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Cache audio in storage
    await store.uploadAudio(storagePath, buffer, 'audio/mpeg');

    // 5. Update feedback record with cached path
    if (feedback) {
      await store.saveFeedback({
        ...feedback,
        tts_audio_path: storagePath,
      });
    }

    return store.getAudioSignedUrl(storagePath);
  } catch (err) {
    logger.error('Failed to generate TTS via OpenAI, falling back to cached silent placeholder', {
      error: err instanceof Error ? err.message : String(err),
    });

    const fallbackBuffer = Buffer.from([0xff, 0xfb, 0x90, 0x44, 0x00]);
    await store.uploadAudio(storagePath, fallbackBuffer, 'audio/mpeg');
    return store.getAudioSignedUrl(storagePath);
  }
}
