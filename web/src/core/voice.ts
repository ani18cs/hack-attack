import { VoiceIntent } from '../types';
import { KEYWORD_INTENTS } from './i18n';

// Type declarations for Web Speech API
interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal?: boolean;
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export type IntentHandler = (intent: VoiceIntent, transcript: string) => void;

class VoiceRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;
  private currentLang = 'en-IN';
  private intentHandlers: Set<IntentHandler> = new Set();
  private statusListeners: Set<(isListening: boolean) => void> = new Set();
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = this.currentLang;

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const lastIndex = event.results.length - 1;
        if (lastIndex >= 0) {
          const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
          this.routeIntent(transcript);
        }
      };

      this.recognition.onerror = (e) => {
        console.warn('SpeechRecognition error:', e);
      };

      this.recognition.onend = () => {
        // Auto-restart if we are still meant to be running
        if (this.running) {
          this.restartTimeout = setTimeout(() => {
            if (this.running && this.recognition) {
              try {
                this.recognition.start();
              } catch (err) {
                console.warn('Could not auto-restart recognition:', err);
              }
            }
          }, 300);
        } else {
          this.notifyStatus(false);
        }
      };
    } catch (e) {
      console.error('Failed to create SpeechRecognition instance:', e);
    }
  }

  public subscribe(handler: IntentHandler): () => void {
    this.intentHandlers.add(handler);
    return () => this.intentHandlers.delete(handler);
  }

  public onStatusChange(listener: (isListening: boolean) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.running);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(isListening: boolean): void {
    this.statusListeners.forEach((fn) => fn(isListening));
  }

  public setLang(lang: string): void {
    this.currentLang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
      if (this.running) {
        this.stop();
        this.start();
      }
    }
  }

  public start(): void {
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) return;

    this.running = true;
    try {
      this.recognition.start();
      this.notifyStatus(true);
    } catch (err) {
      console.warn('Recognition already started or error:', err);
    }
  }

  public stop(): void {
    this.running = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }
    this.notifyStatus(false);
  }

  public isListening(): boolean {
    return this.running;
  }

  public routeIntent(transcript: string): VoiceIntent {
    let resolvedIntent: VoiceIntent = 'UNKNOWN';

    // Check fuzzy match against KEYWORD_INTENTS
    for (const [phrase, intentName] of Object.entries(KEYWORD_INTENTS)) {
      if (transcript.includes(phrase)) {
        resolvedIntent = intentName as VoiceIntent;
        break;
      }
    }

    // Specific regex checks for edge cases
    if (resolvedIntent === 'UNKNOWN') {
      if (/\b(washroom|restroom|toilet|bathroom|loo|wc)\b/i.test(transcript)) {
        resolvedIntent = 'FIND_WASHROOM';
      } else if (/\b(around|surroundings|describe|environment)\b/i.test(transcript)) {
        resolvedIntent = 'AROUND_ME';
      } else if (/\b(read|text|sign|board|what does it say)\b/i.test(transcript)) {
        resolvedIntent = 'READ';
      } else if (/\b(obstacle|danger|walk|alert)\b/i.test(transcript)) {
        resolvedIntent = 'OBSTACLE_ON';
      } else if (/\b(stop|quiet|cancel|silence)\b/i.test(transcript)) {
        resolvedIntent = 'STOP';
      } else if (/\b(help|commands|options)\b/i.test(transcript)) {
        resolvedIntent = 'HELP';
      } else if (/\b(repeat|again)\b/i.test(transcript)) {
        resolvedIntent = 'REPEAT';
      }
    }

    this.intentHandlers.forEach((handler) => handler(resolvedIntent, transcript));
    return resolvedIntent;
  }
}

export const voice = new VoiceRecognizer();
