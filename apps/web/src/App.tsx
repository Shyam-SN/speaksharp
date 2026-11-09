import React from 'react';

export function App(): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          SS
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">SpeakSharp</h1>
        <p className="text-slate-600 text-sm mb-6">
          Mini AI Speaking Coach — practice speaking, get instant metrics, and improve with
          personalized AI coaching.
        </p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          Scaffold Ready (Milestone 1)
        </span>
      </div>
    </div>
  );
}

export default App;

