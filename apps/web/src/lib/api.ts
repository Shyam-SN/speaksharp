import type {
  Prompt,
  SessionRecord,
  SessionDetailResponse,
  CreateSessionResponse,
} from '@speaksharp/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  private getHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};
    const effectiveToken = this.token || 'demo-token';
    headers['Authorization'] = `Bearer ${effectiveToken}`;
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  async getPrompts(): Promise<Prompt[]> {
    const res = await fetch(`${API_BASE_URL}/api/prompts`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch speaking prompts');
    }
    const data = (await res.json()) as { prompts: Prompt[] };
    return data.prompts;
  }

  async createSession(
    audioBlob: Blob,
    promptId?: string | null,
    transcriptWords?: Array<{ word: string; start: number; end: number }>,
    transcriptText?: string,
  ): Promise<CreateSessionResponse> {
    const formData = new FormData();
    const filename = audioBlob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm';
    formData.append('audio', audioBlob, filename);
    if (promptId) {
      formData.append('promptId', promptId);
    }
    if (transcriptWords && transcriptWords.length > 0) {
      formData.append('words', JSON.stringify(transcriptWords));
    }
    if (transcriptText) {
      formData.append('text', transcriptText);
    }

    const res = await fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: this.getHeaders(), // Let browser set multipart boundary
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `HTTP ${res.status}: Upload failed`);
    }

    return (await res.json()) as CreateSessionResponse;
  }

  async getSession(id: string): Promise<SessionDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Session not found' }));
      throw new Error(err.error || `HTTP ${res.status}: Failed to fetch session`);
    }

    return (await res.json()) as SessionDetailResponse;
  }

  async getUserSessions(): Promise<SessionRecord[]> {
    const res = await fetch(`${API_BASE_URL}/api/sessions`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error('Failed to fetch session history');
    }

    const data = (await res.json()) as { sessions: SessionRecord[] };
    return data.sessions;
  }

  async getQuota(): Promise<{
    limit: number;
    used: number;
    remaining: number;
    resetSeconds: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/quota`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return { limit: 5, used: 0, remaining: 5, resetSeconds: 86400 };
    }
    return res.json();
  }

  async generateTTS(sessionId: string): Promise<{ ttsAudioUrl: string | null; useBrowserSpeech: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/tts`, {
      method: 'POST',
      headers: this.getHeaders('application/json'),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'TTS generation failed' }));
      throw new Error(err.error || `HTTP ${res.status}: TTS request failed`);
    }

    return (await res.json()) as { ttsAudioUrl: string | null; useBrowserSpeech: boolean };
  }
}

export const api = new ApiClient();

