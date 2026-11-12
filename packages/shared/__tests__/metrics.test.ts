import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  detectFillers,
  detectPauses,
  computeLexicalDiversity,
  computePaceLabel,
  normalizeToken,
  checkTranscriptCoverage,
} from '../src/metrics.js';
import type { TranscriptWord } from '../src/types.js';

describe('Metrics Engine', () => {
  describe('normalizeToken', () => {
    it('strips leading and trailing punctuation and converts to lowercase', () => {
      expect(normalizeToken('Like,')).toBe('like');
      expect(normalizeToken('...Um...')).toBe('um');
      expect(normalizeToken('"actually"')).toBe('actually');
      expect(normalizeToken('Right?!')).toBe('right');
    });
  });

  describe('Edge case: Empty and single-word inputs', () => {
    it('1. handles empty words array gracefully with zeroed metrics', () => {
      const result = computeMetrics([]);
      expect(result.wpm).toBe(0);
      expect(result.fillerCount).toBe(0);
      expect(result.fillerRatePerMin).toBe(0);
      expect(result.pauseCount).toBe(0);
      expect(result.longestPause).toBe(0);
      expect(result.lexicalDiversity).toBe(0);
      expect(result.paceLabel).toBe('too slow');
      expect(result.totalSpeakingTimeSeconds).toBe(0);
      expect(result.fillers).toEqual([]);
      expect(result.pauses).toEqual([]);
    });

    it('2. handles a single word without errors or false pauses', () => {
      const words: TranscriptWord[] = [{ word: 'Hello', start: 1.0, end: 1.5 }];
      const result = computeMetrics(words);
      expect(result.fillerCount).toBe(0);
      expect(result.pauseCount).toBe(0);
      expect(result.longestPause).toBe(0);
      expect(result.lexicalDiversity).toBe(1);
      expect(result.totalSpeakingTimeSeconds).toBe(0.5);
      expect(result.wpm).toBeGreaterThan(0);
    });
  });

  describe('Filler detection', () => {
    it('3. detects all single-word fillers when all words are fillers', () => {
      const words: TranscriptWord[] = [
        { word: 'Um', start: 0.0, end: 0.4 },
        { word: 'uh', start: 0.5, end: 0.8 },
        { word: 'er', start: 0.9, end: 1.2 },
        { word: 'basically', start: 1.3, end: 1.8 },
        { word: 'literally', start: 1.9, end: 2.4 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(5);
      expect(fillers.map((f) => f.word)).toEqual([
        'um',
        'uh',
        'er',
        'basically',
        'literally',
      ]);
      expect(fillers.every((f) => !f.isMultiWord)).toBe(true);
    });

    it('4. detects multi-word filler "you know"', () => {
      const words: TranscriptWord[] = [
        { word: 'I', start: 0.0, end: 0.2 },
        { word: 'think', start: 0.3, end: 0.6 },
        { word: 'you', start: 0.7, end: 0.9 },
        { word: 'know', start: 0.95, end: 1.2 },
        { word: 'this', start: 1.3, end: 1.5 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(1);
      const first = fillers[0];
      expect(first?.word).toBe('you know');
      expect(first?.isMultiWord).toBe(true);
      expect(first?.start).toBe(0.7);
      expect(first?.end).toBe(1.2);
    });

    it('5. detects multi-word filler "i mean"', () => {
      const words: TranscriptWord[] = [
        { word: 'Well', start: 0.0, end: 0.3 },
        { word: 'I', start: 0.4, end: 0.5 },
        { word: 'mean', start: 0.55, end: 0.8 },
        { word: 'sure', start: 0.9, end: 1.2 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(1);
      const first = fillers[0];
      expect(first?.word).toBe('i mean');
      expect(first?.isMultiWord).toBe(true);
    });

    it('6. detects multi-word filler "kind of"', () => {
      const words: TranscriptWord[] = [
        { word: 'It', start: 0.0, end: 0.2 },
        { word: 'was', start: 0.25, end: 0.4 },
        { word: 'kind', start: 0.5, end: 0.7 },
        { word: 'of', start: 0.75, end: 0.9 },
        { word: 'difficult', start: 1.0, end: 1.5 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(1);
      const first = fillers[0];
      expect(first?.word).toBe('kind of');
      expect(first?.isMultiWord).toBe(true);
    });

    it('7. detects multi-word filler "sort of"', () => {
      const words: TranscriptWord[] = [
        { word: 'We', start: 0.0, end: 0.2 },
        { word: 'sort', start: 0.3, end: 0.5 },
        { word: 'of', start: 0.55, end: 0.7 },
        { word: 'agreed', start: 0.8, end: 1.2 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(1);
      const first = fillers[0];
      expect(first?.word).toBe('sort of');
      expect(first?.isMultiWord).toBe(true);
    });

    it('8. classifies "like" as a filler when at start of speech (index 0)', () => {
      const words: TranscriptWord[] = [
        { word: 'Like', start: 0.0, end: 0.3 },
        { word: 'we', start: 0.4, end: 0.6 },
        { word: 'started', start: 0.65, end: 1.0 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(1);
      expect(fillers[0]?.word).toBe('like');
    });

    it('9. does NOT classify "like" as a filler when used grammatically in a phrase', () => {
      const words: TranscriptWord[] = [
        { word: 'I', start: 0.0, end: 0.2 },
        { word: 'really', start: 0.22, end: 0.45 },
        { word: 'like', start: 0.48, end: 0.68 },
        { word: 'building', start: 0.7, end: 1.0 },
        { word: 'software', start: 1.05, end: 1.5 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(0);
    });

    it('10. classifies "so" as a filler after a hesitation pause', () => {
      const words: TranscriptWord[] = [
        { word: 'First', start: 0.0, end: 0.3 },
        // 0.8s gap between 0.3 and 1.1s
        { word: 'so', start: 1.1, end: 1.3 },
        { word: 'we', start: 1.35, end: 1.5 },
        { word: 'proceeded', start: 1.55, end: 2.0 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(1);
      expect(fillers[0]?.word).toBe('so');
    });

    it('11. does NOT classify "so" as a filler in fluent grammatical conjunction', () => {
      const words: TranscriptWord[] = [
        { word: 'It', start: 0.0, end: 0.15 },
        { word: 'rained', start: 0.18, end: 0.45 },
        { word: 'so', start: 0.48, end: 0.6 },
        { word: 'we', start: 0.62, end: 0.75 },
        { word: 'stayed', start: 0.78, end: 1.1 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(0);
    });

    it('12. handles chained consecutive fillers correctly', () => {
      const words: TranscriptWord[] = [
        { word: 'Um', start: 0.0, end: 0.3 },
        { word: 'like', start: 0.35, end: 0.6 },
        { word: 'so', start: 0.65, end: 0.85 },
        { word: 'basically', start: 0.9, end: 1.3 },
      ];
      const fillers = detectFillers(words);
      expect(fillers.length).toBe(4);
      expect(fillers.map((f) => f.word)).toEqual(['um', 'like', 'so', 'basically']);
    });
  });

  describe('Pause detection', () => {
    it('13. detects gaps > 1.0s and ignores gaps <= 1.0s', () => {
      const words: TranscriptWord[] = [
        { word: 'Hello', start: 0.0, end: 0.5 },
        // Gap: 1.5 - 0.5 = 1.0s (not strictly > 1.0s)
        { word: 'there', start: 1.5, end: 2.0 },
        // Gap: 3.5 - 2.0 = 1.5s (> 1.0s, should be detected)
        { word: 'world', start: 3.5, end: 4.0 },
      ];
      const pauses = detectPauses(words);
      expect(pauses.length).toBe(1);
      const pause = pauses[0];
      expect(pause?.duration).toBe(1.5);
      expect(pause?.start).toBe(2.0);
      expect(pause?.end).toBe(3.5);
    });

    it('14. detects no pauses in continuous fluent speech', () => {
      const words: TranscriptWord[] = [
        { word: 'This', start: 0.0, end: 0.3 },
        { word: 'is', start: 0.35, end: 0.5 },
        { word: 'a', start: 0.52, end: 0.6 },
        { word: 'continuous', start: 0.65, end: 1.1 },
        { word: 'sentence', start: 1.15, end: 1.6 },
      ];
      const pauses = detectPauses(words);
      expect(pauses.length).toBe(0);
    });

    it('15. correctly computes the longest pause', () => {
      const words: TranscriptWord[] = [
        { word: 'A', start: 0.0, end: 0.5 },
        // 1.2s pause
        { word: 'B', start: 1.7, end: 2.2 },
        // 2.8s pause
        { word: 'C', start: 5.0, end: 5.5 },
      ];
      const result = computeMetrics(words);
      expect(result.pauseCount).toBe(2);
      expect(result.longestPause).toBe(2.8);
    });
  });

  describe('Pace brackets and WPM', () => {
    it('16. assigns pace labels accurately across thresholds', () => {
      expect(computePaceLabel(95)).toBe('too slow');
      expect(computePaceLabel(109)).toBe('too slow');
      expect(computePaceLabel(110)).toBe('good');
      expect(computePaceLabel(135)).toBe('good');
      expect(computePaceLabel(160)).toBe('good');
      expect(computePaceLabel(161)).toBe('too fast');
      expect(computePaceLabel(200)).toBe('too fast');
    });

    it('17. accurately calculates WPM for known word counts and time', () => {
      // 120 words spoken in 60 seconds = 120 WPM
      const words: TranscriptWord[] = Array.from({ length: 120 }, (_, idx) => ({
        word: `word${idx}`,
        start: idx * 0.5,
        end: idx * 0.5 + 0.4,
      }));
      // First start = 0, last end = 119 * 0.5 + 0.4 = 59.9s ~ 1 min
      const result = computeMetrics(words);
      expect(result.wpm).toBe(120);
      expect(result.paceLabel).toBe('good');
    });
  });

  describe('Lexical diversity', () => {
    it('18. computes 1.0 for completely unique vocabulary', () => {
      const words: TranscriptWord[] = [
        { word: 'The', start: 0, end: 0.2 },
        { word: 'quick', start: 0.3, end: 0.6 },
        { word: 'brown', start: 0.7, end: 1.0 },
        { word: 'fox', start: 1.1, end: 1.4 },
      ];
      expect(computeLexicalDiversity(words)).toBe(1);
    });

    it('19. computes accurate low ratio for repetitive words', () => {
      const words: TranscriptWord[] = [
        { word: 'talk', start: 0, end: 0.3 },
        { word: 'talk', start: 0.4, end: 0.7 },
        { word: 'talk', start: 0.8, end: 1.1 },
      ];
      // 1 unique / 3 total = 0.33
      expect(computeLexicalDiversity(words)).toBe(0.33);
    });
  });

  describe('Silence exclusion and realistic speech', () => {
    it('20. excludes leading and trailing silence from speaking time and WPM', () => {
      // Audio starts recording at 0.0s, speech doesn't begin until 5.0s, ends at 15.0s
      const words: TranscriptWord[] = [
        { word: 'Hello', start: 5.0, end: 5.5 },
        { word: 'there', start: 6.0, end: 6.5 },
        { word: 'world', start: 14.5, end: 15.0 },
      ];
      const result = computeMetrics(words);
      // Duration must be 15.0 - 5.0 = 10.0s (not 15s)
      expect(result.totalSpeakingTimeSeconds).toBe(10.0);
    });

    it('21. handles realistic multi-feature transcript accurately', () => {
      const transcript: TranscriptWord[] = [
        { word: 'Um,', start: 1.0, end: 1.4 },
        { word: 'hello', start: 1.5, end: 1.9 },
        { word: 'everyone.', start: 2.0, end: 2.5 },
        // 1.5s pause
        { word: 'I', start: 4.0, end: 4.2 },
        { word: 'would', start: 4.25, end: 4.5 },
        { word: 'like', start: 4.55, end: 4.8 }, // grammatical like
        { word: 'to', start: 4.85, end: 5.0 },
        { word: 'present', start: 5.05, end: 5.5 },
        { word: 'our', start: 5.55, end: 5.75 },
        { word: 'project,', start: 5.8, end: 6.2 },
        { word: 'you', start: 6.3, end: 6.5 },
        { word: 'know,', start: 6.55, end: 6.85 }, // you know filler
        { word: 'it', start: 6.9, end: 7.1 },
        { word: 'is', start: 7.15, end: 7.3 },
        { word: 'basically', start: 7.35, end: 7.8 }, // basically filler
        { word: 'complete.', start: 7.85, end: 8.4 },
      ];

      const result = computeMetrics(transcript);

      // Total duration = 8.4 - 1.0 = 7.4 seconds
      expect(result.totalSpeakingTimeSeconds).toBe(7.4);
      // Pauses: 4.0 - 2.5 = 1.5s
      expect(result.pauseCount).toBe(1);
      expect(result.longestPause).toBe(1.5);
      // Fillers: 'um', 'you know', 'basically' -> count is 3
      expect(result.fillerCount).toBe(3);
      expect(result.fillers.map((f) => f.word)).toEqual(['um', 'you know', 'basically']);
      // Rate per min > 0
      expect(result.fillerRatePerMin).toBeGreaterThan(0);
      expect(result.lexicalDiversity).toBeGreaterThan(0.5);
    });
  });

  describe('Transcript Coverage Check', () => {
    it('23. flags coverage warning when transcript covers <70% of recording (>15s)', () => {
      // 60s recording with only 11.5s transcribed (19% coverage) -> warning triggered
      const result = checkTranscriptCoverage(60.0, 11.5);
      expect(result.coverageWarning).toBe(true);
      expect(result.coverageRatio).toBe(0.19);
    });

    it('24. does not flag warning when transcript covers >=70% of recording', () => {
      // 60s recording with 52s transcribed (87% coverage) -> normal
      const result = checkTranscriptCoverage(60.0, 52.0);
      expect(result.coverageWarning).toBe(false);
      expect(result.coverageRatio).toBe(0.87);
    });

    it('25. does not flag warning for short recordings <= 15s even with brief speech', () => {
      // 10s recording with 3s speech (30% coverage) -> no warning because <= 15s
      const result = checkTranscriptCoverage(10.0, 3.0);
      expect(result.coverageWarning).toBe(false);
      expect(result.coverageRatio).toBe(0.3);
    });

    it('26. handles zero or negative duration safely', () => {
      const result = checkTranscriptCoverage(0, 0);
      expect(result.coverageWarning).toBe(false);
      expect(result.coverageRatio).toBe(1);
    });
  });
});

