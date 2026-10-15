import { DescribeResponse, FindResponse, HealthResponse, ReadResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  checkHealth: async (): Promise<HealthResponse> => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/health`, { method: 'GET' }, 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('Health check failed:', err);
      return { ok: false };
    }
  },

  describeScene: async (imageBase64: string, lang = 'en'): Promise<DescribeResponse> => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, lang }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('describeScene error:', err);
      return {
        summary: "I'm having trouble connecting to the vision server.",
        objects: [],
        error: err.message,
      };
    }
  },

  readText: async (imageBase64: string, lang = 'en'): Promise<ReadResponse> => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, lang }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('readText error:', err);
      return {
        summary: 'Cannot read text right now.',
        texts: [],
        error: err.message,
      };
    }
  },

  findTarget: async (imageBase64: string, target = 'restroom', lang = 'en'): Promise<FindResponse> => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, target, lang }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('findTarget error:', err);
      return {
        found: false,
        direction: 'unknown',
        gender: 'unknown',
        confidence: 0,
        cue: '',
        error: err.message,
      };
    }
  },
};
