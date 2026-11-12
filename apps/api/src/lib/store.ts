import { getSupabaseAdmin } from './supabase.js';
import { logger } from './logger.js';
import type {
  SessionRecord,
  TranscriptRecord,
  MetricsRecord,
  FeedbackRecord,
  Prompt,
  SessionDetailResponse,
  MetricsResult,
} from '@speaksharp/shared';

// In-memory fallback database for local zero-cost/demo runs without cloud credentials
interface InMemoryDB {
  sessions: Map<string, SessionRecord>;
  transcripts: Map<string, TranscriptRecord>;
  metrics: Map<string, MetricsRecord>;
  feedback: Map<string, FeedbackRecord>;
  audioFiles: Map<string, { buffer: Buffer; mimeType: string }>;
}

const memoryDB: InMemoryDB = {
  sessions: new Map(),
  transcripts: new Map(),
  metrics: new Map(),
  feedback: new Map(),
  audioFiles: new Map(),
};

// Seed prompts in memory for fallback
const SEED_PROMPTS: Prompt[] = [
  {
    id: 'p1-intro',
    title: 'Introduce yourself in 60 seconds',
    description: 'Summarize who you are, your background, what drives you, and what you are currently working on.',
    category: 'Introduction',
    suggested_seconds: 60,
  },
  {
    id: 'p2-project',
    title: 'Explain a project you are proud of',
    description: 'Walk through a technical or creative project: core problem, architectural choices, and measurable impact.',
    category: 'Technical',
    suggested_seconds: 90,
  },
  {
    id: 'p3-pitch',
    title: 'Pitch a startup idea',
    description: 'Pitch a solution to an unsolved customer problem. State the value proposition, market, and why now.',
    category: 'Pitch',
    suggested_seconds: 90,
  },
  {
    id: 'p4-challenge',
    title: 'Describe your biggest professional challenge',
    description: 'Share a difficult situation at work or school, how you navigated conflicting priorities, and what you learned.',
    category: 'Behavioral',
    suggested_seconds: 90,
  },
  {
    id: 'p5-teach',
    title: 'Teach a complex concept to a 5-year-old',
    description: 'Pick an intricate concept (like cloud computing or gravity) and explain it using simple analogies.',
    category: 'Explanation',
    suggested_seconds: 60,
  },
];

export const store = {
  async getPrompts(): Promise<Prompt[]> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('prompts').select('*');
      if (!error && data && data.length > 0) {
        return data as Prompt[];
      }
    }
    return SEED_PROMPTS;
  },

  async getPromptById(id: string): Promise<Prompt | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('prompts').select('*').eq('id', id).single();
      if (!error && data) {
        return data as Prompt;
      }
    }
    return SEED_PROMPTS.find((p) => p.id === id) ?? null;
  },

  async createSession(session: SessionRecord): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from('sessions').insert({
        id: session.id,
        user_id: session.user_id,
        prompt_id: session.prompt_id,
        audio_path: session.audio_path,
        duration_sec: session.duration_sec,
        recording_duration_sec: session.recording_duration_sec,
        coverage_warning: session.coverage_warning,
        status: session.status,
        error: session.error,
        created_at: session.created_at,
      });
      if (error) {
        logger.error('Failed to create session in Supabase, using fallback', { error: error.message });
      }
    }
    memoryDB.sessions.set(session.id, session);
  },

  async updateSession(id: string, updates: Partial<SessionRecord>): Promise<void> {
    const existing = memoryDB.sessions.get(id);
    if (existing) {
      memoryDB.sessions.set(id, { ...existing, ...updates });
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from('sessions').update(updates).eq('id', id);
      if (error) {
        logger.error('Failed to update session in Supabase', { id, error: error.message });
      }
    }
  },

  async getSessionById(id: string): Promise<SessionRecord | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
      if (!error && data) {
        return data as SessionRecord;
      }
    }
    return memoryDB.sessions.get(id) ?? null;
  },

  async getUserSessions(userId: string): Promise<SessionRecord[]> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as SessionRecord[];
      }
    }
    return Array.from(memoryDB.sessions.values())
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async saveTranscript(transcript: TranscriptRecord): Promise<void> {
    memoryDB.transcripts.set(transcript.session_id, transcript);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('transcripts').upsert({
        session_id: transcript.session_id,
        text: transcript.text,
        words: transcript.words,
      });
    }
  },

  async getTranscript(sessionId: string): Promise<TranscriptRecord | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('transcripts').select('*').eq('session_id', sessionId).single();
      if (!error && data) {
        return data as TranscriptRecord;
      }
    }
    return memoryDB.transcripts.get(sessionId) ?? null;
  },

  async saveMetrics(metrics: MetricsRecord): Promise<void> {
    memoryDB.metrics.set(metrics.session_id, metrics);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('metrics').upsert({
        session_id: metrics.session_id,
        wpm: metrics.wpm,
        filler_count: metrics.filler_count,
        filler_rate: metrics.filler_rate,
        pause_count: metrics.pause_count,
        longest_pause: metrics.longest_pause,
        lexical_diversity: metrics.lexical_diversity,
      });
    }
  },

  async getMetrics(sessionId: string): Promise<MetricsRecord | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('metrics').select('*').eq('session_id', sessionId).single();
      if (!error && data) {
        return data as MetricsRecord;
      }
    }
    return memoryDB.metrics.get(sessionId) ?? null;
  },

  async saveFeedback(feedback: FeedbackRecord): Promise<void> {
    memoryDB.feedback.set(feedback.session_id, feedback);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('feedback').upsert({
        session_id: feedback.session_id,
        overall_score: feedback.overall_score,
        payload: feedback.payload,
        tts_audio_path: feedback.tts_audio_path,
      });
    }
  },

  async getFeedback(sessionId: string): Promise<FeedbackRecord | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('feedback').select('*').eq('session_id', sessionId).single();
      if (!error && data) {
        return data as FeedbackRecord;
      }
    }
    return memoryDB.feedback.get(sessionId) ?? null;
  },

  async uploadAudio(
    storagePath: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.storage
        .from('speaksharp-audio')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });
      if (error) {
        logger.warn('Supabase storage upload failed, falling back to memory', { error: error.message });
      } else {
        return storagePath;
      }
    }

    memoryDB.audioFiles.set(storagePath, { buffer, mimeType });
    return storagePath;
  },

  async getAudioSignedUrl(storagePath: string): Promise<string> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.storage
        .from('speaksharp-audio')
        .createSignedUrl(storagePath, 3600); // 60 minutes
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }

    // Return an API-proxied URL for in-memory / local audio
    return `/api/audio/${encodeURIComponent(storagePath)}`;
  },

  getMemoryAudio(storagePath: string) {
    return memoryDB.audioFiles.get(storagePath);
  },

  async getSessionDetail(
    sessionId: string,
    computedMetrics?: MetricsResult | null,
  ): Promise<SessionDetailResponse | null> {
    const session = await store.getSessionById(sessionId);
    if (!session) return null;

    const [prompt, transcript, rawMetrics, feedback] = await Promise.all([
      session.prompt_id ? store.getPromptById(session.prompt_id) : Promise.resolve(null),
      store.getTranscript(sessionId),
      store.getMetrics(sessionId),
      store.getFeedback(sessionId),
    ]);

    let audioUrl: string | null = null;
    if (session.audio_path) {
      audioUrl = await store.getAudioSignedUrl(session.audio_path);
    }

    let ttsAudioUrl: string | null = null;
    if (feedback?.tts_audio_path) {
      ttsAudioUrl = await store.getAudioSignedUrl(feedback.tts_audio_path);
    }

    // Prefer computed metrics with full fillers/pauses array if available
    let metricsResult: MetricsResult | null = computedMetrics ?? null;
    if (!metricsResult && rawMetrics) {
      metricsResult = {
        wpm: rawMetrics.wpm,
        fillerCount: rawMetrics.filler_count,
        fillerRatePerMin: rawMetrics.filler_rate,
        pauseCount: rawMetrics.pause_count,
        longestPause: rawMetrics.longest_pause,
        lexicalDiversity: rawMetrics.lexical_diversity,
        paceLabel: rawMetrics.wpm < 110 ? 'too slow' : rawMetrics.wpm > 160 ? 'too fast' : 'good',
        totalSpeakingTimeSeconds: session.duration_sec ?? 0,
        fillers: [],
        pauses: [],
      };
    }

    return {
      session,
      prompt,
      transcript,
      metrics: metricsResult,
      feedback,
      audioUrl,
      ttsAudioUrl,
    };
  },
};
