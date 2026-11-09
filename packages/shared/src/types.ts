import type { PaceLabel } from './constants.js';

export interface TranscriptWord {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface DetectedFiller {
  word: string;
  start: number;
  end: number;
  isMultiWord: boolean;
}

export interface DetectedPause {
  start: number;
  end: number;
  duration: number; // in seconds
}

export interface MetricsResult {
  wpm: number;
  fillerCount: number;
  fillerRatePerMin: number;
  pauseCount: number;
  longestPause: number;
  lexicalDiversity: number;
  paceLabel: PaceLabel;
  totalSpeakingTimeSeconds: number;
  fillers: DetectedFiller[];
  pauses: DetectedPause[];
}

export interface FeedbackCategory {
  name: 'clarity' | 'structure' | 'confidence' | 'conciseness';
  score: number; // 1-10
  evidence: string; // direct quote from transcript
  tip: string; // one concrete, actionable tip
}

export interface FeedbackPayload {
  overallScore: number; // 1-10
  summary: string; // 2 sentences
  categories: FeedbackCategory[];
  improvedAnswer: string; // <= 150 words
  nextExercise: string;
}

export type SessionStatus = 'processing' | 'complete' | 'failed';

export interface Prompt {
  id: string;
  title: string;
  description: string;
  category: string;
  suggested_seconds: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  prompt_id: string | null;
  audio_path: string | null;
  duration_sec: number | null;
  status: SessionStatus;
  error: string | null;
  created_at: string;
}

export interface TranscriptRecord {
  session_id: string;
  text: string;
  words: TranscriptWord[];
}

export interface MetricsRecord {
  session_id: string;
  wpm: number;
  filler_count: number;
  filler_rate: number;
  pause_count: number;
  longest_pause: number;
  lexical_diversity: number;
}

export interface FeedbackRecord {
  session_id: string;
  overall_score: number;
  payload: FeedbackPayload;
  tts_audio_path: string | null;
}

export interface SessionDetailResponse {
  session: SessionRecord;
  prompt?: Prompt | null;
  transcript?: TranscriptRecord | null;
  metrics?: MetricsResult | null;
  feedback?: FeedbackRecord | null;
  audioUrl?: string | null;
  ttsAudioUrl?: string | null;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
}

