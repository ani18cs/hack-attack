import type {
  AnalyzeRequest,
  AnalyzeResponse,
  DescribeData,
  FindData,
  HealthResponse,
  ReadData,
  VisionTask,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// Track one in-flight AbortController per task to cancel previous requests
const inFlightControllers = new Map<VisionTask, AbortController>();

export const api = {
  /**
   * Cancel any in-flight request for a specific task.
   */
  abortTask: (task: VisionTask): void => {
    const existing = inFlightControllers.get(task);
    if (existing) {
      existing.abort();
      inFlightControllers.delete(task);
    }
  },

  /**
   * Cancel all in-flight requests (e.g. on mode switch).
   */
  abortAll: (): void => {
    for (const [task, controller] of inFlightControllers.entries()) {
      controller.abort();
      inFlightControllers.delete(task);
    }
  },

  /**
   * Check backend server health.
   */
  checkHealth: async (): Promise<HealthResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[SightLine API] Health check failed:', err);
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Unified analysis endpoint.
   * Enforces 1 in-flight request per task, handles aborts, and applies timeouts.
   */
  analyze: async <T = any>(
    req: AnalyzeRequest,
    timeoutMs = 10000
  ): Promise<AnalyzeResponse<T>> => {
    // 1. Abort existing request for the same task
    api.abortTask(req.task);

    const controller = new AbortController();
    inFlightControllers.set(req.task, controller);

    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const startTime = Date.now();

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with HTTP ${res.status}`);
      }

      const result: AnalyzeResponse<T> = await res.json();
      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          task: req.task,
          ok: false,
          summary: '',
          confidence: 0,
          data: null as any,
          error: 'Request cancelled or timed out',
          latencyMs: Date.now() - startTime,
        };
      }

      console.error(`[SightLine API] Task "${req.task}" error:`, err.message);
      return {
        task: req.task,
        ok: false,
        summary: 'Cannot reach vision server. Please check your network connection.',
        confidence: 0,
        data: null as any,
        error: err.message || 'Network request failed',
        latencyMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timer);
      if (inFlightControllers.get(req.task) === controller) {
        inFlightControllers.delete(req.task);
      }
    }
  },

  // Convenience typed wrappers:
  describe: (image: string, lang = 'en') =>
    api.analyze<DescribeData>({ task: 'describe', image, lang }),

  read: (image: string, lang = 'en') =>
    api.analyze<ReadData>({ task: 'read', image, lang }),

  readText: async (image: string, lang = 'en') => {
    const res = await api.read(image, lang);
    return {
      summary: res.summary,
      texts: res.data?.texts || [],
      confidence: res.confidence,
      error: res.error,
    };
  },

  find: (image: string, target = 'restroom', lang = 'en') =>
    api.analyze<FindData>({ task: 'find', image, target, lang }),

  findTarget: async (image: string, target = 'restroom', lang = 'en') => {
    const res = await api.find(image, target, lang);
    return {
      found: res.data?.found ?? false,
      direction: res.data?.direction ?? 'unknown',
      gender: res.data?.gender ?? 'unknown',
      confidence: res.confidence,
      cue: res.data?.cue || res.summary,
      error: res.error,
    };
  },
};
