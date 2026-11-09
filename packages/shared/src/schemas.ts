import { z } from 'zod';

export const TranscriptWordSchema = z.object({
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

export const DetectedFillerSchema = z.object({
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  isMultiWord: z.boolean(),
});

export const DetectedPauseSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  duration: z.number().nonnegative(),
});

export const MetricsResultSchema = z.object({
  wpm: z.number().nonnegative(),
  fillerCount: z.number().int().nonnegative(),
  fillerRatePerMin: z.number().nonnegative(),
  pauseCount: z.number().int().nonnegative(),
  longestPause: z.number().nonnegative(),
  lexicalDiversity: z.number().min(0).max(1),
  paceLabel: z.enum(['too slow', 'good', 'too fast']),
  totalSpeakingTimeSeconds: z.number().nonnegative(),
  fillers: z.array(DetectedFillerSchema),
  pauses: z.array(DetectedPauseSchema),
});

export const FeedbackCategorySchema = z.object({
  name: z.enum(['clarity', 'structure', 'confidence', 'conciseness']),
  score: z.number().int().min(1).max(10),
  evidence: z.string().min(1),
  tip: z.string().min(1),
});

export const FeedbackPayloadSchema = z.object({
  overallScore: z.number().int().min(1).max(10),
  summary: z.string().min(1),
  categories: z.array(FeedbackCategorySchema).length(4),
  improvedAnswer: z.string().min(1).max(1200),
  nextExercise: z.string().min(1),
});

/**
 * OpenAI Structured Outputs JSON Schema representation (strict: true compatible).
 * Matches OpenAI API requirements: additionalProperties: false, all properties required.
 */
export const LLM_FEEDBACK_JSON_SCHEMA = {
  name: 'speech_coaching_feedback',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      overallScore: {
        type: 'integer',
        description: 'Overall speaking score from 1 (poor) to 10 (exceptional).',
      },
      summary: {
        type: 'string',
        description: 'Exactly 2 concise sentences summarizing the overall performance.',
      },
      categories: {
        type: 'array',
        description: 'Array of 4 coaching categories: clarity, structure, confidence, conciseness.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              enum: ['clarity', 'structure', 'confidence', 'conciseness'],
              description: 'The coaching category evaluated.',
            },
            score: {
              type: 'integer',
              description: 'Score from 1 to 10 for this category.',
            },
            evidence: {
              type: 'string',
              description: 'A direct quote from the transcript demonstrating this score.',
            },
            tip: {
              type: 'string',
              description: 'One specific, concrete, actionable improvement tip.',
            },
          },
          required: ['name', 'score', 'evidence', 'tip'],
          additionalProperties: false,
        },
      },
      improvedAnswer: {
        type: 'string',
        description: 'An improved, polished rewrite of the user response (maximum 150 words).',
      },
      nextExercise: {
        type: 'string',
        description: 'One recommended speaking challenge or exercise for the next session.',
      },
    },
    required: ['overallScore', 'summary', 'categories', 'improvedAnswer', 'nextExercise'],
    additionalProperties: false,
  },
} as const;

