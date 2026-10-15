/**
 * Pedometer / step estimator using DeviceMotionEvent.
 * Requires user gesture permission on iOS 13+.
 */
export class StepTracker {
  private stepCount = 0;
  private isTracking = false;
  private lastAccel = 0;
  private threshold = 11.5; // m/s^2 peak threshold for walking
  private listeners: Set<(steps: number) => void> = new Set();

  public async requestPermission(): Promise<boolean> {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceMotionEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        return response === 'granted';
      } catch (err) {
        console.warn('DeviceMotion permission error:', err);
        return false;
      }
    }
    return true;
  }

  public start(): void {
    if (this.isTracking) return;
    this.isTracking = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('devicemotion', this.handleMotion, true);
    }
  }

  public stop(): void {
    this.isTracking = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleMotion, true);
    }
  }

  public reset(): void {
    this.stepCount = 0;
    this.notify();
  }

  public getSteps(): number {
    return this.stepCount;
  }

  public onStep(listener: (steps: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.stepCount));
  }

  private handleMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const delta = magnitude - this.lastAccel;
    this.lastAccel = magnitude;

    if (magnitude > this.threshold && delta > 2.0) {
      this.stepCount++;
      this.notify();
    }
  };
}

export const stepTracker = new StepTracker();
