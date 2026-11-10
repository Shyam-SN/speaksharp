import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { FeedbackCategory } from '@speaksharp/shared';
import { api } from '../lib/api.js';
import { MetricCards } from '../components/MetricCards.js';
import { TranscriptViewer } from '../components/TranscriptViewer.js';
import { FeedbackCategoryCard } from '../components/FeedbackCategoryCard.js';
import { ProcessingProgress } from '../components/ProcessingProgress.js';
import {
  Sparkles,
  ArrowLeft,
  Volume2,
  Copy,
  Check,
  RotateCcw,
  Target,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';

export const ResultsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [copied, setCopied] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const ttsAudioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const {
    data: detail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('Missing session ID');
      return api.getSession(sessionId);
    },
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.session?.status;
      return status === 'processing' ? 1500 : false;
    },
  });

  if (isLoading || detail?.session?.status === 'processing') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20">
        <ProcessingProgress currentStep="analyzing" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Session Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            {error instanceof Error ? error.message : 'Could not retrieve speaking session.'}
          </p>
          <Link
            to="/practice"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Practice
          </Link>
        </div>
      </div>
    );
  }

  const { session, prompt, transcript, metrics, feedback, audioUrl } = detail;
  const payload = feedback?.payload;

  const handleCopyImproved = () => {
    if (payload?.improvedAnswer) {
      navigator.clipboard.writeText(payload.improvedAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const playSpeechSynthesis = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setTtsLoading(false);
      setIsPlayingTTS(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Samantha') ||
            v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Karen') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex')),
      ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setIsPlayingTTS(true);
      setTtsLoading(false);
    };

    utterance.onend = () => {
      setIsPlayingTTS(false);
      setTtsLoading(false);
    };

    utterance.onerror = () => {
      setIsPlayingTTS(false);
      setTtsLoading(false);
    };

    setIsPlayingTTS(true);
    setTtsLoading(false);
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayTTS = async () => {
    if (!payload?.improvedAnswer || !sessionId) return;

    if (isPlayingTTS) {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingTTS(false);
      return;
    }

    try {
      setTtsLoading(true);
      const res = await api.generateTTS(sessionId);

      if (res.ttsAudioUrl && !res.useBrowserSpeech) {
        const audio = new Audio(res.ttsAudioUrl);
        ttsAudioRef.current = audio;
        audio.onended = () => setIsPlayingTTS(false);
        audio.onerror = () => playSpeechSynthesis(payload.improvedAnswer);
        await audio.play();
        setIsPlayingTTS(true);
        setTtsLoading(false);
        return;
      }
    } catch {
      // Continue to browser synthesis
    }

    playSpeechSynthesis(payload.improvedAnswer);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/practice"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>New Practice Session</span>
        </Link>
        <span className="text-xs text-slate-400">
          Session ID: {session.id.slice(0, 8)}...
        </span>
      </div>

      {/* Hero Score Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-sky-300 border border-white/10 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{prompt?.title || 'Speaking Evaluation'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Performance Analysis
            </h1>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              {payload?.summary ||
                'Here is your quantitative speaking metrics and qualitative AI coaching summary.'}
            </p>
          </div>

          {/* Overall Score Circle */}
          <div className="shrink-0 flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 min-w-[130px]">
            <span className="text-4xl sm:text-5xl font-black text-white">
              {feedback?.overall_score ?? 8}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-200 mt-1">
              Overall / 10
            </span>
          </div>
        </div>
      </div>

      {/* Original Audio Player */}
      {audioUrl && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Original Audio</div>
              <div className="text-sm font-bold text-slate-800">
                Your Recorded Answer ({metrics?.totalSpeakingTimeSeconds ?? 0}s)
              </div>
            </div>
          </div>
          <audio controls src={audioUrl} className="w-full sm:w-80 h-10" />
        </div>
      )}

      {/* Hard Quantitative Metrics */}
      {metrics && (
        <div className="mb-8">
          <h2 className="text-base font-bold text-slate-900 mb-3">Hard Metrics Computed</h2>
          <MetricCards metrics={metrics} />
        </div>
      )}

      {/* 4-Category Qualitative AI Coaching Breakdown */}
      {payload?.categories && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Coaching Breakdown (4 Dimensions)
            </h2>
            <span className="text-xs text-slate-500 font-medium">Scored 1-10 with Quotes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {payload.categories.map((cat: FeedbackCategory) => (
              <FeedbackCategoryCard key={cat.name} category={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Improved Version Display with TTS & Copy */}
      {payload?.improvedAnswer && (
        <div className="bg-gradient-to-br from-sky-50 to-indigo-50/60 border border-sky-200/80 rounded-2xl p-6 sm:p-7 shadow-sm mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-sky-200/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Polished Version</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayTTS}
                disabled={ttsLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Listen to improved version"
              >
                {ttsLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : isPlayingTTS ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-sky-700" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-sky-700 fill-current" />
                    <span>Listen</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCopyImproved}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <p className="text-slate-800 text-sm sm:text-base leading-relaxed font-medium">
            "{payload.improvedAnswer}"
          </p>
        </div>
      )}

      {/* Transcript with Highlighted Fillers and Pauses */}
      {transcript && (
        <div className="mb-8">
          <TranscriptViewer
            words={transcript.words}
            fillers={metrics?.fillers || []}
            pauses={metrics?.pauses || []}
            fullText={transcript.text}
          />
        </div>
      )}

      {/* Next Recommended Exercise */}
      {payload?.nextExercise && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">Recommended Next Challenge</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {payload.nextExercise}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-200">
        <Link
          to="/practice"
          className="px-6 py-3 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Practice Another Prompt</span>
        </Link>
        <Link
          to="/history"
          className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors"
        >
          View Progress History
        </Link>
      </div>
    </div>
  );
};

