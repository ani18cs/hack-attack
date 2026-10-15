import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { settings } from '../core/settings';
import { spatialAudio } from '../core/spatialAudio';
import { speech } from '../core/speech';
import { camera } from '../core/camera';
import { FindStateMachine } from '../modes/findStateMachine';
import type {
  AskData,
  CurrencyData,
  HazardData,
  LabelData,
  SosContextData,
  WasteData,
} from '../types';
import { loadVenuePack } from '../venue/loader';
import { venueNavigator } from '../venue/navigator';
import { api } from '../vision/api';
import { detector } from '../vision/detector';
import { recognizeTextFallback } from '../vision/ocr';
import { processSpatialObject } from '../vision/spatial';
import { askContext } from './context';
import type { RouterTool, ToolCall } from './types';

export interface ToolRuntimeStatus {
  activeTool: RouterTool | null;
  isExecutingOneShot: boolean;
  sosConfirmationPending: boolean;
}

export type StatusListener = (status: ToolRuntimeStatus) => void;

export class ToolRuntime {
  private activeLongRunningTool: RouterTool | null = null;
  private longRunningStopFn: (() => void) | null = null;
  private isExecutingOneShot = false;
  private sosConfirmationPending = false;
  private sosTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<StatusListener> = new Set();

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  public getStatus(): ToolRuntimeStatus {
    return {
      activeTool: this.activeLongRunningTool,
      isExecutingOneShot: this.isExecutingOneShot,
      sosConfirmationPending: this.sosConfirmationPending,
    };
  }

  public getActiveTool(): RouterTool | null {
    return this.activeLongRunningTool;
  }

  public isSosPending(): boolean {
    return this.sosConfirmationPending;
  }

  /**
   * Stops any currently active long-running tool.
   * Announces "Stopping {previous}." per spec.
   */
  public stopActiveLongRunning(announced = true): void {
    if (this.activeLongRunningTool) {
      const prevName = this.activeLongRunningTool.replace(/_/g, ' ');
      if (this.longRunningStopFn) {
        try {
          this.longRunningStopFn();
        } catch (e) {
          console.warn('[ToolRuntime] Error stopping long-running tool:', e);
        }
      }
      this.activeLongRunningTool = null;
      this.longRunningStopFn = null;
      askContext.setActiveTool(null);

      if (announced) {
        speech.speak(`Stopping ${prevName}.`, { priority: 'normal' });
      }
      this.notify();
    }
  }

  /**
   * Executes a tool call picked by the local fast-path or the Gemini router.
   */
  public async execute(call: ToolCall): Promise<void> {
    const { tool, args, speechPrefix } = call;

    // 1. Speak short prefix if provided (e.g. from router)
    if (speechPrefix && speechPrefix.trim().length > 0) {
      speech.speak(speechPrefix, { priority: 'normal' });
    }

    // 2. Dispatch to specific tool implementation
    switch (tool) {
      case 'describe_scene':
        await this.runDescribeScene();
        break;

      case 'read_text':
        await this.runReadText();
        break;

      case 'find_target':
        await this.startFindTarget(args?.target || 'washroom');
        break;

      case 'identify_currency':
        await this.runIdentifyCurrency();
        break;

      case 'sort_waste':
        await this.runSortWaste();
        break;

      case 'read_label':
        await this.runReadLabel();
        break;

      case 'scan_hazards':
        if (args?.enabled === false) {
          if (this.activeLongRunningTool === 'scan_hazards') {
            this.stopActiveLongRunning(true);
          }
        } else {
          await this.startScanHazards();
        }
        break;

      case 'navigate_to':
        await this.startNavigateTo(args?.destination || 'washroom');
        break;

      case 'where_am_i':
        this.runWhereAmI();
        break;

      case 'answer_about_view':
        await this.runAnswerAboutView(args?.question || '');
        break;

      case 'stop_current':
        this.handleStopCurrent();
        break;

      case 'repeat_last':
        this.handleRepeatLast();
        break;

      case 'set_verbosity':
        this.handleSetVerbosity(args?.level || 'normal');
        break;

      case 'set_language':
        this.handleSetLanguage(args?.lang || 'en');
        break;

      case 'trigger_sos':
        this.startSosConfirmation();
        break;

      case 'help':
        this.handleHelp();
        break;

      case 'clarify':
        // Clarify was already announced or handled by router
        break;

      default:
        console.warn(`[ToolRuntime] Unrecognized tool: ${tool}`);
        break;
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 1: describe_scene (One-shot)                                          */
  /* -------------------------------------------------------------------------- */
  private async runDescribeScene(): Promise<void> {
    this.isExecutingOneShot = true;
    this.notify();

    speech.speak('Looking.', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(720, 0.65);
      if (!frame) {
        speech.speak('Camera not ready. Tap and try again.', { priority: 'normal' });
        return;
      }

      const res = await api.describe(frame, speech.getLang());
      if (res.ok && res.summary) {
        askContext.setLastAnswer(res.summary);
        earcons.success();
        haptics.pulseFound();
        speech.speak(res.summary, { priority: 'normal' });
      } else {
        const fallback = res.summary || "I'm not sure. Tap and try again.";
        askContext.setLastAnswer(fallback);
        speech.speak(fallback, { priority: 'normal' });
      }
    } catch (err: any) {
      console.warn('[ToolRuntime] describe_scene error:', err);
      speech.speak("I'm not sure. Tap and try again.", { priority: 'normal' });
    } finally {
      this.isExecutingOneShot = false;
      this.notify();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 2: read_text (One-shot with offline fallback)                         */
  /* -------------------------------------------------------------------------- */
  private async runReadText(): Promise<void> {
    this.isExecutingOneShot = true;
    this.notify();

    speech.speak('Looking.', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(720, 0.65);
      if (!frame) {
        speech.speak('Camera not ready. Tap and try again.', { priority: 'normal' });
        return;
      }

      let textResult = '';
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await api.read(frame, speech.getLang());
        if (res.ok && res.summary) {
          textResult = res.summary;
        }
      }

      // Offline or cloud failure fallback
      if (!textResult) {
        const local = await recognizeTextFallback(frame);
        if (local && local.texts && local.texts.length > 0) {
          textResult = local.texts.map((t) => t.text).join('. ');
        }
      }

      if (textResult) {
        askContext.setLastAnswer(textResult);
        earcons.success();
        haptics.pulseFound();
        speech.speak(textResult, { priority: 'normal' });
      } else {
        const noText = 'No text detected in view.';
        askContext.setLastAnswer(noText);
        speech.speak(noText, { priority: 'normal' });
      }
    } catch (err: any) {
      console.warn('[ToolRuntime] read_text error:', err);
      speech.speak("Couldn't read text. Try holding it steady.", { priority: 'normal' });
    } finally {
      this.isExecutingOneShot = false;
      this.notify();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 3: find_target (Long-running loop with 3D audio beacon)               */
  /* -------------------------------------------------------------------------- */
  private async startFindTarget(rawTarget: string): Promise<void> {
    const target = rawTarget.trim().toLowerCase();

    // 1. Stop any previously active long-running tool
    this.stopActiveLongRunning(true);

    this.activeLongRunningTool = 'find_target';
    askContext.setActiveTool('find_target');
    this.notify();

    let scanInterval: ReturnType<typeof setInterval> | null = null;

    const fsm = new FindStateMachine(target, {
      onStateChange: (state) => {
        if (state === 'ARRIVED' || state === 'NOT_FOUND') {
          if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
          }
          this.activeLongRunningTool = null;
          askContext.setActiveTool(null);
          this.notify();
        }
      },
      onSpeak: (text, priority) => {
        // Lower priority to low if user is executing a one-shot request
        const effectivePriority = this.isExecutingOneShot ? 'low' : priority || 'normal';
        speech.speak(text, { priority: effectivePriority });
      },
      onBeaconStart: (direction, distance) => {
        spatialAudio.startBeacon(() => ({ direction, distance }));
        let intervalMs = 900;
        if (distance === 'very-close') intervalMs = 120;
        else if (distance === 'close') intervalMs = 250;
        else if (distance === 'near') intervalMs = 500;
        earcons.startProximityBeep(intervalMs, 680);
      },
      onBeaconStop: () => {
        spatialAudio.stopBeacon();
        earcons.stopProximityBeep();
      },
      onEarcon: (type) => {
        if (type === 'found') earcons.found();
        if (type === 'success') earcons.success();
        if (type === 'error') earcons.error();
      },
      onHaptic: (type) => {
        if (type === 'found') haptics.pulseFound();
      },
    });

    this.longRunningStopFn = () => {
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      fsm.stop();
      spatialAudio.stopBeacon();
      earcons.stopProximityBeep();
      api.abortTask('find');
    };

    fsm.start();

    // Periodic scanner loop
    scanInterval = setInterval(async () => {
      if (this.activeLongRunningTool !== 'find_target') {
        if (scanInterval) clearInterval(scanInterval);
        return;
      }

      fsm.tick(Date.now());
      if (fsm.state === 'ARRIVED' || fsm.state === 'NOT_FOUND') {
        if (scanInterval) {
          clearInterval(scanInterval);
          scanInterval = null;
        }
        return;
      }

      if (fsm.isInFlight()) return;

      // Local COCO detection for common objects
      if (fsm.isCocoTarget()) {
        const video = camera.getVideoElement();
        if (video && video.readyState >= 2) {
          fsm.setInFlight(true);
          try {
            const rawDetections = await detector.detect(video);
            const matching = rawDetections.filter(
              (d) => d.label.toLowerCase() === fsm.target && d.score >= 0.5
            );

            if (matching.length > 0) {
              const best = matching[0];
              const spatial = processSpatialObject(
                best,
                video.videoWidth || 640,
                video.videoHeight || 480
              );
              fsm.handleResult({
                found: true,
                direction: spatial.direction,
                distance: spatial.distance,
                confidence: best.score,
                cue: `${fsm.target} spotted ${spatial.direction.replace('-', ' ')}.`,
              });
            } else {
              fsm.handleResult({
                found: false,
                direction: 'unknown',
                distance: 'far',
                confidence: 0,
              });
            }
          } catch (detErr) {
            console.warn('[ToolRuntime] Local find error:', detErr);
            fsm.setInFlight(false);
          }
        }
        return;
      }

      // Cloud Vision analysis for complex targets (e.g. washroom, exit)
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) return;

      fsm.setInFlight(true);
      try {
        const res = await api.find(frame, fsm.target, speech.getLang());
        if (res.ok && res.data) {
          fsm.handleResult({
            found: res.data.found,
            direction: res.data.direction,
            distance: res.data.distance,
            confidence: res.confidence,
            cue: res.data.cue || res.summary,
            gender: res.data.gender,
          });
        } else {
          fsm.setInFlight(false);
        }
      } catch (err) {
        console.warn('[ToolRuntime] Cloud find error:', err);
        fsm.setInFlight(false);
      }
    }, 2000);
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 4: identify_currency (One-shot, refuse-to-guess)                      */
  /* -------------------------------------------------------------------------- */
  private async runIdentifyCurrency(): Promise<void> {
    this.isExecutingOneShot = true;
    this.notify();

    speech.speak('Looking.', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Tap and try again.', { priority: 'normal' });
        return;
      }

      const res = await api.analyze<CurrencyData>({
        task: 'currency',
        image: frame,
        lang: speech.getLang(),
      });

      if (res.ok && res.data && res.data.denomination !== null) {
        const summary = res.summary || `${res.data.denomination} rupee note.`;
        askContext.setLastAnswer(summary);
        earcons.success();
        haptics.pulseFound();
        speech.speak(summary, { priority: 'normal' });
      } else {
        earcons.error();
        const fallback = res.summary || "I can't tell, hold the note flat and closer.";
        askContext.setLastAnswer(fallback);
        speech.speak(fallback, { priority: 'normal' });
      }
    } catch (err: any) {
      console.warn('[ToolRuntime] identify_currency error:', err);
      earcons.error();
      speech.speak("I can't tell, hold the note flat and closer.", { priority: 'normal' });
    } finally {
      this.isExecutingOneShot = false;
      this.notify();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 5: sort_waste (One-shot)                                              */
  /* -------------------------------------------------------------------------- */
  private async runSortWaste(): Promise<void> {
    this.isExecutingOneShot = true;
    this.notify();

    speech.speak('Looking.', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Tap and try again.', { priority: 'normal' });
        return;
      }

      const res = await api.analyze<WasteData>({
        task: 'waste',
        image: frame,
        lang: speech.getLang(),
      });

      if (res.ok && res.data) {
        const spoken = res.summary || `${res.data.item}. Put in ${res.data.binHint}.`;
        askContext.setLastAnswer(spoken);
        if (res.data.category !== 'unknown') {
          earcons.success();
          haptics.pulseFound();
        } else {
          earcons.error();
        }
        speech.speak(spoken, { priority: 'normal' });
      } else {
        earcons.error();
        const fallback = res.summary || "I'm not sure. Please check the bin label.";
        askContext.setLastAnswer(fallback);
        speech.speak(fallback, { priority: 'normal' });
      }
    } catch (err: any) {
      console.warn('[ToolRuntime] sort_waste error:', err);
      earcons.error();
      speech.speak("I'm not sure. Please check the bin label.", { priority: 'normal' });
    } finally {
      this.isExecutingOneShot = false;
      this.notify();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 6: read_label (One-shot, refuse-to-guess)                             */
  /* -------------------------------------------------------------------------- */
  private async runReadLabel(): Promise<void> {
    this.isExecutingOneShot = true;
    this.notify();

    speech.speak('Looking.', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Tap and try again.', { priority: 'normal' });
        return;
      }

      const res = await api.analyze<LabelData>({
        task: 'label',
        image: frame,
        lang: speech.getLang(),
      });

      if (res.ok && res.data && res.data.legible) {
        const spoken = res.summary || `${res.data.product}.`;
        askContext.setLastAnswer(spoken);
        earcons.success();
        haptics.pulseFound();
        speech.speak(spoken, { priority: 'normal' });
      } else {
        earcons.error();
        const fallback =
          res.summary || "I can't read that clearly. Please ask someone to check, especially the expiry date.";
        askContext.setLastAnswer(fallback);
        speech.speak(fallback, { priority: 'normal' });
      }
    } catch (err: any) {
      console.warn('[ToolRuntime] read_label error:', err);
      earcons.error();
      speech.speak("I can't read that clearly. Please ask someone to check.", { priority: 'normal' });
    } finally {
      this.isExecutingOneShot = false;
      this.notify();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 7: scan_hazards (Long-running periodic loop)                          */
  /* -------------------------------------------------------------------------- */
  private async startScanHazards(): Promise<void> {
    this.stopActiveLongRunning(true);

    this.activeLongRunningTool = 'scan_hazards';
    askContext.setActiveTool('scan_hazards');
    this.notify();

    speech.speak('Hazard scan is a helper, not a guarantee. Keep using your cane.', {
      priority: 'normal',
    });

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    const runHazardCheck = async () => {
      if (inFlight || this.activeLongRunningTool !== 'scan_hazards') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) return;

      inFlight = true;
      try {
        const res = await api.analyze<HazardData>({
          task: 'hazard',
          image: frame,
          lang: speech.getLang(),
        });

        if (res.ok && res.data?.hazards) {
          const highHazards = res.data.hazards.filter((h) => h.urgency === 'high');
          if (highHazards.length > 0) {
            const top = highHazards[0];
            const dir = top.direction === 'ahead' ? 'ahead' : `on your ${top.direction.replace('-', ' ')}`;
            const alertMsg = `Stop. Caution: ${top.type} ${dir}.`;
            earcons.hazard();
            haptics.pulseDanger();
            speech.speak(alertMsg, { priority: 'danger' });
          }
        }
      } catch (err) {
        console.warn('[ToolRuntime] Hazard loop error:', err);
      } finally {
        inFlight = false;
      }
    };

    intervalId = setInterval(runHazardCheck, 6000);
    const initialTimer = setTimeout(runHazardCheck, 1200);

    this.longRunningStopFn = () => {
      if (intervalId) clearInterval(intervalId);
      clearTimeout(initialTimer);
      api.abortTask('hazard');
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 8: navigate_to (Long-running route guidance)                          */
  /* -------------------------------------------------------------------------- */
  private async startNavigateTo(destination: string): Promise<void> {
    this.stopActiveLongRunning(true);

    this.activeLongRunningTool = 'navigate_to';
    askContext.setActiveTool('navigate_to');
    this.notify();

    const venue = await loadVenuePack('amc-hackattack');
    if (!venue) {
      speech.speak("Venue map is not loaded. Scanning for signs instead.", { priority: 'normal' });
      await this.startFindTarget(destination);
      return;
    }

    // Default start landmark: entrance
    const fromLandmark = venue.landmarks[0];

    const navEvent = venueNavigator.startNavigation({
      fromLandmark,
      destinationQuery: destination,
      venue,
    });

    speech.speak(navEvent.instruction, { priority: 'normal' });

    if (navEvent.fallbackToFind) {
      await this.startFindTarget(destination);
      return;
    }

    this.longRunningStopFn = () => {
      venueNavigator.stop();
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 9: where_am_i (One-shot)                                              */
  /* -------------------------------------------------------------------------- */
  private runWhereAmI(): void {
    const desc = venueNavigator.getStatusDescription();
    askContext.setLastAnswer(desc);
    speech.speak(desc, { priority: 'normal' });
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 10: answer_about_view (One-shot camera Q&A)                           */
  /* -------------------------------------------------------------------------- */
  private async runAnswerAboutView(question: string): Promise<void> {
    this.isExecutingOneShot = true;
    this.notify();

    speech.speak('Looking.', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Tap and try again.', { priority: 'normal' });
        return;
      }

      const res = await api.analyze<AskData>({
        task: 'ask',
        image: frame,
        context: question,
        lang: speech.getLang(),
      });

      if (res.ok && res.data?.answer) {
        const answer = res.data.answer;
        askContext.setLastAnswer(answer);
        earcons.success();
        speech.speak(answer, { priority: 'normal' });
      } else {
        const fallback = res.summary || "I'm not sure. Hold it closer.";
        askContext.setLastAnswer(fallback);
        speech.speak(fallback, { priority: 'normal' });
      }
    } catch (err: any) {
      console.warn('[ToolRuntime] answer_about_view error:', err);
      speech.speak("I'm not sure. Hold it closer.", { priority: 'normal' });
    } finally {
      this.isExecutingOneShot = false;
      this.notify();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 11: stop_current                                                      */
  /* -------------------------------------------------------------------------- */
  public handleStopCurrent(): void {
    if (this.sosConfirmationPending) {
      this.cancelSos();
      return;
    }

    if (this.activeLongRunningTool) {
      this.stopActiveLongRunning(true);
    } else {
      speech.stop();
      speech.speak('Stopped.', { priority: 'normal' });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 12: repeat_last                                                       */
  /* -------------------------------------------------------------------------- */
  public handleRepeatLast(): void {
    const last = askContext.getLastAnswer();
    if (last) {
      speech.speak(last, { priority: 'normal' });
    } else if (this.activeLongRunningTool === 'navigate_to') {
      speech.speak(venueNavigator.repeatInstruction(), { priority: 'normal' });
    } else {
      speech.speak('Nothing to repeat.', { priority: 'normal' });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 13: set_verbosity                                                     */
  /* -------------------------------------------------------------------------- */
  private handleSetVerbosity(level: 'quiet' | 'normal' | 'detailed'): void {
    settings.updateSettings({ verbosity: level });
    if (level === 'quiet') {
      speech.speak('Quiet mode enabled. Hazards only.', { priority: 'normal' });
    } else if (level === 'detailed') {
      speech.speak('Detailed mode enabled.', { priority: 'normal' });
    } else {
      speech.speak('Normal verbosity enabled.', { priority: 'normal' });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 14: set_language                                                      */
  /* -------------------------------------------------------------------------- */
  private handleSetLanguage(lang: 'en' | 'hi' | 'kn'): void {
    const localeMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' } as const;
    const locale = localeMap[lang] || 'en-IN';
    speech.setLang(locale);

    if (lang === 'hi') {
      speech.speak('Hindi selected.', { priority: 'normal' });
    } else if (lang === 'kn') {
      speech.speak('Kannada selected.', { priority: 'normal' });
    } else {
      speech.speak('English selected.', { priority: 'normal' });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 15: trigger_sos (Deterministic confirmation flow)                     */
  /* -------------------------------------------------------------------------- */
  public startSosConfirmation(): void {
    this.sosConfirmationPending = true;
    this.notify();

    earcons.hazard();
    haptics.pulseDanger();

    speech.speak('Send emergency message? Say yes or tap twice.', { priority: 'danger' });

    if (this.sosTimeout) clearTimeout(this.sosTimeout);
    this.sosTimeout = setTimeout(() => {
      if (this.sosConfirmationPending) {
        this.cancelSos(false);
      }
    }, 12000);
  }

  public async confirmSos(): Promise<void> {
    if (!this.sosConfirmationPending) return;
    this.sosConfirmationPending = false;
    if (this.sosTimeout) clearTimeout(this.sosTimeout);
    this.notify();

    speech.speak('Preparing emergency message...', { priority: 'danger' });
    earcons.hazard();
    haptics.pulseDanger();

    let lat = 12.8718;
    let lng = 77.5946;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 4000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn('[ToolRuntime] Geolocation unavailable:', e);
      }
    }

    let desc = 'Assisting user with emergency assistance';
    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (frame) {
        const res = await api.analyze<SosContextData>({
          task: 'sos_context',
          image: frame,
          lang: speech.getLang(),
        });
        if (res.ok && res.summary) {
          desc = res.summary;
        }
      }
    } catch (e) {
      console.warn('[ToolRuntime] Visual SOS context error:', e);
    }

    const trustedNumber = settings.getSettings().trustedContact || '+919876543210';
    const message = `I need help. My location: https://maps.google.com/?q=${lat},${lng}. Around me: ${desc}.`;

    const cleanNumber = trustedNumber.replace(/\+/g, '').replace(/\s/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }

    speech.speak('Emergency message opened. Tap send in WhatsApp.', { priority: 'danger' });
  }

  public cancelSos(announced = true): void {
    this.sosConfirmationPending = false;
    if (this.sosTimeout) clearTimeout(this.sosTimeout);
    this.notify();

    if (announced) {
      speech.speak('Emergency cancelled.', { priority: 'normal' });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Tool 16: help                                                              */
  /* -------------------------------------------------------------------------- */
  private handleHelp(): void {
    speech.speak(
      'Tap anywhere and ask me anything. You can say: what is in front of me, read signs, find washroom, or help.',
      { priority: 'normal' }
    );
  }
}

export const toolRuntime = new ToolRuntime();
