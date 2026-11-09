import React from 'react';
import type { FeedbackCategory } from '@speaksharp/shared';
import { Quote, Lightbulb } from 'lucide-react';

interface FeedbackCategoryCardProps {
  category: FeedbackCategory;
}

export const FeedbackCategoryCard: React.FC<FeedbackCategoryCardProps> = ({
  category,
}) => {
  const scoreColors =
    category.score >= 8
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : category.score >= 6
        ? 'text-sky-700 bg-sky-50 border-sky-200'
        : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      {/* Header: Name + Score */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-slate-900 capitalize text-base">
            {category.name}
          </h4>
          <span
            className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full border ${scoreColors}`}
          >
            {category.score} / 10
          </span>
        </div>

        {/* Evidence Quote from Transcript */}
        <div className="mb-4 bg-slate-50 border-l-4 border-slate-300 p-3 rounded-r-lg">
          <div className="flex items-start gap-1.5 text-xs text-slate-500 font-semibold mb-1">
            <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>Transcript Evidence</span>
          </div>
          <p className="text-xs text-slate-700 italic leading-relaxed">
            "{category.evidence}"
          </p>
        </div>
      </div>

      {/* Concrete Tip */}
      <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-700">
        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="leading-snug font-medium">
          <span className="font-bold text-slate-900">Coaching Tip: </span>
          {category.tip}
        </p>
      </div>
    </div>
  );
};
