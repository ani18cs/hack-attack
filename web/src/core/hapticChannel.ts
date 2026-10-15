import { GUIDANCE } from '../config/guidance';
import type { GuidanceState } from '../guidance/engine';
import { earcons } from './earcons';
import { speech } from './speech';

export interface HapticChannelStatus {
  state: GuidanceState;
  hasVibration: boolean;
  isAudioFallback: boolean;
  isWatchdogPaused: boolean;
  lastPingAgeMs: number;
}

/**
 * HapticChannel: Single owner and abstraction over vibration patterns and iOS audio fallbacks.
 * Maintains heartbeat timers, STOP continuous vibration patterns with safety reissue,
 * and the safety watchdog.
 */
export class HapticChannel {
  private currentState: GuidanceState = 'CLEAR';
  private isRunning = false;
  private hasVibration = false;
  private hasAnnouncedMode = false;
  private heartbeatAudio = false; // default off on devices with vibration

  // Timers
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private stopReissueInterval: ReturnType<typeof setInterval> | null = null;
  private audioStopInterval: ReturnType<typeof setInterval> | null = null;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;

  // Watchdog state
  private lastFrameProcessedTime = Date.now();
  private isWatchdogPaused = false;

  // Subscribed listeners for dashboard / UI
  private listeners: Set<(status: HapticChannelStatus) => void> = new Set();

  constructor(options?: { hasVibration?: boolean }) {
    if (options && options.hasVibration !== undefined) {
      this.hasVibration = options.hasVibration;
    } else {
      this.detectCapabilities();
    }
  }

  public detectCapabilities(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      this.hasVibration = true;
    } else if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      this.hasVibration = typeof window.navigator.vibrate === 'function';
    } else {
      this.hasVibration = false;
    }
  }

  public isVibrationSupported(): boolean {
    return this.hasVibration;
  }

  public isAudioFallbackActive(): boolean {
    return !this.hasVibration;
  }

  public isPaused(): boolean {
    return this.isWatchdogPaused;
  }

  public getState(): GuidanceState {
    return this.currentState;
  }

  public setHeartbeatAudio(enabled: boolean): void {
    this.heartbeatAudio = enabled;
  }

  public getStatus(): HapticChannelStatus {
    return {
      state: this.currentState,
      hasVibration: this.hasVibration,
      isAudioFallback: !this.hasVibration,
      isWatchdogPaused: this.isWatchdogPaused,
      lastPingAgeMs: Date.now() - this.lastFrameProcessedTime,
    };
  }

  public subscribe(listener: (status: HapticChannelStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  /**
   * Starts the channel and watchdog checking.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameProcessedTime = Date.now();
    this.isWatchdogPaused = false;

    // Speak mode notice once if vibration is unavailable (iOS Safari fallback)
    if (!this.hasVibration && !this.hasAnnouncedMode) {
      this.hasAnnouncedMode = true;
      speech.speak('Vibration not available. Using sounds.', { priority: 'normal' });
    }

    // Start watchdog monitor (runs every 200ms)
    this.startWatchdogMonitor();

    // Start initial heartbeat
    this.applyStatePattern(this.currentState);
    this.notifyListeners();
  }

  /**
   * Stops all vibration, audio fallbacks, and watchdog timers.
   */
  public stop(): void {
    this.isRunning = false;
    this.clearAllTimers();
    if (this.hasVibration && typeof navigator !== 'undefined') {
      try {
        navigator.vibrate(0);
      } catch {
        // Safe fallback
      }
    }
    this.notifyListeners();
  }

  /**
   * Notifies the channel that a detector frame was processed. Resets watchdog timeout.
   */
  public notifyFrameProcessed(timestamp?: number): void {
    this.lastFrameProcessedTime = timestamp ?? Date.now();

    if (this.isWatchdogPaused) {
      // Vision was paused and now resumed!
      this.isWatchdogPaused = false;
      speech.speak('Vision resumed.', { priority: 'normal' });
      if (this.isRunning) {
        this.applyStatePattern(this.currentState);
      }
      this.notifyListeners();
    }
  }

  /**
   * Sets the active guidance state ('CLEAR' | 'CAUTION' | 'STOP').
   */
  public setState(newState: GuidanceState): void {
    const previousState = this.currentState;
    this.currentState = newState;

    if (!this.isRunning) return;

    if (previousState !== newState || !this.heartbeatInterval) {
      this.applyStatePattern(newState);
      this.notifyListeners();
    }
  }

  private clearAllTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.stopReissueInterval) {
      clearInterval(this.stopReissueInterval);
      this.stopReissueInterval = null;
    }
    if (this.audioStopInterval) {
      clearInterval(this.audioStopInterval);
      this.audioStopInterval = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private cancelStopSignals(): void {
    if (this.stopReissueInterval) {
      clearInterval(this.stopReissueInterval);
      this.stopReissueInterval = null;
    }
    if (this.audioStopInterval) {
      clearInterval(this.audioStopInterval);
      this.audioStopInterval = null;
    }
    if (this.hasVibration && typeof navigator !== 'undefined') {
      try {
        navigator.vibrate(0);
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Applies haptic or audio signals for the given guidance state.
   */
  private applyStatePattern(state: GuidanceState): void {
    // If watchdog paused, do not output normal pulses
    if (this.isWatchdogPaused) {
      this.clearAllTimers();
      this.startWatchdogMonitor();
      return;
    }

    // Leaving or entering STOP: clear previous stop reissue and cancel vibration(0)
    this.cancelStopSignals();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const { haptics } = GUIDANCE;

    if (state === 'STOP') {
      // STOP = Continuous: call navigator.vibrate(stopPatternMs) and re-issue on a timer every stopReissueMs
      if (this.hasVibration) {
        try {
          navigator.vibrate(haptics.stopPatternMs);
        } catch {
          // Ignore
        }
        this.stopReissueInterval = setInterval(() => {
          if (this.hasVibration && this.currentState === 'STOP' && !this.isWatchdogPaused) {
            try {
              navigator.vibrate(haptics.stopPatternMs);
            } catch {
              // Ignore
            }
          }
        }, haptics.stopReissueMs);
      } else {
        // iOS Safari Audio Fallback: Continuous rapid low tone
        earcons.playTone(220, 80, 0.2);
        this.audioStopInterval = setInterval(() => {
          if (this.currentState === 'STOP' && !this.isWatchdogPaused) {
            earcons.playTone(220, 80, 0.2);
          }
        }, 250);
      }
    } else if (state === 'CAUTION') {
      if (haptics.cautionEnabled) {
        // Double pulse every cautionIntervalMs
        this.triggerCautionSignal();
        this.heartbeatInterval = setInterval(() => {
          if (this.currentState === 'CAUTION' && !this.isWatchdogPaused) {
            this.triggerCautionSignal();
          }
        }, haptics.cautionIntervalMs);
      } else {
        // Caution disabled: treat as CLEAR heartbeat
        this.triggerClearSignal();
        this.heartbeatInterval = setInterval(() => {
          if (this.currentState === 'CAUTION' && !this.isWatchdogPaused) {
            this.triggerClearSignal();
          }
        }, haptics.clearIntervalMs);
      }
    } else {
      // CLEAR = Single pulse every clearIntervalMs
      this.triggerClearSignal();
      this.heartbeatInterval = setInterval(() => {
        if (this.currentState === 'CLEAR' && !this.isWatchdogPaused) {
          this.triggerClearSignal();
        }
      }, haptics.clearIntervalMs);
    }
  }

  private triggerClearSignal(): void {
    if (this.hasVibration) {
      try {
        navigator.vibrate(GUIDANCE.haptics.clearPulseMs);
      } catch {
        // Ignore
      }
    } else if (this.heartbeatAudio) {
      // Soft tick only if heartbeatAudio is on
      earcons.playTone(1000, 15, 0.04);
    }
  }

  private triggerCautionSignal(): void {
    if (this.hasVibration) {
      try {
        navigator.vibrate(GUIDANCE.haptics.cautionPattern);
      } catch {
        // Ignore
      }
    } else {
      // Distinct double tick for audio fallback
      earcons.playTone(800, 25, 0.1);
      setTimeout(() => {
        earcons.playTone(800, 25, 0.1);
      }, 80);
    }
  }

  /**
   * Evaluates watchdog status and triggers pause if frame timeout exceeded (>1000ms).
   */
  public checkWatchdog(now: number = Date.now()): void {
    if (!this.isRunning) return;

    const elapsedMs = now - this.lastFrameProcessedTime;
    if (elapsedMs > 1000 && !this.isWatchdogPaused) {
      // WATCHDOG TRIGGERED!
      this.isWatchdogPaused = true;

      // Stop CLEAR heartbeat and STOP reissue
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      this.cancelStopSignals();

      // Play error earcon and distinct vibration
      earcons.error();
      if (this.hasVibration && typeof navigator !== 'undefined') {
        try {
          navigator.vibrate([200, 100, 200, 100, 200]);
        } catch {
          // Ignore
        }
      }

      speech.speak('Vision paused.', { priority: 'danger' });
      this.notifyListeners();
    }
  }

  private startWatchdogMonitor(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }

    this.watchdogInterval = setInterval(() => {
      this.checkWatchdog();
    }, 200);
  }
}

export const hapticChannel = new HapticChannel();
