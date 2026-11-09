import { store } from '../lib/store.js';
import { logger } from '../lib/logger.js';
import { transcribeAudio } from './stt.js';
import { generateFeedback } from './llm.js';
import { computeMetrics, type MetricsResult } from '@speaksharp/shared';

// In-memory cache for full computed metrics (includes filler/pause detail arrays)
const computedMetricsCache = new Map<string, MetricsResult>();

export function getComputedMetrics(sessionId: string): MetricsResult | null {
  return computedMetricsCache.get(sessionId) ?? null;
}

export async function processSessionPipeline(
  sessionId: string,
  audioBuffer: Buffer,
  mimeType: string,
  promptId?: string | null,
): Promise<void> {
  logger.info('Starting session analysis pipeline', { sessionId, mimeType });

  try {
    // 1. STT Transcription
    logger.info('Pipeline step 1: Transcribing audio', { sessionId });
    const sttResult = await transcribeAudio(audioBuffer, mimeType);

    await store.saveTranscript({
      session_id: sessionId,
      text: sttResult.text,
      words: sttResult.words,
    });

    // 2. Deterministic Metrics Engine
    logger.info('Pipeline step 2: Computing hard metrics', { sessionId });
    const metrics = computeMetrics(sttResult.words);
    computedMetricsCache.set(sessionId, metrics);

    await store.saveMetrics({
      session_id: sessionId,
      wpm: metrics.wpm,
      filler_count: metrics.fillerCount,
      filler_rate: metrics.fillerRatePerMin,
      pause_count: metrics.pauseCount,
      longest_pause: metrics.longestPause,
      lexical_diversity: metrics.lexicalDiversity,
    });

    // 3. Prompt Lookup for Context
    const prompt = promptId ? await store.getPromptById(promptId) : null;

    // 4. LLM Feedback
    logger.info('Pipeline step 3: Generating AI coaching feedback', { sessionId });
    const feedbackPayload = await generateFeedback(
      sttResult.text,
      metrics,
      prompt?.title,
    );

    await store.saveFeedback({
      session_id: sessionId,
      overall_score: feedbackPayload.overallScore,
      payload: feedbackPayload,
      tts_audio_path: null,
    });

    // 5. Complete session
    await store.updateSession(sessionId, {
      status: 'complete',
      duration_sec: metrics.totalSpeakingTimeSeconds || sttResult.duration,
      error: null,
    });

    logger.info('Session analysis pipeline completed successfully', {
      sessionId,
      overallScore: feedbackPayload.overallScore,
      wpm: metrics.wpm,
      fillerCount: metrics.fillerCount,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Session analysis pipeline failed', { sessionId, error: errorMessage });

    await store.updateSession(sessionId, {
      status: 'failed',
      error: errorMessage,
    });
  }
}
