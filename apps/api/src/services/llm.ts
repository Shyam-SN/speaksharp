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

  // If user only spoke a few words (e.g., "Hi hi hi hi" or under 15 words)
  if (wordCount < 15) {
    const quote = transcriptText.trim() || 'brief utterance';
    const titleLower = (promptTitle || '').toLowerCase();

    let polishedExample = `Hello everyone! My name is [Your Name], and I'm excited to speak with you today. In my work, I focus on crafting reliable, scalable software solutions. Over the past year, I've specialized in full-stack development with React, TypeScript, and voice AI technologies. I look forward to connecting and sharing ideas with the team.`;

    if (titleLower.includes('pitch')) {
      polishedExample = `Hi everyone! Have you ever struggled with speaking anxiety or filler words during presentations? That's why we created SpeakSharp: an AI speaking coach that provides instant pacing metrics and actionable feedback directly in your browser.`;
    } else if (titleLower.includes('project')) {
      polishedExample = `Hi team! Today I'm proud to present a project I've been developing: SpeakSharp. The key challenge was aligning speech timestamps with deterministic metrics algorithms, which we solved using pure TypeScript architecture.`;
    } else if (titleLower.includes('challenge')) {
      polishedExample = `Hello. One of the greatest challenges I faced was managing conflicting technical priorities under tight deadlines. By introducing clear roadmap checkpoints and transparent communication, our team delivered on schedule.`;
    }

    return {
      overallScore: 5,
      summary: `You spoke only ${wordCount} word${wordCount === 1 ? '' : 's'} ("${quote}"). While your greeting is clear, expanding with a complete narrative will allow us to analyze your pacing, structure, and vocabulary diversity effectively.`,
      categories: [
        {
          name: 'clarity',
          score: 6,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Pronounce every word fully, but expand your thought into full sentences with supporting ideas.',
        },
        {
          name: 'structure',
          score: 4,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Follow the classic opening structure: Greeting → Who you are → Core message or takeaway.',
        },
        {
          name: 'confidence',
          score: 6,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Project your voice outward and aim for at least 30-45 seconds of continuous speaking.',
        },
        {
          name: 'conciseness',
          score: 5,
          evidence: `"${quoteSnippet(0, 4)}"`,
          tip: 'Brevity is good, but complete the prompt requirement before stopping the recording.',
        },
      ],
      improvedAnswer: polishedExample,
      nextExercise: promptTitle
        ? `Try recording "${promptTitle}" again. Aim for at least 3 to 4 complete sentences (30-60 seconds).`
        : 'Record an introduction of at least 45 seconds describing your background and goals.',
    };
  }

  // Full response handling
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
    improvedAnswer: `Hello everyone. In this response, I wanted to convey: ${transcriptText.slice(0, 180).trim()}... By structuring these thoughts with clear signposting and eliminating hesitations, your presentation becomes significantly more persuasive.`,
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
