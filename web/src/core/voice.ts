import { VoiceIntent } from '../types';
import { KEYWORD_INTENTS } from './i18n';
import { speech } from './speech';

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

export interface RoutedIntent {
  intent: VoiceIntent;
  target?: string;
  raw: string;
}

export type IntentHandler = (result: RoutedIntent) => void;

class VoiceRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;
  private currentLang = 'en-IN';
  private intentHandlers: Set<IntentHandler> = new Set();
  private statusListeners: Set<(isListening: boolean) => void> = new Set();
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSpeechEndTime = 0;

  constructor() {
    this.initRecognition();
    if (typeof window !== 'undefined') {
      speech.subscribe((speaking) => {
        if (!speaking) {
          this.lastSpeechEndTime = Date.now();
        }
      });
    }
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
        // Acoustic echo cancellation: ignore mic input while AI is speaking or for 700ms afterwards
        if (speech.isSpeaking() || Date.now() - this.lastSpeechEndTime < 700) {
          return;
        }

        const lastIndex = event.results.length - 1;
        if (lastIndex >= 0) {
          const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
          const routed = this.routeIntent(transcript);
          this.intentHandlers.forEach((handler) => handler(routed));
        }
      };

      this.recognition.onerror = (e) => {
        console.warn('SpeechRecognition error:', e);
      };

      this.recognition.onend = () => {
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

  public routeIntent(transcript: string): RoutedIntent {
    const text = transcript.trim().toLowerCase();
    let resolvedIntent: VoiceIntent = 'UNKNOWN';
    let target: string | undefined = undefined;

    // Check target extraction for FIND ("find my bottle", "find washroom", "find chair")
    const findMatch = text.match(/\b(?:find|where is|locate|look for)\s+(?:my\s+|the\s+|a\s+)?([a-z0-9_\-\s]+)/i);
    if (findMatch && findMatch[1]) {
      const extracted = findMatch[1].trim();
      if (!/^(?:what|how|why)$/i.test(extracted)) {
        resolvedIntent = 'FIND';
        target = extracted;
      }
    }

    // Check target extraction for NAVIGATE ("take me to lab", "navigate to entrance")
    const navMatch = text.match(/\b(?:take me to|navigate to|go to|lead me to)\s+(?:my\s+|the\s+|a\s+)?([a-z0-9_\-\s]+)/i);
    if (navMatch && navMatch[1]) {
      resolvedIntent = 'NAVIGATE';
      target = navMatch[1].trim();
    }

    // Check keyword dictionary (sorted by longest phrase first to avoid prefix shadowing)
    if (resolvedIntent === 'UNKNOWN') {
      const sortedKeywords = Object.entries(KEYWORD_INTENTS).sort(
        (a, b) => b[0].length - a[0].length
      );
      for (const [phrase, intentName] of sortedKeywords) {
        if (text.includes(phrase)) {
          resolvedIntent = intentName as VoiceIntent;
          break;
        }
      }
    }

    // Secondary regex matching
    if (resolvedIntent === 'UNKNOWN') {
      if (/\b(washroom|restroom|toilet|bathroom|loo|wc)\b/i.test(text)) {
        resolvedIntent = 'FIND';
        target = 'washroom';
      } else if (/\b(currency|money|rupee|note|cash)\b/i.test(text)) {
        resolvedIntent = 'CURRENCY';
      } else if (/\b(waste|bin|garbage|trash|dustbin)\b/i.test(text)) {
        resolvedIntent = 'WASTE';
      } else if (/\b(label|expiry|allergens|product|ingredients)\b/i.test(text)) {
        resolvedIntent = 'LABEL';
      } else if (/\b(hazard|stairs|curb|hole|tripping)\b/i.test(text)) {
        resolvedIntent = 'HAZARD';
      } else if (/\b(sos|emergency|help me)\b/i.test(text)) {
        resolvedIntent = 'SOS';
      } else if (/\b(quiet)\b/i.test(text)) {
        resolvedIntent = 'VERBOSITY_QUIET';
      } else if (/\b(detailed)\b/i.test(text)) {
        resolvedIntent = 'VERBOSITY_DETAILED';
      } else if (/\b(stop|silence|cancel)\b/i.test(text)) {
        resolvedIntent = 'STOP';
      } else if (/\b(repeat|again)\b/i.test(text)) {
        resolvedIntent = 'REPEAT';
      } else if (/\b(help|commands|options)\b/i.test(text)) {
        resolvedIntent = 'HELP';
      } else if (/\b(privacy)\b/i.test(text)) {
        resolvedIntent = 'PRIVACY';
      }
    }

    return {
      intent: resolvedIntent,
      target,
      raw: transcript,
    };
  }
}

export const voice = new VoiceRecognizer();
