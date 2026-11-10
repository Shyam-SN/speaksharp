import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import {
  FeedbackPayloadSchema,
  LLM_FEEDBACK_JSON_SCHEMA,
  type FeedbackPayload,
  type MetricsResult,
} from '@speaksharp/shared';

const SYSTEM_PROMPT = `You are SpeakSharp, an expert communication coach.
Analyze the user's speech transcript and hard metrics.
CITE direct transcript quotes in evidence.
Under 'improvedAnswer', produce a genuine, polished first-person spoken delivery (≤ 150 words) that fixes grammar, removes fillers, and sounds like a confident professional speaker. Do NOT add meta commentary like "In this speech, I wanted to say". Write the actual speech the user should speak.`;

/**
 * Transforms raw transcribed speech into a natural, eloquent spoken delivery.
 * Strips repeated words, removes fillers, repairs broken grammar, and structures
 * into a compelling first-person speech.
 */
export function craftPolishedSpeech(rawText: string, promptTitle?: string): string {
  const text = rawText.trim();
  const titleLower = (promptTitle || '').toLowerCase();

  // 1. Clean repetitive stuttered words (e.g. "hi hi hi hi" -> "Hi")
  let cleaned = text
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1')
    .replace(/\b(um|uh|er|ah|basically|literally|you know|kind of|sort of)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 2. Fix common conversational fragments
  cleaned = cleaned
    .replace(/^(hi|hello|hey)(\s+(hi|hello|hey))*/i, '')
    .trim()
    .replace(/^been\s+working/i, 'I have been working')
    .replace(/in\s+the\s+software\s+domain/i, 'in software engineering')
    .replace(/on\s+the\s+software\s+domain/i, 'in software engineering')
    .replace(/for\s+the\s+past\s+(\d+)\s+years/i, 'for the past $1 years')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // 3. Assemble polished first-person speech based on prompt topic
  if (titleLower.includes('intro') || titleLower.includes('yourself')) {
    const coreDetail = cleaned.length > 5 ? cleaned : 'I have been working in software engineering for the past three years';
    return `Hello everyone! My name is [Your Name]. ${coreDetail}. Throughout my career, I've focused on building scalable, user-centric applications and solving technical challenges with modern web technologies. I'm passionate about continuous learning and excited to connect with all of you today.`;
  }

  if (titleLower.includes('project')) {
    return `Hi everyone. Today I'd like to share a project I've developed recently. ${cleaned}. Our goal was to solve a critical user problem by combining robust architecture with clean user experience. Through iterative testing and performance optimization, we delivered measurable results that I'm very proud of.`;
  }

  if (titleLower.includes('pitch')) {
    return `Hello! Consider a common challenge many teams face every day: inefficient workflows that drain hours of productive time. ${cleaned}. Our solution streamlines this entire process, delivering immediate value through automated insights and an intuitive interface. We're excited to bring this vision to market.`;
  }

  // General polished spoken delivery
  return `Hello everyone. ${cleaned}. By focusing on clear execution, steady pacing, and direct communication, we can deliver our message with maximum impact. Thank you for your time.`;
}

export function generateDynamicFeedback(
  transcriptText: string,
  metrics: MetricsResult,
  promptTitle?: string,
): FeedbackPayload {
  const words = transcriptText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const quoteSnippet = (start = 0, count = 6) => {
    const slice = words.slice(start, start + count).join(' ');
    return slice || transcriptText.slice(0, 30) || 'speech sample';
  };

  const polishedVersion = craftPolishedSpeech(transcriptText, promptTitle);

  // If user only spoke very few words (under 15 words)
  if (wordCount < 15) {
    const quote = transcriptText.trim() || 'brief greeting';

    return {
      overallScore: 6,
      summary: `You spoke only ${wordCount} words ("${quote}"). While your greeting is clear, expanding into complete sentences with your background and goals will allow your audience to connect with you.`,
      categories: [
        {
          name: 'clarity',
          score: 7,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Pronounce each word cleanly, and follow up your greeting immediately with who you are and what you do.',
        },
        {
          name: 'structure',
          score: 5,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Use the 3-part intro structure: 1) Friendly Greeting, 2) Core Background & Experience, 3) Forward-looking Closing.',
        },
        {
          name: 'confidence',
          score: 6,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Commit to speaking for at least 30 to 45 seconds without stopping prematurely.',
        },
        {
          name: 'conciseness',
          score: 6,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Avoid repeating greetings like "hi hi"; deliver a single crisp opening and move into your story.',
        },
      ],
      improvedAnswer: polishedVersion,
      nextExercise: promptTitle
        ? `Record "${promptTitle}" again. Deliver a complete 4-sentence introduction (aim for 30-45 seconds).`
        : 'Practice a 45-second professional self-introduction covering your role, experience, and passions.',
    };
  }

  // Full response evaluation
  const paceComment =
    metrics.paceLabel === 'good'
      ? `Your speaking pace was well-calibrated at ${metrics.wpm} words per minute.`
      : metrics.paceLabel === 'too slow'
        ? `Your pacing was measured at ${metrics.wpm} WPM; picking up momentum will keep audience engagement high.`
        : `At ${metrics.wpm} WPM, your pacing was brisk; pausing periodically will help listeners retain key points.`;

  const fillerComment =
    metrics.fillerCount === 0
      ? 'You spoke cleanly with zero detected filler words.'
      : `You used ${metrics.fillerCount} filler word${metrics.fillerCount > 1 ? 's' : ''} (${metrics.fillerRatePerMin}/min).`;

  const summary = `${paceComment} ${fillerComment} Focus on deliberate pauses between concepts to emphasize your message.`;

  return {
    overallScore: Math.min(
      10,
      Math.max(6, Math.round(9 - metrics.fillerCount * 0.3 - (metrics.longestPause > 2 ? 1 : 0))),
    ),
    summary,
    categories: [
      {
        name: 'clarity',
        score: metrics.lexicalDiversity > 0.6 ? 8 : 7,
        evidence: `"${quoteSnippet(0, 6)}"`,
        tip: 'Emphasize key nouns and technical terms with deliberate vocal inflection.',
      },
      {
        name: 'structure',
        score: 8,
        evidence: `"${quoteSnippet(Math.floor(words.length / 2), 6)}"`,
        tip: 'Use verbal signposts (such as "First", "Secondly", "In summary") to guide the listener.',
      },
      {
        name: 'confidence',
        score: metrics.fillerCount <= 2 ? 9 : 7,
        evidence:
          metrics.fillers.length > 0
            ? `hesitation around "${metrics.fillers[0]?.word}"`
            : `steady vocal delivery: "${quoteSnippet(0, 5)}"`,
        tip: 'When you feel a hesitation filler coming, take a calm silent breath instead of voicing a sound.',
      },
      {
        name: 'conciseness',
        score: metrics.longestPause > 2.0 ? 7 : 8,
        evidence:
          metrics.pauses.length > 0
            ? `${metrics.longestPause}s pause between phrases`
            : `fluent flow: "${quoteSnippet(words.length - 6, 6)}"`,
        tip: 'Eliminate preamble and dive straight into the crux of your message.',
      },
    ],
    improvedAnswer: polishedVersion,
    nextExercise: promptTitle
      ? `Practice answering "${promptTitle}" once more, focusing on smooth pacing and fewer filler words.`
      : 'Practice a 60-second response with zero filler words using deliberate pauses.',
  };
}

export async function generateFeedback(
  transcriptText: string,
  metrics: MetricsResult,
  promptTitle?: string,
): Promise<FeedbackPayload> {
  // If in mock mode or no API key is provided
  if (config.AI_PROVIDER === 'mock' || !config.OPENAI_API_KEY) {
    logger.info('Generating coaching feedback via dynamic zero-cost engine');
    return generateDynamicFeedback(transcriptText, metrics, promptTitle);
  }

  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
  });

  const userContent = `Here is the user's speech transcript and hard metrics:

PROMPT TOPIC: "${promptTitle || 'General Speech Practice'}"

TRANSCRIPT:
"""
${transcriptText}
"""

HARD METRICS:
- WPM: ${metrics.wpm} (${metrics.paceLabel})
- Speaking Duration: ${metrics.totalSpeakingTimeSeconds}s
- Filler Count: ${metrics.fillerCount} (${metrics.fillerRatePerMin}/min)
- Detected Fillers: ${metrics.fillers.map((f) => `"${f.word}" (${f.start}s)`).join(', ') || 'None'}
- Pauses (>1.0s): ${metrics.pauseCount} (Longest: ${metrics.longestPause}s)
- Lexical Diversity: ${metrics.lexicalDiversity}

Please analyze this speech and provide structured JSON feedback following the required schema.
Under 'improvedAnswer', write an eloquent, natural first-person speech (under 150 words) that fixes grammar, eliminates repeated words and fillers, and sounds like a polished speaker delivering the answer.`;

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

  logger.warn('Falling back to dynamic zero-cost fallback feedback generator');
  return generateDynamicFeedback(transcriptText, metrics, promptTitle);
}
