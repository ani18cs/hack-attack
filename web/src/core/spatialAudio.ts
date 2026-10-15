import { Direction, DistanceBucket } from '../types';

export interface BeaconTarget {
  direction: Direction;
  distance: DistanceBucket;
}

class SpatialAudioBeacon {
  private ctx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  private initAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startBeacon(getTarget: () => BeaconTarget | null): void {
    this.stopBeacon();
    this.isRunning = true;

    const ctx = this.initAudio();
    if (!ctx) return;

    const scheduleNextPing = () => {
      if (!this.isRunning) return;

      const target = getTarget();
      if (!target) {
        this.intervalId = setTimeout(scheduleNextPing, 500);
        return;
      }

      // Interval & gain scaling per spec:
      // very-close: 120ms, close: 250ms, near: 500ms, far: 900ms
      let intervalMs = 500;
      let gain = 0.2;
      let pitch = 700;

      switch (target.distance) {
        case 'very-close':
          intervalMs = 120;
          gain = 0.35;
          pitch = 950;
          break;
        case 'close':
          intervalMs = 250;
          gain = 0.28;
          pitch = 850;
          break;
        case 'near':
          intervalMs = 500;
          gain = 0.2;
          pitch = 750;
          break;
        case 'far':
        default:
          intervalMs = 900;
          gain = 0.12;
          pitch = 650;
          break;
      }

      // Direction X offset (-1.0 to 1.0)
      let panX = 0;
      switch (target.direction) {
        case 'left':
          panX = -0.85;
          break;
        case 'slightly-left':
          panX = -0.35;
          break;
        case 'ahead':
          panX = 0;
          break;
        case 'slightly-right':
          panX = 0.35;
          break;
        case 'right':
          panX = 0.85;
          break;
      }

      this.playSpatialPing(panX, pitch, gain);
      this.intervalId = setTimeout(scheduleNextPing, intervalMs);
    };

    scheduleNextPing();
  }

  private playSpatialPing(panX: number, pitch: number, gainVal: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    // Try HRTF PannerNode first
    if ('createPanner' in ctx && typeof ctx.createPanner === 'function') {
      try {
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.positionX.setValueAtTime(panX, ctx.currentTime);
        panner.positionY.setValueAtTime(0, ctx.currentTime);
        panner.positionZ.setValueAtTime(-1, ctx.currentTime);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        return;
      } catch {
        // Fall back to StereoPanner
      }
    }

    // Stereo Panner fallback
    const ctxAny = ctx as any;
    if (typeof ctxAny.createStereoPanner === 'function') {
      const stereoPanner = ctxAny.createStereoPanner();
      stereoPanner.pan.setValueAtTime(panX, ctx.currentTime);
      osc.connect(gain);
      gain.connect(stereoPanner);
      stereoPanner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  public stopBeacon(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const spatialBeacon = new SpatialAudioBeacon();
