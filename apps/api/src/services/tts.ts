import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { store } from '../lib/store.js';

export interface TTSResult {
  url: string | null;
  useBrowserSpeech: boolean;
}

export async function generateImprovedTTS(
  sessionId: string,
  text: string,
): Promise<TTSResult> {
  // 1. If in mock mode or without an OpenAI key, signal browser synthesis for 100% free high-quality voice
  if (config.AI_PROVIDER === 'mock' || !config.OPENAI_API_KEY) {
    logger.info('Using browser-native speech synthesis for zero-cost audio playback', { sessionId });
    return { url: null, useBrowserSpeech: true };
  }

  // 2. Check if feedback already has a cached TTS audio path
  const feedback = await store.getFeedback(sessionId);
  if (feedback?.tts_audio_path) {
    logger.info('Returning cached TTS audio URL', { sessionId, path: feedback.tts_audio_path });
    const signedUrl = await store.getAudioSignedUrl(feedback.tts_audio_path);
    return { url: signedUrl, useBrowserSpeech: false };
  }

  const storagePath = `tts/${sessionId}.mp3`;

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

    const signedUrl = await store.getAudioSignedUrl(storagePath);
    return { url: signedUrl, useBrowserSpeech: false };
  } catch (err) {
    logger.error('Failed to generate TTS via OpenAI, falling back to browser speech synthesis', {
      error: err instanceof Error ? err.message : String(err),
    });

    return { url: null, useBrowserSpeech: true };
  }
}
