/**
 * Compass orientation helper using DeviceOrientationEvent.
 * Features:
 * - Cross-platform: webkitCompassHeading (iOS) and alpha fallback (Android)
 * - Turn delta calculation with +/- 30 degrees tolerance
 * - Nudge guidance: "A bit more left", "Good, straight ahead"
 * - Reliability detector: detects missing/jittery events and falls back gracefully
 * - Never blocks navigation progress
 */
export class CompassManager {
  private heading: number | null = null;
  private lastEventTime = 0;
  private eventCount = 0;
  private isReliable = false;
  private listeners: Set<(heading: number) => void> = new Set();
  private lastNudgeTime = 0;

  public async requestPermission(): Promise<boolean> {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        return response === 'granted';
      } catch (err) {
        console.warn('DeviceOrientation permission error:', err);
        return false;
      }
    }
    return true;
  }

  public start(onHeading?: (heading: number) => void): void {
    if (onHeading) this.listeners.add(onHeading);
    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', this.handleOrientation, true);
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.handleOrientation, true);
    }
    this.listeners.clear();
  }

  public getHeading(): number | null {
    return this.heading;
  }

  public getIsReliable(): boolean {
    // If we've received at least 5 events and the last was within 2 seconds
    return this.isReliable && Date.now() - this.lastEventTime < 2000;
  }

  public subscribe(listener: (heading: number) => void): () => void {
    this.listeners.add(listener);
    if (this.heading !== null) listener(this.heading);
    return () => this.listeners.delete(listener);
  }

  /**
   * Evaluates a turn against expected headingChange (in degrees, e.g. -90 for left, +90 for right).
   * Tolerance: +/- 30 degrees.
   * Returns:
   * - isComplete: boolean
   * - nudge: string | null (e.g., "A bit more left", "Good, straight ahead")
   */
  public evaluateTurn(
    initialHeading: number,
    currentHeading: number,
    expectedHeadingChange: number
  ): { isComplete: boolean; nudge: string | null; delta: number } {
    // Angular difference normalized between -180 and +180
    let delta = ((currentHeading - initialHeading + 540) % 360) - 180;
    const error = delta - expectedHeadingChange;

    const tolerance = 30; // +/- 30 degrees per spec
    const isComplete = Math.abs(error) <= tolerance;

    const now = Date.now();
    let nudge: string | null = null;

    // Rate-limit nudges to every 2.5s
    if (now - this.lastNudgeTime > 2500 && this.getIsReliable()) {
      this.lastNudgeTime = now;
      if (isComplete) {
        nudge = 'Good, straight ahead.';
      } else if (expectedHeadingChange < 0) {
        // Wanted to turn left
        if (delta > expectedHeadingChange) {
          nudge = 'A bit more left.';
        } else {
          nudge = 'Turn back slightly right.';
        }
      } else {
        // Wanted to turn right
        if (delta < expectedHeadingChange) {
          nudge = 'A bit more right.';
        } else {
          nudge = 'Turn back slightly left.';
        }
      }
    }

    return { isComplete, nudge, delta };
  }

  private handleOrientation = (e: DeviceOrientationEvent) => {
    // iOS Safari exposes webkitCompassHeading (0 = Magnetic North, clockwise)
    // Android Chrome exposes alpha (0-360 counter-clockwise)
    let heading: number | null = null;
    if (typeof (e as any).webkitCompassHeading === 'number') {
      heading = (e as any).webkitCompassHeading;
    } else if (typeof e.alpha === 'number') {
      heading = (360 - e.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
      this.heading = Math.round(heading);
      this.lastEventTime = Date.now();
      this.eventCount++;
      if (this.eventCount >= 5) {
        this.isReliable = true;
      }
      this.listeners.forEach((fn) => fn(this.heading!));
    }
  };
}

export const compass = new CompassManager();
