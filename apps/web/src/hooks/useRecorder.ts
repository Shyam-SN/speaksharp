import { useState, useRef, useCallback, useEffect } from 'react';
import type { TranscriptWord } from '@speaksharp/shared';

export interface UseRecorderResult {
  isRecording: boolean;
  recordingDuration: number;
  volumeLevel: number; // 0 to 100
  audioBlob: Blob | null;
  audioUrl: string | null;
  selectedMimeType: string;
  transcriptWords: TranscriptWord[];
  liveTranscript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

const MAX_DURATION_SECONDS = 120; // 2 minutes max

// Audio MIME type cross-browser detection
export function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];

  for (const type of preferredTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return ''; // Browser default
}

// Browser SpeechRecognition definition
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

export function useRecorder(): UseRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('');
  const [transcriptWords, setTranscriptWords] = useState<TranscriptWord[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const wordsAccumulatorRef = useRef<TranscriptWord[]>([]);

  const cleanupAudioNodes = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      recognitionRef.current = null;
    }
    setVolumeLevel(0);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    cleanupAudioNodes();
  }, [cleanupAudioNodes]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
    audioChunksRef.current = [];
    wordsAccumulatorRef.current = [];
    setTranscriptWords([]);
    setLiveTranscript('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Audio analysis for volume meter
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setVolumeLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Configure MediaRecorder
      const mimeType = getSupportedMimeType();
      setSelectedMimeType(mimeType);

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        setAudioBlob(finalBlob);
        const newUrl = URL.createObjectURL(finalBlob);
        setAudioUrl(newUrl);
      };

      speechStartTimeRef.current = Date.now();

      // Native browser speech recognition for real voice transcription
      const SpeechRecognitionClass =
        (window as unknown as { SpeechRecognition?: new () => IWindowSpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => IWindowSpeechRecognition }).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'en-US';

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            const results = event.results;
            let fullText = '';
            for (let i = 0; i < results.length; i++) {
              const res = results[i];
              if (res && res[0]) {
                const phrase = res[0].transcript.trim();
                fullText += (fullText ? ' ' : '') + phrase;

                // Split into word tokens with timestamps
                const nowSec = (Date.now() - speechStartTimeRef.current) / 1000;
                const tokens = phrase.split(/\s+/).filter(Boolean);
                const step = 0.35;
                const phraseStart = Math.max(0, nowSec - tokens.length * step);

                tokens.forEach((token, tIdx) => {
                  const start = Math.round((phraseStart + tIdx * step) * 100) / 100;
                  const end = Math.round((start + 0.3) * 100) / 100;
                  wordsAccumulatorRef.current.push({
                    word: token,
                    start,
                    end,
                  });
                });
              }
            }

            setLiveTranscript(fullText);
            setTranscriptWords([...wordsAccumulatorRef.current]);
          };

          recognition.onerror = () => {
            // Speech recognition non-fatal error
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Browser speech recognition not supported or blocked
        }
      }

      recorder.start(250);
      setIsRecording(true);

      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(elapsed);

        if (elapsed >= MAX_DURATION_SECONDS) {
          stopRecording();
        }
      }, 500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Microphone access denied or unavailable';
      setError(message);
      cleanupAudioNodes();
    }
  }, [audioUrl, cleanupAudioNodes, stopRecording]);

  const resetRecording = useCallback(() => {
    stopRecording();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordingDuration(0);
    setError(null);
    audioChunksRef.current = [];
    wordsAccumulatorRef.current = [];
    setTranscriptWords([]);
    setLiveTranscript('');
  }, [audioUrl, stopRecording]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      cleanupAudioNodes();
    };
  }, [cleanupAudioNodes]);

  return {
    isRecording,
    recordingDuration,
    volumeLevel,
    audioBlob,
    audioUrl,
    selectedMimeType,
    transcriptWords,
    liveTranscript,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
