import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { networkMonitor } from '../core/network';
import { speech } from '../core/speech';
import { askContext } from './context';
import { routeUserRequest } from './router';

describe('AskRouter Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    askContext.clear();
    vi.spyOn(speech, 'speak').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles fast local path with source: local and zero network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await routeUserRequest('where is the washroom');

    expect(result).not.toBeNull();
    expect(result?.tool).toBe('find_target');
    expect(result?.source).toBe('local');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects online tools when device is offline', async () => {
    vi.spyOn(networkMonitor, 'isOnline').mockReturnValue(false);
    const speakSpy = vi.spyOn(speech, 'speak');

    const result = await routeUserRequest('what color is this shirt');
    expect(result).toBeNull();
    expect(speakSpy).toHaveBeenCalledWith(
      'I need internet for that.',
      expect.objectContaining({ priority: 'normal' })
    );
  });

  it('calls POST /api/ask and parses valid tool call', async () => {
    vi.spyOn(networkMonitor, 'isOnline').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        tool: 'describe_scene',
        args: {},
        confidence: 0.95,
        source: 'gemini',
      }),
    } as any);

    const result = await routeUserRequest('can you see what is here');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('describe_scene');
    expect(result?.source).toBe('gemini');
  });

  it('handles clarify tool call with one-round limit callback', async () => {
    vi.useFakeTimers();
    vi.spyOn(networkMonitor, 'isOnline').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        tool: 'clarify',
        args: { question: 'Did you mean read text or describe?' },
        confidence: 0.5,
        source: 'gemini',
      }),
    } as any);

    const listenAgain = vi.fn();
    const result = await routeUserRequest('something strange', listenAgain);

    expect(result?.tool).toBe('clarify');
    expect(speech.speak).toHaveBeenCalledWith(
      'Did you mean read text or describe?',
      expect.anything()
    );

    // Verify automatic second listen
    vi.advanceTimersByTime(1300);
    expect(listenAgain).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('handles network error gracefully and speaks error', async () => {
    vi.spyOn(networkMonitor, 'isOnline').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await routeUserRequest('what is this');
    expect(result).toBeNull();
    expect(speech.speak).toHaveBeenCalledWith(
      "Sorry, I couldn't understand. Try again.",
      expect.anything()
    );
  });
});
