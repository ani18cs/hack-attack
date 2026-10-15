import { UnitPreference, Verbosity } from '../types';
import { calibrateFromWalk, deriveFromHeight } from '../vision/units';

export interface AppSettings {
  verbosity: Verbosity;
  language: 'en-IN' | 'hi-IN' | 'kn-IN';
  dashboardVisible: boolean;
  trustedContact: string;
  unitPreference: UnitPreference;
  strideMeters: number;
  handSpanMeters: number;
  userHeightMeters?: number;
  speechRate?: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  verbosity: 'normal',
  language: 'en-IN',
  dashboardVisible: false,
  trustedContact: '+919876543210',
  unitPreference: 'strides',
  strideMeters: 0.7,
  handSpanMeters: 0.19,
  speechRate: 0.85,
};

const STORAGE_KEY = 'andhadhun_settings_v1';
const LEGACY_STORAGE_KEY = 'sightline_settings_v1';

class SettingsManager {
  private settings: AppSettings = DEFAULT_SETTINGS;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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

  public setUnitPreference(unitPreference: UnitPreference): void {
    this.settings.unitPreference = unitPreference;
    this.save();
  }

  public setUserHeight(heightMeters: number): void {
    const derived = deriveFromHeight(heightMeters);
    this.settings.userHeightMeters = heightMeters;
    this.settings.strideMeters = derived.strideMeters;
    this.settings.handSpanMeters = derived.handSpanMeters;
    this.save();
  }

  public calibrateStride(knownDistanceMeters: number, stepsCounted: number): number {
    const calibrated = calibrateFromWalk(knownDistanceMeters, stepsCounted);
    this.settings.strideMeters = calibrated;
    this.save();
    return calibrated;
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
