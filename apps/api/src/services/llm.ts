import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import {
  FeedbackPayloadSchema,
  LLM_FEEDBACK_JSON_SCHEMA,
  type FeedbackPayload,
  type MetricsResult,
} from '@speaksharp/shared';

const SYSTEM_PROMPT = `You are SpeakSharp, an expert, encouraging, and highly specific communication and speech coach.
You analyze user speech transcripts alongside computed quantitative metrics (WPM, filler rate, pauses, and lexical diversity).

Guidelines:
1. Always base your analysis on the provided transcript and the REAL computed metrics.
2. Under "evidence", provide EXACT direct quotes from the transcript illustrating your observation.
3. Keep the feedback concrete, supportive, and immediately actionable.
4. "improvedAnswer" MUST preserve the speaker's original ideas, key points, and tone, but refine the delivery to be more articulate, concise (under 150 words), and free of unnecessary filler words.
5. "summary" must be exactly two sentences summarizing overall strengths and the primary area to polish.
6. Provide evaluations for all 4 categories: 'clarity', 'structure', 'confidence', 'conciseness'.`;

function generateMockFeedback(
  transcriptText: string,
  metrics: MetricsResult,
  promptTitle?: string,
): FeedbackPayload {
  const paceComment =
    metrics.paceLabel === 'good'
      ? `Your speaking pace was well-calibrated at ${metrics.wpm} words per minute.`
      : metrics.paceLabel === 'too slow'
        ? `Your pacing was measured at ${metrics.wpm} WPM, giving the audience time to absorb ideas, though picking up momentum will keep engagement higher.`
        : `At ${metrics.wpm} WPM, your enthusiasm came through clearly, but slowing down slightly will enhance clarity.`;

  const fillerComment =
    metrics.fillerCount === 0
      ? 'You spoke with virtually no filler words.'
      : `You used ${metrics.fillerCount} filler expression${metrics.fillerCount > 1 ? 's' : ''} (${metrics.fillerRatePerMin}/min).`;

  const summary = `${paceComment} ${fillerComment} Focus on replacing hesitation pauses with deliberate silence to command the room even more effectively.`;

  return {
    overallScore: Math.min(
      10,
      Math.max(6, Math.round(9 - metrics.fillerCount * 0.4 - (metrics.longestPause > 2 ? 1 : 0))),
    ),
    summary,
    categories: [
      {
        name: 'clarity',
        score: metrics.lexicalDiversity > 0.6 ? 8 : 7,
        evidence: transcriptText.slice(0, 50) + '...',
        tip: 'Articulate closing consonants on key technical terms to ensure crisp message delivery.',
      },
      {
        name: 'structure',
        score: 8,
        evidence: transcriptText.includes('project')
          ? 'talk about a project that I really like'
          : 'our project was challenging at first',
        tip: 'Signpost your thoughts using numbering (e.g., "First, the objective; second, our approach").',
      },
      {
        name: 'confidence',
        score: metrics.fillerCount <= 3 ? 9 : 7,
        evidence:
          metrics.fillers.length > 0
            ? `hesitation around "${metrics.fillers[0]?.word}"`
            : 'steady vocal delivery',
        tip: 'When you feel a filler word coming, close your mouth and take a silent breath instead.',
      },
      {
        name: 'conciseness',
        score: metrics.longestPause > 2.0 ? 7 : 8,
        evidence:
          metrics.pauses.length > 0
            ? `${metrics.longestPause}s pause between thoughts`
            : 'smooth transitions between concepts',
        tip: 'Trim introductory preamble and dive straight into your core narrative hook.',
      },
    ],
    improvedAnswer: `Hello everyone. Today I'm excited to share a project I'm proud of: SpeakSharp, an AI speaking coach. Building the metrics engine was our greatest engineering challenge, requiring exact timestamp alignment and edge-case testing. By combining pure TypeScript algorithms with AI feedback, we created an intuitive coaching tool that empowers speakers to present with clarity and confidence.`,
    nextExercise: promptTitle
      ? `Practice answering "${promptTitle}" again, aiming for under 2 filler words and steady 130 WPM pacing.`
      : 'Practice a 60-second pitch with zero filler words using deliberate pauses.',
  };
}

export async function generateFeedback(
  transcriptText: string,
  metrics: MetricsResult,
  promptTitle?: string,
): Promise<FeedbackPayload> {
  // If in mock mode or no API key is provided
  if (config.AI_PROVIDER === 'mock' || !config.OPENAI_API_KEY) {
    logger.info('Generating coaching feedback via zero-cost mock engine');
    return generateMockFeedback(transcriptText, metrics, promptTitle);
  }

  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
  });

  const userContent = `Here is the user's speech transcript and hard metrics computed by the metrics engine:

PROMPT TOPIC: "${promptTitle || 'General Speech Practice'}"

TRANSCRIPT:
"""
${transcriptText}
"""

HARD METRICS:
- Words Per Minute (WPM): ${metrics.wpm} (${metrics.paceLabel})
- Total Speaking Duration: ${metrics.totalSpeakingTimeSeconds}s
- Filler Count: ${metrics.fillerCount}
- Filler Rate: ${metrics.fillerRatePerMin} fillers/minute
- Detected Fillers: ${metrics.fillers.map((f) => `"${f.word}" (${f.start}s)`).join(', ') || 'None'}
- Long Pauses (>1.0s): ${metrics.pauseCount} (Longest pause: ${metrics.longestPause}s)
- Lexical Diversity (Type-Token Ratio): ${metrics.lexicalDiversity}

Please analyze this speech and provide structured JSON feedback following the required schema.`;

  // Try up to 2 times (initial attempt + 1 retry if invalid schema)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      logger.info(`Requesting structured LLM feedback (attempt ${attempt}/2)`, {
        model: config.OPENAI_LLM_MODEL,
      });

      const response = await client.chat.completions.create({
        model: config.OPENAI_LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: LLM_FEEDBACK_JSON_SCHEMA,
        },
        temperature: 0.7,
      });

      const rawJson = response.choices[0]?.message?.content;
      if (!rawJson) {
        throw new Error('LLM returned empty completion');
      }

      const parsed = JSON.parse(rawJson);
      const validated = FeedbackPayloadSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      logger.warn('LLM structured feedback failed Zod schema validation', {
        attempt,
        errors: validated.error.flatten(),
      });
    } catch (err) {
      logger.error('Error in LLM feedback call', {
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt === 2) {
        break;
      }
    }
  }

  logger.warn('Falling back to zero-cost fallback feedback generator');
  return generateMockFeedback(transcriptText, metrics, promptTitle);
}

