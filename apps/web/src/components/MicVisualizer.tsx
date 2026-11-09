import React from 'react';

interface MicVisualizerProps {
  volume: number; // 0 to 100
  isRecording: boolean;
}

export const MicVisualizer: React.FC<MicVisualizerProps> = ({ volume, isRecording }) => {
  // Generate 7 reactive audio wave bars
  const bars = [0.4, 0.7, 1.0, 1.2, 1.0, 0.7, 0.4];

  return (
    <div className="flex items-center justify-center gap-1.5 h-12 py-2">
      {bars.map((multiplier, idx) => {
        const heightPercent = isRecording
          ? Math.max(15, Math.min(100, Math.round(volume * multiplier)))
          : 15;

        return (
          <div
            key={idx}
            className={`w-1.5 rounded-full transition-all duration-75 ${
              isRecording
                ? volume > 70
                  ? 'bg-rose-500'
                  : volume > 30
                    ? 'bg-sky-500'
                    : 'bg-sky-400'
                : 'bg-slate-300'
            }`}
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
    </div>
  );
};
