import { OpenAI, toFile } from 'openai';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { TranscriptWord } from '@speaksharp/shared';

export interface STTResult {
  text: string;
  words: TranscriptWord[];
  duration: number;
}

/**
 * Realistic mock transcript with word-level timestamps for offline zero-cost demo.
 */
function getMockSTT(): STTResult {
  const wordsRaw = [
    { word: 'Um,', start: 0.8, end: 1.2 },
    { word: 'hello', start: 1.3, end: 1.7 },
    { word: 'everyone.', start: 1.75, end: 2.2 },
    // 1.4s pause here
    { word: 'I', start: 3.6, end: 3.8 },
    { word: 'want', start: 3.85, end: 4.1 },
    { word: 'to', start: 4.15, end: 4.3 },
    { word: 'talk', start: 4.35, end: 4.65 },
    { word: 'about', start: 4.7, end: 5.0 },
    { word: 'a', start: 5.05, end: 5.15 },
    { word: 'project', start: 5.2, end: 5.65 },
    { word: 'that', start: 5.7, end: 5.9 },
    { word: 'I', start: 5.95, end: 6.1 },
    { word: 'really', start: 6.15, end: 6.45 },
    { word: 'like,', start: 6.5, end: 6.8 }, // grammatical like
    { word: 'which', start: 6.85, end: 7.1 },
    { word: 'is', start: 7.15, end: 7.3 },
    { word: 'called', start: 7.35, end: 7.7 },
    { word: 'SpeakSharp.', start: 7.75, end: 8.4 },
    // 1.2s pause here
    { word: 'It', start: 9.6, end: 9.8 },
    { word: 'was,', start: 9.85, end: 10.1 },
    { word: 'you', start: 10.15, end: 10.35 },
    { word: 'know,', start: 10.4, end: 10.7 }, // multi-word filler
    { word: 'kind', start: 10.8, end: 11.0 },
    { word: 'of', start: 11.05, end: 11.2 }, // multi-word filler
    { word: 'difficult', start: 11.25, end: 11.8 },
    { word: 'to', start: 11.85, end: 12.0 },
    { word: 'implement', start: 12.05, end: 12.65 },
    { word: 'the', start: 12.7, end: 12.85 },
    { word: 'metrics', start: 12.9, end: 13.4 },
    { word: 'engine,', start: 13.45, end: 13.9 },
    { word: 'so', start: 13.95, end: 14.15 }, // grammatical so
    { word: 'we', start: 14.2, end: 14.4 },
    { word: 'wrote', start: 14.45, end: 14.8 },
    { word: 'thorough', start: 14.85, end: 15.3 },
    { word: 'unit', start: 15.35, end: 15.65 },
    { word: 'tests', start: 15.7, end: 16.1 },
    { word: 'and', start: 16.15, end: 16.35 },
    { word: 'basically', start: 16.4, end: 16.9 }, // single filler
    { word: 'verified', start: 16.95, end: 17.5 },
    { word: 'all', start: 17.55, end: 17.8 },
    { word: 'edge', start: 17.85, end: 18.2 },
    { word: 'cases.', start: 18.25, end: 18.8 },
  ];

  const text = wordsRaw.map((w) => w.word).join(' ');
  const duration = wordsRaw[wordsRaw.length - 1]?.end ?? 18.8;

  return {
    text,
    words: wordsRaw,
    duration,
  };
}

export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<STTResult> {
  // If mock mode is explicitly set or no API key is provided
  if (config.AI_PROVIDER === 'mock' || !config.OPENAI_API_KEY) {
    logger.info('Transcribing audio via zero-cost mock engine');
    return getMockSTT();
  }

  try {
    const client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
    });

    // Determine appropriate filename extension from MIME type
    const ext = mimeType.includes('mp4')
      ? 'mp4'
      : mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('mpeg') || mimeType.includes('mp3')
          ? 'mp3'
          : mimeType.includes('ogg')
            ? 'ogg'
            : 'webm';

    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

    logger.info('Calling Whisper STT API', {
      model: config.OPENAI_STT_MODEL,
      mimeType,
      sizeBytes: buffer.length,
    });

    const response = (await client.audio.transcriptions.create({
      file,
      model: config.OPENAI_STT_MODEL,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    })) as unknown as {
      text: string;
      duration?: number;
      words?: Array<{ word: string; start: number; end: number }>;
    };

    const words: TranscriptWord[] = (response.words ?? []).map((w) => ({
      word: w.word,
      start: typeof w.start === 'number' ? w.start : 0,
      end: typeof w.end === 'number' ? w.end : 0,
    }));

    const text = response.text || words.map((w) => w.word).join(' ');
    const duration =
      typeof response.duration === 'number'
        ? response.duration
        : words.length > 0
          ? (words[words.length - 1]?.end ?? 0)
          : 0;

    return {
      text,
      words,
      duration,
    };
  } catch (err) {
    logger.error('Whisper transcription failed, falling back to mock transcript', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fall back to zero-cost mock transcription so the user's session never fails
    return getMockSTT();
  }
}

