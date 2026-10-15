import { networkMonitor } from '../core/network';
import { speech } from '../core/speech';
import { askLog } from './askLog';
import { askContext } from './context';
import { matchFastPath } from './fastPath';
import { askRouterResponseSchema, type ToolCall } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

let inFlightClarify = false;

export async function routeUserRequest(
  transcript: string,
  onListenAgain?: () => void
): Promise<ToolCall | null> {
  const clean = transcript.trim();
  if (!clean) return null;

  const isOnline = networkMonitor.isOnline();
  const state = askContext.getState(isOnline);

  // 1. Check fast local path first (0ms latency, works offline)
  const localMatch = matchFastPath(clean, state);
  if (localMatch) {
    askContext.addTurn('user', clean);
    inFlightClarify = false;
    askLog.add({
      transcript: clean,
      tool: localMatch.tool,
      source: 'local',
      confidence: localMatch.confidence,
      latencyMs: 0,
    });
    return localMatch;
  }

  // 2. Offline check for requests requiring AI reasoning
  if (!isOnline) {
    speech.speak('I need internet for that.', { priority: 'normal' });
    inFlightClarify = false;
    return null;
  }

  // 3. Online Gemini text-only router via POST /api/ask
  const currentLang = speech.getLang().startsWith('hi')
    ? 'hi'
    : speech.getLang().startsWith('kn')
    ? 'kn'
    : 'en';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: clean,
        lang: currentLang,
        state,
        history: askContext.getHistory(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const rawData = await res.json();
    const parsed = askRouterResponseSchema.safeParse(rawData);

    if (!parsed.success) {
      throw new Error('Malformed router response');
    }

    const { tool, args, speechPrefix, confidence, latencyMs } = parsed.data;

    askContext.addTurn('user', clean);
    askLog.add({
      transcript: clean,
      tool,
      source: 'gemini',
      confidence,
      latencyMs: latencyMs ?? 0,
    });

    // 4. Handle clarify requests (max 1 clarify round per request)
    if (tool === 'clarify') {
      const question = args?.question || 'Could you please say what you would like to do?';
      askContext.addTurn('assistant', question);
      speech.speak(question, { priority: 'normal' });

      if (onListenAgain && !inFlightClarify) {
        inFlightClarify = true;
        // Automatically start listening once for user clarification
        setTimeout(() => {
          onListenAgain();
        }, 1200);
      } else {
        inFlightClarify = false;
      }

      return {
        tool: 'clarify',
        args,
        confidence,
        source: 'gemini',
      };
    }

    inFlightClarify = false;
    return {
      tool,
      args,
      speechPrefix,
      confidence,
      source: 'gemini',
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    inFlightClarify = false;
    console.warn('[AskRouter] Request error:', err.message);
    speech.speak("Sorry, I couldn't understand. Try again.", { priority: 'normal' });
    return null;
  }
}
