/**
 * Compass orientation helper using DeviceOrientationEvent.
 * Requires user gesture permission on iOS 13+.
 */
export class CompassManager {
  private heading: number | null = null;
  private listener: ((heading: number) => void) | null = null;

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
    return true; // Already allowed on Android / standard browsers
  }

  public start(onHeading: (heading: number) => void): void {
    this.listener = onHeading;
    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', this.handleOrientation, true);
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.handleOrientation, true);
    }
    this.listener = null;
  }

  public getHeading(): number | null {
    return this.heading;
  }

  private handleOrientation = (e: DeviceOrientationEvent) => {
    // webkitCompassHeading for iOS, alpha for standard Android
    const heading = (e as any).webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : null);
    if (heading !== null) {
      this.heading = heading;
      if (this.listener) this.listener(heading);
    }
  };
}

export const compass = new CompassManager();
