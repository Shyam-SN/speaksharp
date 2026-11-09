import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Zap, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signInAsDemo } = useAuth();

  const handleStart = () => {
    if (!user) {
      signInAsDemo();
    }
    navigate('/practice');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Mini AI Speaking Coach · React + TypeScript + Supabase</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-6">
          Master your speaking.
          <br />
          <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Coached by Voice AI.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          Pick a prompt, record yourself in the browser, and receive word-level filler tracking,
          pacing metrics, and personalized coaching in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold text-base hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 group"
          >
            <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Try SpeakSharp Demo</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          No credit card required · Instant 30-second reviewer access
        </p>
      </section>

      {/* How It Works - 3 Step Grid */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              How SpeakSharp Works
            </h2>
            <p className="text-sm text-slate-500">
              Deterministic pure TypeScript metrics paired with OpenAI Structured Outputs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Pick a Prompt</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Choose from introduction, interview, pitch, or explanation prompts with suggested time limits.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Record in Browser</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Cross-browser MediaRecorder captures audio up to 120s with live mic levels and timers.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Get Instant Coaching</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                See WPM, highlighted fillers, inline pause markers, 4-category scorecards, and an improved rewrite.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Banner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <Gauge className="w-5 h-5 text-sky-600 mb-2" />
            <div className="font-bold text-sm text-slate-900">Word-level WPM</div>
            <div className="text-xs text-slate-500">Excludes leading/trailing silence</div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <Zap className="w-5 h-5 text-amber-600 mb-2" />
            <div className="font-bold text-sm text-slate-900">Filler Detection</div>
            <div className="text-xs text-slate-500">Single & multi-word phrase analysis</div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <Sparkles className="w-5 h-5 text-indigo-600 mb-2" />
            <div className="font-bold text-sm text-slate-900">Evidence Quotes</div>
            <div className="text-xs text-slate-500">Cites exact moments from transcript</div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
            <div className="font-bold text-sm text-slate-900">Polished Rewrite</div>
            <div className="text-xs text-slate-500">Listen with text-to-speech</div>
          </div>
        </div>
      </section>
    </div>
  );
};

