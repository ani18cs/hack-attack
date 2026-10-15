import { GUIDANCE } from '../config/guidance';
import { settings } from './settings';
import type { SpeakPriority, Verbosity } from '../types';

export type SpeechCategory =
  | 'danger'
  | 'guidance'
  | 'instruction'
  | 'tool_answer'
  | 'announcement'
  | 'system';

export interface SpeechRequest {
  text: string;
  key?: string; // Optional deduplication key; defaults to normalized text
  priority?: SpeakPriority; // 'danger' | 'normal' | 'low'
  category?: SpeechCategory;
  isTransition?: boolean; // Guidance state transition flag
  timestamp?: number;
}

export interface SpeechPolicyStats {
  lastSpokenTime: number;
  totalSpoken: number;
  totalSuppressed: number;
}

/**
 * SpeechPolicy: Central arbiter of all spoken utterances.
 * Applied before any utterance is queued or spoken.
 *
 * Rules:
 * 1. Guidance speech only on state transitions or meaningful instruction changes.
 * 2. Non-urgent minimum gap (nonUrgentMinGapMs: 5000ms) between utterances.
 * 3. Same message (same key) suppressed for sameMessageCooldownMs (12000ms).
 * 4. STOP and danger exempt from gap and long cooldown, but deduplicated within 2000ms.
 * 5. Never speak while the user is listening (except danger).
 * 6. Never talk over an active tool answer.
 * 7. Verbosity:
 *    - Quiet: STOP and danger only.
 *    - Normal: transitions, instructions, tool answers, system confirmations.
 *    - Detailed: adds object names and distances.
 */
export class SpeechPolicy {
  private lastSpokenTime = 0;
  private messageTimestamps = new Map<string, number>();
  private isUserListening = false;
  private isToolAnswering = false;

  private totalSpoken = 0;
  private totalSuppressed = 0;

  public setUserListening(listening: boolean): void {
    this.isUserListening = listening;
  }

  public setToolAnswering(answering: boolean): void {
    this.isToolAnswering = answering;
  }

  public getIsUserListening(): boolean {
    return this.isUserListening;
  }

  public getIsToolAnswering(): boolean {
    return this.isToolAnswering;
  }

  public reset(): void {
    this.lastSpokenTime = 0;
    this.messageTimestamps.clear();
    this.isUserListening = false;
    this.isToolAnswering = false;
    this.totalSpoken = 0;
    this.totalSuppressed = 0;
  }

  public getStats(): SpeechPolicyStats {
    return {
      lastSpokenTime: this.lastSpokenTime,
      totalSpoken: this.totalSpoken,
      totalSuppressed: this.totalSuppressed,
    };
  }

  /**
   * Normalizes a text string into a clean deduplication key.
   */
  public generateKey(text: string): string {
    return text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  }

  /**
   * Evaluates whether a proposed speech request satisfies all policy constraints.
   */
  public canSpeak(request: SpeechRequest, currentVerbosity?: Verbosity): boolean {
    const text = request.text?.trim();
    if (!text) return false;

    const now = request.timestamp ?? Date.now();
    const priority = request.priority || 'normal';
    const category = request.category || (priority === 'danger' ? 'danger' : 'instruction');
    const verbosity = currentVerbosity ?? settings.getSettings().verbosity ?? 'normal';
    const key = request.key || this.generateKey(text);

    // Rule 1: DANGER and STOP handling
    const isStopOrDanger =
      priority === 'danger' ||
      category === 'danger' ||
      text.toLowerCase().startsWith('stop') ||
      key.includes('stop');

    if (isStopOrDanger) {
      // STOP and danger are exempt from non-urgent gap and verbosity,
      // but still deduplicated within 2 seconds (2000ms).
      const lastDangerTime = this.messageTimestamps.get(key) || 0;
      if (now - lastDangerTime < 2000) {
        this.totalSuppressed++;
        return false;
      }
      return true;
    }

    // Rule 2: User listening guard
    // Never speak while the user is listening
    if (this.isUserListening) {
      this.totalSuppressed++;
      return false;
    }

    // Rule 3: Tool answer guard
    // Never talk over an active tool answer unless this is the tool answer itself
    if (this.isToolAnswering && category !== 'tool_answer') {
      this.totalSuppressed++;
      return false;
    }

    // Rule 4: Verbosity filtering
    if (verbosity === 'quiet') {
      // Quiet = STOP and danger only
      this.totalSuppressed++;
      return false;
    }

    if (verbosity === 'normal') {
      // Normal = transitions, instructions, tool answers, system confirmations.
      // Continuous object listings (category === 'announcement') are suppressed.
      if (category === 'announcement' && !request.isTransition) {
        this.totalSuppressed++;
        return false;
      }
    }

    // Rule 5: Guidance speech rule
    // Guidance speech only on state transitions or when instruction changes meaningfully
    if (category === 'guidance' && !request.isTransition) {
      this.totalSuppressed++;
      return false;
    }

    // Rule 6: Non-urgent minimum gap (GUIDANCE.speech.nonUrgentMinGapMs = 5000ms)
    const gapElapsed = now - this.lastSpokenTime;
    if (gapElapsed < GUIDANCE.speech.nonUrgentMinGapMs) {
      this.totalSuppressed++;
      return false;
    }

    // Rule 7: Same message cooldown (GUIDANCE.speech.sameMessageCooldownMs = 12000ms)
    const lastKeyTime = this.messageTimestamps.get(key) || 0;
    if (now - lastKeyTime < GUIDANCE.speech.sameMessageCooldownMs) {
      this.totalSuppressed++;
      return false;
    }

    return true;
  }

  /**
   * Records that an utterance was accepted and spoken, updating timestamps.
   */
  public recordSpoken(request: SpeechRequest, timestamp?: number): void {
    const now = timestamp ?? Date.now();
    const key = request.key || this.generateKey(request.text);

    this.lastSpokenTime = now;
    this.messageTimestamps.set(key, now);
    this.totalSpoken++;
  }
}

export const speechPolicy = new SpeechPolicy();
