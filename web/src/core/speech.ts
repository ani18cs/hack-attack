import { SpeakPriority } from '../types';
import { settings } from './settings';

export interface SpeakOptions {
  priority?: SpeakPriority;
  lang?: string;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

interface QueuedItem {
  text: string;
  options: SpeakOptions;
}

/**
 * Confidence-aware speech helper used by all modes:
 * high (>= 0.6): plain text
 * medium (0.35 - 0.6): "I think ..."
 * low (< 0.35): "I'm not sure, but ..."
 */
export function confidencePhrase(confidence: number, text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (confidence >= 0.6) {
    return trimmed;
  }
  const lowerFirst = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  if (confidence >= 0.35) {
    return `I think ${lowerFirst}`;
  }
  return `I'm not sure, but ${lowerFirst}`;
}

class SpeechController {
  private queue: QueuedItem[] = [];
  private speaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private defaultLang = 'en-IN';
  private defaultRate = 1.0;
  private maxQueueSize = 3;
  private isPausedForEarcon = false;
  private listeners: Set<(isSpeaking: boolean) => void> = new Set();
  private voices: SpeechSynthesisVoice[] = [];
  private warnedMissingVoiceLocales = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices();
  }

  public subscribe(listener: (isSpeaking: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.speaking);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.speaking));
  }

  public isSpeaking(): boolean {
    return this.speaking || this.currentUtterance !== null;
  }

  public setRate(rate: number): void {
    this.defaultRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public setLang(lang: string): void {
    this.defaultLang = lang;
    this.checkVoiceAvailability(lang);
  }

  public getLang(): string {
    return this.defaultLang;
  }

  private checkVoiceAvailability(lang: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (lang.startsWith('en')) return;

    if (this.voices.length === 0) {
      this.loadVoices();
    }

    const prefix = lang.slice(0, 2).toLowerCase();
    const hasVoice = this.voices.some((v) => v.lang.toLowerCase().startsWith(prefix));

    if (!hasVoice && !this.warnedMissingVoiceLocales.has(prefix)) {
      this.warnedMissingVoiceLocales.add(prefix);
      const langName = prefix === 'hi' ? 'Hindi' : prefix === 'kn' ? 'Kannada' : prefix;
      setTimeout(() => {
        this.speak(`${langName} voice is not installed on this device. Using English voice.`, {
          priority: 'normal',
          lang: 'en-IN',
        });
      }, 500);
    }
  }

  /**
   * Pause speech queue briefly so earcon sound cues never overlap spoken words.
   */
  public pauseFor(durationMs = 300): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.isPausedForEarcon = true;
    try {
      window.speechSynthesis.pause();
    } catch {}

    setTimeout(() => {
      this.isPausedForEarcon = false;
      try {
        window.speechSynthesis.resume();
      } catch {}
    }, durationMs);
  }

  public stop(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.queue = [];
    window.speechSynthesis.cancel();
    this.speaking = false;
    this.currentUtterance = null;
    this.notify();
  }

  public withConfidence(text: string, confidence: number): string {
    return confidencePhrase(confidence, text);
  }

  public speak(text: string, options: SpeakOptions = {}): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis not available');
      return;
    }

    const priority = options.priority || 'normal';

    // Respect Verbosity: quiet speaks hazards only
    if (settings.getSettings().verbosity === 'quiet' && priority !== 'danger') {
      return;
    }

    if (priority === 'danger') {
      // Danger immediately interrupts and cancels everything
      window.speechSynthesis.cancel();
      this.queue = [];
      this.speaking = false;
      this.currentUtterance = null;
      this.executeUtterance({ text, options });
      return;
    }

    if (priority === 'low') {
      // Low priority speaks only if idle and queue is empty
      if (this.speaking || this.queue.length > 0 || this.isPausedForEarcon) {
        return;
      }
      this.executeUtterance({ text, options });
      return;
    }

    // Normal priority: queue with max limit 3, drop oldest
    if (this.speaking) {
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift(); // Drop oldest
      }
      this.queue.push({ text, options });
    } else {
      this.executeUtterance({ text, options });
    }
  }

  private executeUtterance(item: QueuedItem): void {
    const { text, options } = item;
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = options.lang || this.defaultLang;
    utterance.lang = targetLang;
    utterance.rate = options.rate || this.defaultRate;
    utterance.pitch = options.pitch || 1.0;

    // Pick best matching installed voice if available
    if (this.voices.length > 0) {
      const prefix = targetLang.slice(0, 2).toLowerCase();
      const matched = this.voices.find(
        (v) => v.lang.toLowerCase().startsWith(prefix) || v.lang.toLowerCase().replace('_', '-').startsWith(prefix)
      );
      if (matched) {
        utterance.voice = matched;
      }
    }

    this.currentUtterance = utterance;
    this.speaking = true;
    this.notify();

    utterance.onend = () => {
      this.speaking = false;
      this.currentUtterance = null;
      this.notify();
      if (options.onEnd) {
        try {
          options.onEnd();
        } catch (e) {
          console.error(e);
        }
      }
      // Process next queued utterance
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.executeUtterance(next);
      }
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      this.speaking = false;
      this.currentUtterance = null;
      this.notify();
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.executeUtterance(next);
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Failed to trigger speechSynthesis.speak', err);
      this.speaking = false;
      this.notify();
    }
  }
}

export const speech = new SpeechController();
