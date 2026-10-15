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

class SpeechController {
  private queue: QueuedItem[] = [];
  private speaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private defaultLang = 'en-IN';
  private defaultRate = 1.0;
  private maxQueueSize = 3;
  private listeners: Set<(isSpeaking: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Voices loaded
      };
    }
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
  }

  public stop(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.queue = [];
    window.speechSynthesis.cancel();
    this.speaking = false;
    this.currentUtterance = null;
    this.notify();
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
      // Danger immediately interrupts everything
      window.speechSynthesis.cancel();
      this.queue = [];
      this.speaking = false;
      this.currentUtterance = null;
      this.executeUtterance({ text, options });
      return;
    }

    if (priority === 'low') {
      // Low priority speaks only if idle and queue is empty
      if (this.speaking || this.queue.length > 0) {
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
    utterance.lang = options.lang || this.defaultLang;
    utterance.rate = options.rate || this.defaultRate;
    utterance.pitch = options.pitch || 1.0;

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

    // Ensure audio unlocking
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
