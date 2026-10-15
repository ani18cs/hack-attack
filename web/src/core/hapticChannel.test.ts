import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HapticChannel } from './hapticChannel';
import { earcons } from './earcons';
import { speech } from './speech';
import { GUIDANCE } from '../config/guidance';

describe('HapticChannel', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;
  let earconErrorMock: ReturnType<typeof vi.spyOn>;
  let earconToneMock: ReturnType<typeof vi.spyOn>;
  let speechSpeakMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'],
    });

    vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate: vibrateMock },
      configurable: true,
      writable: true,
    });

    earconErrorMock = vi.spyOn(earcons, 'error').mockImplementation(() => {});
    earconToneMock = vi.spyOn(earcons, 'playTone').mockImplementation(() => {});
    speechSpeakMock = vi.spyOn(speech, 'speak').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('triggers CLEAR heartbeat pulse every clearIntervalMs (2500ms)', () => {
    const channel = new HapticChannel();
    channel.start();

    // Initial clear pulse on start
    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.clearPulseMs);
    vibrateMock.mockClear();

    // Keep frames active so watchdog does not fire
    vi.advanceTimersByTime(800);
    channel.notifyFrameProcessed();
    vi.advanceTimersByTime(800);
    channel.notifyFrameProcessed();
    vi.advanceTimersByTime(900); // Total 2500ms

    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.clearPulseMs);

    channel.stop();
  });

  it('triggers STOP pattern and re-issues every stopReissueMs (1000ms)', () => {
    const channel = new HapticChannel();
    channel.start();
    vibrateMock.mockClear();

    channel.setState('STOP');
    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.stopPatternMs);

    vibrateMock.mockClear();
    // Advance 1000ms
    vi.advanceTimersByTime(GUIDANCE.haptics.stopReissueMs);
    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.stopPatternMs);

    channel.stop();
  });

  it('cancels vibration with vibrate(0) and clears reissue timer on exit from STOP', () => {
    const channel = new HapticChannel();
    channel.start();
    channel.setState('STOP');

    vibrateMock.mockClear();
    channel.setState('CLEAR');

    // Should call vibrate(0) to cancel ongoing stop vibration
    expect(vibrateMock).toHaveBeenCalledWith(0);

    vibrateMock.mockClear();
    // Advancing 1000ms should NOT re-issue STOP
    vi.advanceTimersByTime(GUIDANCE.haptics.stopReissueMs);
    expect(vibrateMock).not.toHaveBeenCalledWith(GUIDANCE.haptics.stopPatternMs);

    channel.stop();
  });

  it('triggers CAUTION pattern every cautionIntervalMs when cautionEnabled is true', () => {
    const channel = new HapticChannel();
    channel.start();
    vibrateMock.mockClear();

    channel.setState('CAUTION');
    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.cautionPattern);

    vibrateMock.mockClear();
    vi.advanceTimersByTime(700);
    channel.notifyFrameProcessed();
    vi.advanceTimersByTime(800); // Total 1500ms
    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.cautionPattern);

    channel.stop();
  });

  it('treats CAUTION as CLEAR heartbeat when caution is disabled in config', () => {
    const original = GUIDANCE.haptics.cautionEnabled;
    GUIDANCE.haptics.cautionEnabled = false;

    const channel = new HapticChannel();
    channel.start();
    vibrateMock.mockClear();

    channel.setState('CAUTION');
    // Should trigger clearPulseMs instead of cautionPattern
    expect(vibrateMock).toHaveBeenCalledWith(GUIDANCE.haptics.clearPulseMs);

    channel.stop();
    GUIDANCE.haptics.cautionEnabled = original;
  });

  describe('Watchdog Safety Monitor', () => {
    it('triggers watchdog pause if no frame is processed for >1000ms', () => {
      const channel = new HapticChannel();
      channel.start();
      vibrateMock.mockClear();

      // Advance by 1200ms (crosses 1000ms threshold on 200ms monitor tick)
      vi.advanceTimersByTime(1200);

      expect(channel.isPaused()).toBe(true);
      expect(earconErrorMock).toHaveBeenCalled();
      expect(vibrateMock).toHaveBeenCalledWith([200, 100, 200, 100, 200]);
      expect(speechSpeakMock).toHaveBeenCalledWith('Vision paused.', { priority: 'danger' });

      // Heartbeat should be stopped while paused
      vibrateMock.mockClear();
      vi.advanceTimersByTime(3000);
      expect(vibrateMock).not.toHaveBeenCalledWith(GUIDANCE.haptics.clearPulseMs);

      channel.stop();
    });

    it('recovers when frame processing resumes', () => {
      const channel = new HapticChannel();
      channel.start();

      // Trigger watchdog pause
      vi.advanceTimersByTime(1200);
      expect(channel.isPaused()).toBe(true);

      // Notify new frame arrived
      channel.notifyFrameProcessed();

      expect(channel.isPaused()).toBe(false);
      expect(speechSpeakMock).toHaveBeenCalledWith('Vision resumed.', { priority: 'normal' });

      channel.stop();
    });
  });

  describe('iOS Safari Audio Fallback', () => {
    it('activates audio fallback and speaks notice when navigator.vibrate is undefined', () => {
      // Simulate iOS Safari with no vibration API
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const channel = new HapticChannel();
      expect(channel.isAudioFallbackActive()).toBe(true);
      expect(channel.isVibrationSupported()).toBe(false);

      channel.start();
      expect(speechSpeakMock).toHaveBeenCalledWith(
        'Vibration not available. Using sounds.',
        { priority: 'normal' }
      );

      channel.stop();
    });

    it('plays distinct double tick for CAUTION in audio fallback', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const channel = new HapticChannel();
      channel.start();
      earconToneMock.mockClear();

      channel.setState('CAUTION');
      expect(earconToneMock).toHaveBeenCalledWith(800, 25, 0.1);

      // Advance 80ms for second tick
      vi.advanceTimersByTime(80);
      expect(earconToneMock).toHaveBeenCalledTimes(2);

      channel.stop();
    });

    it('plays continuous rapid low tone for STOP in audio fallback', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const channel = new HapticChannel();
      channel.start();
      earconToneMock.mockClear();

      channel.setState('STOP');
      expect(earconToneMock).toHaveBeenCalledWith(220, 80, 0.2);

      // Re-issues rapid low tone every 250ms
      vi.advanceTimersByTime(250);
      expect(earconToneMock).toHaveBeenCalledTimes(2);

      channel.stop();
    });
  });
});
