import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useRecorder } from '../hooks/useRecorder.js';
import { MicVisualizer } from '../components/MicVisualizer.js';
import { ProcessingProgress } from '../components/ProcessingProgress.js';
import type { Prompt } from '@speaksharp/shared';
import {
  Square,
  RotateCcw,
  Send,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

const DEFAULT_PROMPTS: Prompt[] = [
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

export const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(DEFAULT_PROMPTS[0] ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: quota } = useQuery({
    queryKey: ['quota'],
    queryFn: () => api.getQuota(),
    refetchInterval: 10000,
  });

  const {
    isRecording,
    recordingDuration,
    recordingDurationMs,
    volumeLevel,
    audioBlob,
    audioUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useRecorder();

  // Load prompts from API, fall back to DEFAULT_PROMPTS
  const { data: apiPrompts, isLoading: promptsLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => api.getPrompts(),
  });

  const prompts = apiPrompts && apiPrompts.length > 0 ? apiPrompts : DEFAULT_PROMPTS;

  // Select first prompt if not yet selected
  useEffect(() => {
    if (!selectedPrompt && prompts.length > 0) {
      setSelectedPrompt(prompts[0] ?? null);
    }
  }, [prompts, selectedPrompt]);

  // Poll for completion if activeSessionId is set
  useEffect(() => {
    if (!activeSessionId) return;

    const interval = setInterval(async () => {
      try {
        const detail = await api.getSession(activeSessionId);
        if (detail.session.status === 'complete') {
          clearInterval(interval);
          navigate(`/results/${activeSessionId}`);
        } else if (detail.session.status === 'failed') {
          clearInterval(interval);
          setSubmitError(detail.session.error || 'Analysis failed. Please try again.');
          setIsSubmitting(false);
        }
      } catch {
        // Continue polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSessionId, navigate]);

  const categories = ['All', 'Introduction', 'Technical', 'Pitch', 'Behavioral', 'Explanation'];

  const filteredPrompts = (prompts || []).filter((p) =>
    selectedCategory === 'All' ? true : p.category === selectedCategory,
  );

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const clientDuration =
        recordingDurationMs > 0 ? recordingDurationMs : recordingDuration * 1000;
      const res = await api.createSession(
        audioBlob,
        selectedPrompt?.id ?? null,
        clientDuration,
      );
      setActiveSessionId(res.sessionId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed');
      setIsSubmitting(false);
    }
  };

  // If submitting / waiting for analysis, display animated progress
  if (isSubmitting) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <ProcessingProgress currentStep={activeSessionId ? 'transcribing' : 'uploading'} />
        {submitError && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="text-center max-w-xl mx-auto mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Speaking Practice Booth
        </h1>
        <p className="text-sm text-slate-600 mb-3">
          Pick a prompt, record your response, and submit to receive instant AI coaching.
        </p>

        {quota && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span>
              Daily Sessions: <strong className="text-sky-700">{quota.remaining} of {quota.limit}</strong> remaining
            </span>
            {isDemo && <span className="text-slate-400">· Demo Mode</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Prompts List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-base">Select a Prompt</h2>
            <span className="text-xs text-slate-400 font-medium">
              {filteredPrompts.length} available
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 mb-4 pb-2 border-b border-slate-100">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Prompts Cards */}
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {promptsLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading prompts...</div>
            ) : (
              filteredPrompts.map((prompt) => {
                const isSelected = selectedPrompt?.id === prompt.id;
                return (
                  <button
                    key={prompt.id}
                    onClick={() => {
                      if (!isRecording) setSelectedPrompt(prompt);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {prompt.category}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" /> {prompt.suggested_seconds}s
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 text-sm mb-1">
                      {prompt.title}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {prompt.description}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Audio Recording Stage */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between min-h-[460px]">
          {/* Active Prompt Header */}
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Active Prompt
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {selectedPrompt?.title || 'Open Speech Practice'}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {selectedPrompt?.description ||
                'Speak freely on any topic. Speak naturally and clearly.'}
            </p>
          </div>

          {/* Recording Visuals: Timer + Mic Visualizer */}
          <div className="my-auto py-6 text-center">
            {/* Live Timer */}
            <div className="font-mono text-4xl sm:text-5xl font-black text-slate-900 mb-2">
              {formatTime(recordingDuration)}
              <span className="text-xs font-sans text-slate-400 font-normal ml-2">/ 2:00 max</span>
            </div>

            {/* Mic Meter */}
            <div className="max-w-xs mx-auto mb-4">
              <MicVisualizer volume={volumeLevel} isRecording={isRecording} />
            </div>

            {/* Status Text */}
            <div className="text-xs text-slate-500 font-medium">
              {isRecording
                ? 'Recording in progress... Click Stop when finished.'
                : audioBlob
                  ? 'Recording captured! Listen below or submit for AI analysis.'
                  : 'Ready. Press the microphone button below to start.'}
            </div>

            {recorderError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{recorderError}</span>
              </div>
            )}

            {submitError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          {/* Audio Playback Preview (if recorded) */}
          {audioUrl && !isRecording && (
            <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
              <audio controls src={audioUrl} className="w-full max-w-md h-10" />
            </div>
          )}

          {/* Controls: Start/Stop/Rerecord/Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-3">
            {!isRecording && !audioBlob ? (
              <button
                onClick={startRecording}
                className="px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-base transition-all shadow-md shadow-sky-600/20 flex items-center gap-2 group"
              >
                <div className="w-3 h-3 rounded-full bg-white group-hover:scale-125 transition-transform" />
                <span>Start Recording</span>
              </button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="px-8 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Recording</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                  onClick={resetRecording}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Re-record</span>
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit for Coaching</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
