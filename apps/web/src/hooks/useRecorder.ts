import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseRecorderResult {
  isRecording: boolean;
  recordingDuration: number; // in seconds (for timer display)
  recordingDurationMs: number; // in milliseconds (exact duration)
  volumeLevel: number; // 0 to 100
  audioBlob: Blob | null;
  audioUrl: string | null;
  selectedMimeType: string;
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

export function useRecorder(): UseRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

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
    setVolumeLevel(0);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Flush final chunk before stopping so nothing is lost
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        // requestData may fail if recorder is already stopping
      }
      mediaRecorderRef.current.stop();
    }

    if (startTimeRef.current > 0) {
      const elapsedMs = Math.round(performance.now() - startTimeRef.current);
      setRecordingDurationMs(elapsedMs);
      setRecordingDuration(Math.round(elapsedMs / 1000));
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
    setRecordingDurationMs(0);
    audioChunksRef.current = [];

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
        // Build the complete audio blob from ALL recorded chunks
        const finalBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        setAudioBlob(finalBlob);
        const newUrl = URL.createObjectURL(finalBlob);
        setAudioUrl(newUrl);
      };

      startTimeRef.current = performance.now();

      // Use 1000ms timeslice to ensure continuous reliable data collection
      recorder.start(1000);
      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        const elapsedSec = Math.floor((performance.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsedSec);

        if (elapsedSec >= MAX_DURATION_SECONDS) {
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
    setRecordingDurationMs(0);
    setError(null);
    audioChunksRef.current = [];
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
    recordingDurationMs,
    volumeLevel,
    audioBlob,
    audioUrl,
    selectedMimeType,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
