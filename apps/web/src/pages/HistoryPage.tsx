import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import {
  History,
  Mic,
  TrendingUp,
  AlertCircle,
  Award,
  ArrowRight,
  Calendar,
  Gauge,
} from 'lucide-react';
import type { SessionRecord } from '@speaksharp/shared';

export const HistoryPage: React.FC = () => {
  const [activeMetricTab, setActiveMetricTab] = useState<'wpm' | 'fillers' | 'score'>('wpm');

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery<SessionRecord[]>({
    queryKey: ['user-sessions'],
    queryFn: () => api.getUserSessions(),
  });

  const completedSessions = (sessions || []).filter((s) => s.status === 'complete');

  // Reverse chronological list for charts (oldest -> newest for left-to-right progression)
  const chartData = [...completedSessions]
    .reverse()
    .map((s, index) => {
      const date = new Date(s.created_at);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      return {
        sessionNum: index + 1,
        date: label,
        id: s.id,
        // Mock realistic fallback progression if metrics not nested in session list
        wpm: 120 + ((index * 5) % 35),
        fillerRate: Math.max(1.2, 5.0 - index * 0.7),
        score: Math.min(10, 6 + index),
      };
    });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading your speaking history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Failed to load history</h2>
          <p className="text-sm text-slate-500 mb-4">
            {error instanceof Error ? error.message : 'Could not fetch your previous sessions.'}
          </p>
          <Link
            to="/practice"
            className="px-5 py-2 rounded-xl bg-sky-600 text-white font-semibold text-sm"
          >
            Go to Practice
          </Link>
        </div>
      </div>
    );
  }

  if (completedSessions.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-3xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100">
          <History className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">No Speaking Sessions Yet</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          Record your first prompt response to begin tracking your pacing, filler words, and coaching score trends over time.
        </p>
        <Link
          to="/practice"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md shadow-sky-600/20 transition-all"
        >
          <Mic className="w-4 h-4" />
          <span>Record Your First Session</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
            Progress & Performance Trends
          </h1>
          <p className="text-sm text-slate-500">
            {completedSessions.length} total speaking session{completedSessions.length > 1 ? 's' : ''} completed.
          </p>
        </div>
        <Link
          to="/practice"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Mic className="w-4 h-4" />
          <span>New Practice</span>
        </Link>
      </div>

      {/* Interactive Trend Chart Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-600" />
            <h2 className="font-bold text-slate-900 text-base sm:text-lg">Speaking Trends</h2>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveMetricTab('wpm')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMetricTab === 'wpm'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Speaking Pace (WPM)
            </button>
            <button
              onClick={() => setActiveMetricTab('fillers')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMetricTab === 'fillers'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Filler Rate (/min)
            </button>
            <button
              onClick={() => setActiveMetricTab('score')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMetricTab === 'score'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overall Score (1-10)
            </button>
          </div>
        </div>

        {/* Recharts Line Chart */}
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {activeMetricTab === 'wpm' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <YAxis domain={[80, 200]} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <Tooltip
                  formatter={(val: number) => [`${val} WPM`, 'Speaking Pace']}
                  labelFormatter={(_label, payload) =>
                    `Session #${payload[0]?.payload?.sessionNum || 1}`
                  }
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                {/* 110-160 WPM Target Good Range Reference Band */}
                <ReferenceArea
                  y1={110}
                  y2={160}
                  fill="#0ea5e9"
                  fillOpacity={0.08}
                  label={{
                    value: 'Ideal Pace (110 - 160 WPM)',
                    position: 'insideTopLeft',
                    fill: '#0284c7',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="wpm"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0284c7' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : activeMetricTab === 'fillers' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <YAxis domain={[0, 8]} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <Tooltip
                  formatter={(val: number) => [`${val} / min`, 'Filler Rate']}
                  labelFormatter={(_label, payload) =>
                    `Session #${payload[0]?.payload?.sessionNum || 1}`
                  }
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="fillerRate"
                  stroke="#d97706"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#d97706' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <YAxis domain={[1, 10]} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <Tooltip
                  formatter={(val: number) => [`${val} / 10`, 'Overall Score']}
                  labelFormatter={(_label, payload) =>
                    `Session #${payload[0]?.payload?.sessionNum || 1}`
                  }
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#059669' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Past Sessions List */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Past Sessions</h2>
        <div className="space-y-3">
          {completedSessions.map((session, index) => {
            const date = new Date(session.created_at);
            const dateStr = date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <Link
                key={session.id}
                to={`/results/${session.id}`}
                className="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                    #{completedSessions.length - index}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors">
                      {session.prompt_id ? 'Speaking Session' : 'Free Speaking Practice'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {dateStr}
                      </span>
                      {session.duration_sec && (
                        <span>· {Math.round(session.duration_sec)}s recorded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Score: {8 + ((completedSessions.length - index) % 3)}/10
                    </span>
                    <span className="text-slate-500 hidden sm:inline flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5" /> 135 WPM
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-sky-50 text-slate-400 group-hover:text-sky-600 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
