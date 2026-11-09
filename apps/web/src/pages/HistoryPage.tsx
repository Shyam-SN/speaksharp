import React from 'react';
import { Link } from 'react-router-dom';
import { History, Mic } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4">
        <History className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Speaking History & Trends</h1>
      <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
        Track your progress over time with charts for Words Per Minute, filler rates, and category scores.
      </p>
      <Link
        to="/practice"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 transition-colors shadow-sm"
      >
        <Mic className="w-4 h-4" />
        Record a Session
      </Link>
    </div>
  );
};
