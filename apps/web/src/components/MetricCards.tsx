import React from 'react';
import type { MetricsResult } from '@speaksharp/shared';
import { Gauge, AlertCircle, PauseCircle, BookOpen, Clock } from 'lucide-react';

interface MetricCardsProps {
  metrics: MetricsResult;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics }) => {
  const paceBadgeStyles = {
    'too slow': 'bg-amber-100 text-amber-800 border-amber-200',
    good: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'too fast': 'bg-rose-100 text-rose-800 border-rose-200',
  }[metrics.paceLabel];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 1. Words Per Minute */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Speaking Pace
          </span>
          <Gauge className="w-4 h-4 text-sky-600" />
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.wpm}{' '}
            <span className="text-xs font-normal text-slate-500">WPM</span>
          </div>
          <div className="mt-2">
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${paceBadgeStyles}`}
            >
              {metrics.paceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filler Count & Rate */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Filler Words
          </span>
          <AlertCircle className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.fillerCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {metrics.fillerRatePerMin} / minute
          </p>
        </div>
      </div>

      {/* 3. Pauses */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Long Pauses (&gt;1s)
          </span>
          <PauseCircle className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.pauseCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Longest: {metrics.longestPause}s
          </p>
        </div>
      </div>

      {/* 4. Vocabulary Diversity & Duration */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Vocabulary
          </span>
          <BookOpen className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {Math.round(metrics.lexicalDiversity * 100)}%
          </div>
          <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {metrics.totalSpeakingTimeSeconds}s total
          </p>
        </div>
      </div>
    </div>
  );
};
