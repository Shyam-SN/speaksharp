import type { TranscriptWord, DetectedFiller, DetectedPause, MetricsResult } from './types.js';
import {
  SINGLE_WORD_FILLERS,
  CONTEXTUAL_FILLERS,
  MULTI_WORD_FILLERS,
  PAUSE_THRESHOLD_SECONDS,
  CONTEXTUAL_PAUSE_SECONDS,
  PACE_THRESHOLDS,
  type PaceLabel,
} from './constants.js';

/**
 * Normalizes a word token by converting to lowercase and stripping outer punctuation.
 * E.g. "Like," -> "like", "um..." -> "um", "“great”" -> "great"
 */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
}

/**
 * Determines the pace label based on Words Per Minute.
 * - < 110 wpm: "too slow"
 * - 110 - 160 wpm: "good"
 * - > 160 wpm: "too fast"
 */
export function computePaceLabel(
  wpm: number,
  thresholds = PACE_THRESHOLDS,
): PaceLabel {
  if (wpm < thresholds.TOO_SLOW_MAX) {
    return 'too slow';
  }
  if (wpm > thresholds.TOO_FAST_MIN) {
    return 'too fast';
  }
  return 'good';
}

/**
 * Heuristic check for contextual fillers ("like" and "so"):
 *
 * In spoken English, "like" and "so" frequently serve grammatical roles:
 * - "I like dogs" (verb)
 * - "It is big, so we bought it" (conjunction)
 *
 * We classify "like" or "so" as a filler ONLY when in typical hesitation positions:
 * 1. At the very start of speech (index 0).
 * 2. Immediately following a pause (gap >= CONTEXTUAL_PAUSE_SECONDS, e.g. 0.5s) from previous word.
 * 3. Immediately followed by a pause (gap >= CONTEXTUAL_PAUSE_SECONDS) to the next word.
 * 4. Preceded immediately by another detected filler (e.g. "um, like", "uh, so").
 */
export function isContextualFillerPosition(
  index: number,
  words: TranscriptWord[],
  precedingWasFiller: boolean,
  pauseThreshold = CONTEXTUAL_PAUSE_SECONDS,
): boolean {
  // Case 1: First word spoken
  if (index === 0) {
    return true;
  }

  // Case 4: Chained with a preceding filler ("um like", "basically so")
  if (precedingWasFiller) {
    return true;
  }

  const current = words[index];
  const previous = words[index - 1];
  const next = words[index + 1];

  if (!current) return false;

  // Case 2: Preceding pause (gap >= 0.5s)
  if (previous && current.start - previous.end >= pauseThreshold) {
    return true;
  }

  // Case 3: Trailing pause before next word (gap >= 0.5s)
  if (next && next.start - current.end >= pauseThreshold) {
    return true;
  }

  return false;
}

/**
 * Detects both single-word and multi-word filler expressions with start/end timestamps.
 */
export function detectFillers(words: TranscriptWord[]): DetectedFiller[] {
  if (!words || words.length === 0) {
    return [];
  }

  const fillers: DetectedFiller[] = [];
  const normalizedWords = words.map((w) => normalizeToken(w.word));
  let i = 0;

  // Pre-process multi-word fillers into token arrays
  const multiWordDefinitions = MULTI_WORD_FILLERS.map((phrase) => ({
    phrase,
    tokens: phrase.split(' '),
  }));

  const singleWordSet = new Set<string>(SINGLE_WORD_FILLERS);
  const contextualSet = new Set<string>(CONTEXTUAL_FILLERS);

  let lastTokenWasFiller = false;

  while (i < words.length) {
    let matchedMulti = false;

    // 1. Check for multi-word fillers first (greedy matching)
    for (const def of multiWordDefinitions) {
      const { phrase, tokens } = def;
      if (i + tokens.length <= words.length) {
        const sliceMatches = tokens.every((token, offset) => {
          return normalizedWords[i + offset] === token;
        });

        if (sliceMatches) {
          const first = words[i];
          const last = words[i + tokens.length - 1];
          if (first && last) {
            fillers.push({
              word: phrase,
              start: first.start,
              end: last.end,
              isMultiWord: true,
            });
            i += tokens.length;
            matchedMulti = true;
            lastTokenWasFiller = true;
            break;
          }
        }
      }
    }

    if (matchedMulti) {
      continue;
    }

    // 2. Check for single-word fillers
    const currentWord = words[i];
    const currentToken = normalizedWords[i];

    if (currentWord && currentToken) {
      if (contextualSet.has(currentToken)) {
        // Apply contextual heuristic for "like" / "so"
        const isFiller = isContextualFillerPosition(
          i,
          words,
          lastTokenWasFiller,
        );
        if (isFiller) {
          fillers.push({
            word: currentToken,
            start: currentWord.start,
            end: currentWord.end,
            isMultiWord: false,
          });
          lastTokenWasFiller = true;
        } else {
          lastTokenWasFiller = false;
        }
      } else if (singleWordSet.has(currentToken)) {
        fillers.push({
          word: currentToken,
          start: currentWord.start,
          end: currentWord.end,
          isMultiWord: false,
        });
        lastTokenWasFiller = true;
      } else {
        lastTokenWasFiller = false;
      }
    }

    i++;
  }

  return fillers;
}

/**
 * Detects gaps between consecutive words exceeding pauseThreshold (default 1.0s).
 */
export function detectPauses(
  words: TranscriptWord[],
  thresholdSeconds = PAUSE_THRESHOLD_SECONDS,
): DetectedPause[] {
  if (!words || words.length < 2) {
    return [];
  }

  const pauses: DetectedPause[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const current = words[i];
    const next = words[i + 1];

    if (!current || !next) continue;

    const gap = next.start - current.end;
    if (gap > thresholdSeconds) {
      pauses.push({
        start: current.end,
        end: next.start,
        duration: Math.round(gap * 100) / 100,
      });
    }
  }

  return pauses;
}

/**
 * Computes lexical diversity (Type-Token Ratio = unique words / total words).
 * Returns a number between 0 and 1 rounded to 2 decimal places.
 */
export function computeLexicalDiversity(words: TranscriptWord[]): number {
  if (!words || words.length === 0) {
    return 0;
  }

  const tokens = words
    .map((w) => normalizeToken(w.word))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return 0;
  }

  const uniqueTokens = new Set(tokens);
  const ratio = uniqueTokens.size / tokens.length;
  return Math.round(ratio * 100) / 100;
}

/**
 * Pure metrics engine: computes WPM, fillers, pauses, lexical diversity, and pace label.
 *
 * Input: TranscriptWord[] with start/end timestamps.
 * Output: Complete MetricsResult object.
 */
export function computeMetrics(
  words: TranscriptWord[],
  options?: {
    pauseThresholdSeconds?: number;
    paceThresholds?: typeof PACE_THRESHOLDS;
  },
): MetricsResult {
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

  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  if (!firstWord || !lastWord) {
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

  // Exclude leading/trailing silence by measuring from first word start to last word end
  const durationSec = Math.max(0, lastWord.end - firstWord.start);
  const durationMinutes = durationSec > 0 ? durationSec / 60 : 0;

  // Words per minute calculation
  const rawWpm = durationMinutes > 0 ? words.length / durationMinutes : 0;
  const wpm = Math.round(rawWpm);

  // Fillers
  const fillers = detectFillers(words);
  const fillerCount = fillers.length;
  const rawFillerRate = durationMinutes > 0 ? fillerCount / durationMinutes : 0;
  const fillerRatePerMin = Math.round(rawFillerRate * 10) / 10;

  // Pauses
  const pauseThreshold = options?.pauseThresholdSeconds ?? PAUSE_THRESHOLD_SECONDS;
  const pauses = detectPauses(words, pauseThreshold);
  const pauseCount = pauses.length;
  const longestPause =
    pauseCount > 0 ? Math.max(...pauses.map((p) => p.duration)) : 0;

  // Lexical Diversity
  const lexicalDiversity = computeLexicalDiversity(words);

  // Pace Label
  const paceLabel = computePaceLabel(wpm, options?.paceThresholds);

  return {
    wpm,
    fillerCount,
    fillerRatePerMin,
    pauseCount,
    longestPause: Math.round(longestPause * 100) / 100,
    lexicalDiversity,
    paceLabel,
    totalSpeakingTimeSeconds: Math.round(durationSec * 10) / 10,
    fillers,
    pauses,
  };
}

/**
 * Evaluates whether speech transcription adequately covered the audio recording.
 * Flagged if transcript covers < 70% of recording duration for recordings > 15 seconds.
 */
export function checkTranscriptCoverage(
  recordingDurationSec: number,
  transcriptDurationSec: number,
): { coverageWarning: boolean; coverageRatio: number } {
  if (recordingDurationSec <= 0) {
    return { coverageWarning: false, coverageRatio: 1 };
  }
  const ratio = Math.max(0, transcriptDurationSec / recordingDurationSec);
  const coverageRatio = Math.round(ratio * 100) / 100;
  const coverageWarning = recordingDurationSec > 15 && ratio < 0.7;
  return { coverageWarning, coverageRatio };
}
