import { Verbosity } from '../types';

export interface AppSettings {
  verbosity: Verbosity;
  language: 'en-IN' | 'hi-IN' | 'kn-IN';
  dashboardVisible: boolean;
  trustedContact: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  verbosity: 'normal',
  language: 'en-IN',
  dashboardVisible: false,
  trustedContact: '+919876543210',
};

const STORAGE_KEY = 'sightline_settings_v1';

class SettingsManager {
  private settings: AppSettings = DEFAULT_SETTINGS;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage:', e);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notify();
    } catch (e) {
      console.warn('Could not save settings to localStorage:', e);
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public setVerbosity(verbosity: Verbosity): void {
    this.settings.verbosity = verbosity;
    this.save();
  }

  public setLanguage(language: 'en-IN' | 'hi-IN' | 'kn-IN'): void {
    this.settings.language = language;
    this.save();
  }

  public toggleDashboard(forced?: boolean): boolean {
    this.settings.dashboardVisible = forced ?? !this.settings.dashboardVisible;
    this.save();
    return this.settings.dashboardVisible;
  }

  public updateSettings(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }

  public subscribe(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.getSettings()));
  }
}

export const settings = new SettingsManager();
