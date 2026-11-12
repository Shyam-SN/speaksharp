import { store } from '../lib/store.js';
import { logger } from '../lib/logger.js';
import * as stt from './stt.js';
import { generateFeedback } from './llm.js';
import {
  computeMetrics,
  checkTranscriptCoverage,
  type MetricsResult,
} from '@speaksharp/shared';

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
  clientDurationMs?: number,
): Promise<void> {
  logger.info('Starting session analysis pipeline', {
    sessionId,
    mimeType,
    clientDurationMs,
  });

  try {
    // 1. STT Transcription - Server-side Whisper is the ONLY source of truth
    logger.info('Pipeline step 1: Transcribing audio via server-side Whisper', { sessionId });
    const sttResult = await stt.transcribeAudio(audioBuffer, mimeType);

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

    // 3. Transcript Coverage Check
    const recordingDurationSec =
      typeof clientDurationMs === 'number' && clientDurationMs > 0
        ? clientDurationMs / 1000
        : sttResult.duration;

    const transcriptLastWordEnd =
      sttResult.words.length > 0
        ? (sttResult.words[sttResult.words.length - 1]?.end ?? 0)
        : sttResult.duration;

    const { coverageWarning, coverageRatio } = checkTranscriptCoverage(
      recordingDurationSec,
      transcriptLastWordEnd,
    );

    if (coverageWarning) {
      logger.warn('Transcript coverage warning: less than 70% of audio captured', {
        sessionId,
        recordingDurationSec,
        transcriptLastWordEnd,
        coverageRatio,
      });
    }

    // 4. Prompt Lookup for Context
    const prompt = promptId ? await store.getPromptById(promptId) : null;

    // 5. LLM Feedback
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

    // 6. Complete session
    await store.updateSession(sessionId, {
      status: 'complete',
      duration_sec: metrics.totalSpeakingTimeSeconds || transcriptLastWordEnd,
      recording_duration_sec: Math.round(recordingDurationSec * 10) / 10,
      coverage_warning: coverageWarning,
      error: null,
    });

    logger.info('Session analysis pipeline completed successfully', {
      sessionId,
      overallScore: feedbackPayload.overallScore,
      wpm: metrics.wpm,
      fillerCount: metrics.fillerCount,
      recordingDurationSec,
      coverageWarning,
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
