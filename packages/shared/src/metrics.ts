import type { TranscriptWord, MetricsResult } from './types.js';
import {
  SINGLE_WORD_FILLERS,
  CONTEXTUAL_FILLERS,
  MULTI_WORD_FILLERS,
  PAUSE_THRESHOLD_SECONDS,
  CONTEXTUAL_PAUSE_SECONDS,
  PACE_THRESHOLDS,
  type PaceLabel,
} from './constants.js';

export function computePaceLabel(wpm: number): PaceLabel {
  if (wpm < PACE_THRESHOLDS.TOO_SLOW_MAX) {
    return 'too slow';
  }
  if (wpm > PACE_THRESHOLDS.TOO_FAST_MIN) {
    return 'too fast';
  }
  return 'good';
}

/**
 * Pure metrics engine calculating WPM, fillers, pauses, and lexical diversity.
 */
export function computeMetrics(words: TranscriptWord[]): MetricsResult {
  if (!words || words.length === 0) {
    return {
      wpm: 0,
      fillerCount: 0,
      fillerRatePerMin: 0,
      pauseCount: 0,
      longestPause: 0,
      lexicalDiversity: 0,
      paceLabel: 'too slow',
      totalSpeakingTimeSeconds: 0,
      fillers: [],
      pauses: [],
    };
  }

  // Initial scaffold - will be fully expanded with comprehensive heuristics & edge cases in M2
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  const totalDuration =
    firstWord && lastWord ? Math.max(0, lastWord.end - firstWord.start) : 0;
  const speakingMinutes = totalDuration > 0 ? totalDuration / 60 : 0;
  const wpm = speakingMinutes > 0 ? Math.round(words.length / speakingMinutes) : 0;

  return {
    wpm,
    fillerCount: 0,
    fillerRatePerMin: 0,
    pauseCount: 0,
    longestPause: 0,
    lexicalDiversity: 1,
    paceLabel: computePaceLabel(wpm),
    totalSpeakingTimeSeconds: Math.round(totalDuration * 10) / 10,
    fillers: [],
    pauses: [],
  };
}

export {
  SINGLE_WORD_FILLERS,
  CONTEXTUAL_FILLERS,
  MULTI_WORD_FILLERS,
  PAUSE_THRESHOLD_SECONDS,
  CONTEXTUAL_PAUSE_SECONDS,
  PACE_THRESHOLDS,
};

