import React from 'react';
import { CheckCircle2, Loader2, Sparkles, AudioWaveform, BrainCircuit } from 'lucide-react';

interface ProcessingProgressProps {
  currentStep?: 'uploading' | 'transcribing' | 'analyzing' | 'done';
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  currentStep = 'transcribing',
}) => {
  const steps = [
    { id: 'uploading', label: 'Uploading audio', icon: AudioWaveform },
    { id: 'transcribing', label: 'Whisper speech-to-text', icon: BrainCircuit },
    { id: 'analyzing', label: 'AI coaching analysis', icon: Sparkles },
    { id: 'done', label: 'Ready!', icon: CheckCircle2 },
  ];

  const getStepIndex = (step: string) => {
    switch (step) {
      case 'uploading':
        return 0;
      case 'transcribing':
        return 1;
      case 'analyzing':
        return 2;
      case 'done':
        return 3;
      default:
        return 1;
    }
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md mx-auto shadow-sm text-center">
      <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-1">
        Analyzing your speech
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        Computing word pacing, detecting fillers, and assembling AI coaching insights.
      </p>

      <div className="space-y-3 text-left">
        {steps.map((step, idx) => {
          const isFinished = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                isCurrent
                  ? 'bg-sky-50 border border-sky-200 text-sky-900 font-semibold'
                  : isFinished
                    ? 'text-emerald-700 bg-emerald-50/50'
                    : 'text-slate-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isFinished
                    ? 'bg-emerald-100 text-emerald-600'
                    : isCurrent
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFinished ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span className="text-sm">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
