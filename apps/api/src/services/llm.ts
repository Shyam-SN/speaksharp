import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import {
  FeedbackPayloadSchema,
  LLM_FEEDBACK_JSON_SCHEMA,
  type FeedbackPayload,
  type MetricsResult,
} from '@speaksharp/shared';

const SYSTEM_PROMPT = `You are SpeakSharp, an expert executive communication and speaking coach.
Analyze the user's speech transcript and hard metrics.
CITE direct transcript quotes in evidence.

CRITICAL RULES for 'improvedAnswer':
1. First-person voice ONLY: Write exactly what the speaker should say out loud (e.g. "Hello everyone, I am Shyam...").
2. ZERO meta-commentary: NEVER write "In this response, I wanted to say...", "The speaker conveys...", or critique the speaker inside improvedAnswer.
3. NEVER use placeholders like [Your Name] or [Insert Company]. If the speaker introduces their name in the transcript, use it naturally. If not, write an engaging opening without bracketed placeholders.
4. Eliminate stammers and stutters (such as repeated "hi hi hi" or "um um") into a single, confident opening.
5. Elevate clarity and vocabulary while preserving the speaker's true intent, role, and domain facts (keep under 150 words).`;

/**
 * Transforms raw transcribed speech into a natural, eloquent spoken delivery.
 * Detects speaker's name, removes repetitive filler words, fixes grammar,
 * and eliminates any template placeholders.
 */
export function craftPolishedSpeech(rawText: string, promptTitle?: string): string {
  const text = rawText.trim();
  const titleLower = (promptTitle || '').toLowerCase();

  // 1. Detect if the user introduced their name ("this is Shyam", "my name is Shyam", "I am Shyam")
  let speakerName: string | null = null;
  const nameMatch = text.match(/\b(?:this is|i am|i'm|my name is|name's)\s+([A-Za-z]+)\b/i);
  if (nameMatch && nameMatch[1]) {
    const rawName = nameMatch[1];
    if (!['a', 'an', 'the', 'working', 'here', 'just', 'ready', 'talking'].includes(rawName.toLowerCase())) {
      speakerName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    }
  }

  // 2. Clean up repetitive stuttering / greetings / fillers
  let cleaned = text
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1')
    .replace(/\b(um|uh|er|ah|basically|literally|you know|kind of|sort of)\b/gi, '')
    .replace(/^(hi|hello|hey)(\s+(hi|hello|hey))*/i, '')
    .trim();

  // If a name was introduced, strip the intro clause from the body to avoid repeating
  if (speakerName) {
    cleaned = cleaned
      .replace(new RegExp(`\\b(?:this is|i am|i'm|my name is|name's)\\s+${speakerName}\\b`, 'i'), '')
      .trim();
  }

  // Fix common conversational fragments
  cleaned = cleaned
    .replace(/^been\s+working/i, 'I have been working')
    .replace(/in\s+the\s+software\s+domain/i, 'in software engineering')
    .replace(/on\s+the\s+software\s+domain/i, 'in software engineering')
    .replace(/for\s+the\s+past\s+(\d+)\s+years/i, 'for the past $1 years')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // 3. Assemble personalized first-person speech based on prompt topic
  if (titleLower.includes('intro') || titleLower.includes('yourself')) {
    const greeting = speakerName
      ? `Hello everyone! My name is ${speakerName}.`
      : `Hello everyone!`;

    const body =
      cleaned.length > 5
        ? `${cleaned}.`
        : `I am a software professional dedicated to building impactful digital solutions and continuous learning.`;

    return `${greeting} ${body} Throughout my journey, I've focused on solving complex challenges and collaborating closely with teams. I'm excited to be here and connect with all of you today.`;
  }

  if (titleLower.includes('project')) {
    const intro = speakerName ? `Hi everyone, I'm ${speakerName}.` : `Hi everyone.`;
    const body = cleaned.length > 5 ? cleaned : `Today I want to present a project I've developed recently`;
    return `${intro} ${body}. Our core objective was to solve a meaningful user problem with clean architecture, iterative testing, and great user experience. I'm proud of the results we achieved.`;
  }

  if (titleLower.includes('pitch')) {
    const intro = speakerName ? `Hello! I'm ${speakerName}.` : `Hello!`;
    const body = cleaned.length > 5 ? cleaned : `Consider an everyday challenge that costs teams valuable time`;
    return `${intro} ${body}. Our platform streamlines this entire workflow, unlocking immediate productivity through intuitive, automated tools. We're excited to bring this vision to life.`;
  }

  // General speech
  const intro = speakerName ? `Hello everyone, my name is ${speakerName}.` : `Hello everyone.`;
  const body = cleaned.length > 5 ? `${cleaned}.` : `I'm pleased to share these insights with you.`;
  return `${intro} ${body} By focusing on clear structure and purposeful pacing, we ensure our ideas resonate with every listener. Thank you.`;
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
Under 'improvedAnswer', write an eloquent, natural first-person speech (under 150 words) that fixes grammar, eliminates repeated words and fillers, and sounds like a polished speaker delivering the answer. Never include bracketed placeholders like [Your Name].`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      logger.info(`Requesting structured LLM feedback (attempt ${attempt}/2)`, {
        model: config.OPENAI_LLM_MODEL,
      });

      const isGroq =
        config.OPENAI_BASE_URL.includes('groq.com') || config.AI_PROVIDER === 'groq';

      const promptUserContent = isGroq
        ? `${userContent}\n\nIMPORTANT: Output ONLY valid JSON matching the schema with keys overallScore, summary, categories, improvedAnswer, nextExercise.`
        : userContent;

      const response = await client.chat.completions.create({
        model: config.OPENAI_LLM_MODEL || (isGroq ? 'openai/gpt-oss-120b' : 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptUserContent },
        ],
        response_format: isGroq
          ? { type: 'json_object' }
          : {
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
        // Strip any accidental bracket placeholders the LLM might have introduced
        const sanitizedAnswer = validated.data.improvedAnswer
          .replace(/\[(?:Your\s*Name|Name)\]/gi, '')
          .replace(/\[[^\]]+\]/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        return {
          ...validated.data,
          improvedAnswer: sanitizedAnswer || validated.data.improvedAnswer,
        };
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
