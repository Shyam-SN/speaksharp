import type {
  Prompt,
  SessionRecord,
  SessionDetailResponse,
  CreateSessionResponse,
} from '@speaksharp/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  private getHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
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
  ): Promise<CreateSessionResponse> {
    const formData = new FormData();
    const filename = audioBlob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm';
    formData.append('audio', audioBlob, filename);
    if (promptId) {
      formData.append('promptId', promptId);
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
}

export const api = new ApiClient();
