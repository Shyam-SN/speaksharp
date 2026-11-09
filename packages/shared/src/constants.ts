/**
 * Single-word filler words to track.
 */
export const SINGLE_WORD_FILLERS = [
  'um',
  'uh',
  'er',
  'ah',
  'like',
  'so',
  'actually',
  'basically',
  'literally',
  'right',
] as const;

/**
 * Contextual fillers: 'like' and 'so' are only fillers when at sentence/phrase start
 * (gap before > 0.5s or at index 0) or preceded immediately by another filler word.
 */
export const CONTEXTUAL_FILLERS = ['like', 'so'] as const;

/**
 * Multi-word filler phrases to track (lowercased).
 */
export const MULTI_WORD_FILLERS = [
  'you know',
  'i mean',
  'kind of',
  'sort of',
] as const;

/**
 * Pause threshold in seconds: gaps between consecutive words > 1.0s are marked as pauses.
 */
export const PAUSE_THRESHOLD_SECONDS = 1.0;

/**
 * Threshold for contextual pause before 'like' or 'so' to treat it as filler.
 */
export const CONTEXTUAL_PAUSE_SECONDS = 0.5;

/**
 * Pace brackets in Words Per Minute (WPM).
 */
export const PACE_THRESHOLDS = {
  TOO_SLOW_MAX: 110,
  GOOD_MIN: 110,
  GOOD_MAX: 160,
  TOO_FAST_MIN: 160,
} as const;

export type PaceLabel = 'too slow' | 'good' | 'too fast';

