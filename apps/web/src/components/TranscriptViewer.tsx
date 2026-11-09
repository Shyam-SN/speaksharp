import React, { useState } from 'react';
import type { TranscriptWord, DetectedFiller, DetectedPause } from '@speaksharp/shared';
import { Eye, EyeOff } from 'lucide-react';

interface TranscriptViewerProps {
  words: TranscriptWord[];
  fillers: DetectedFiller[];
  pauses: DetectedPause[];
  fullText?: string;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  words,
  fillers,
  pauses,
  fullText,
}) => {
  const [showFillers, setShowFillers] = useState(true);
  const [showPauses, setShowPauses] = useState(true);

  if (!words || words.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-slate-500 italic text-center">
        {fullText || 'No transcript available.'}
      </div>
    );
  }

  // Pre-index fillers by start timestamp (within 0.05s tolerance)
  const isWordFiller = (w: TranscriptWord): DetectedFiller | undefined => {
    return fillers.find(
      (f) => Math.abs(f.start - w.start) < 0.1 || (w.start >= f.start && w.end <= f.end),
    );
  };

  // Check if there is a pause right after this word
  const getTrailingPause = (w: TranscriptWord): DetectedPause | undefined => {
    return pauses.find((p) => Math.abs(p.start - w.end) < 0.15);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-lg">Full Transcript & Analysis</h3>
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setShowFillers(!showFillers)}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
              showFillers
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {showFillers ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {fillers.length} Fillers
          </button>
          <button
            onClick={() => setShowPauses(!showPauses)}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
              showPauses
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {showPauses ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {pauses.length} Pauses (&gt;1s)
          </button>
        </div>
      </div>

      <div className="leading-relaxed text-slate-800 text-base space-x-1">
        {words.map((w, idx) => {
          const filler = showFillers ? isWordFiller(w) : undefined;
          const pause = showPauses ? getTrailingPause(w) : undefined;

          return (
            <React.Fragment key={idx}>
              {filler ? (
                <span
                  className="inline-block bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.5 rounded font-medium cursor-help"
                  title={`Filler word (${w.start.toFixed(1)}s)`}
                >
                  {w.word}
                </span>
              ) : (
                <span>{w.word}</span>
              )}

              {pause && (
                <span
                  className="inline-flex items-center gap-0.5 mx-1 px-1.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md"
                  title={`Pause duration: ${pause.duration}s`}
                >
                  ⏸ {pause.duration}s
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
