/**
 * Pedometer / step estimator using DeviceMotionEvent.
 * Features:
 * - Low-pass gravity smoothing + high-pass dynamic acceleration filter
 * - Minimum peak interval of 250 ms (human gait limit)
 * - Calibration multiplier for user gait length
 * - Standardized "about N steps" phrasing helper
 */
export class StepTracker {
  private stepCount = 0;
  private isTracking = false;
  private lastStepTime = 0;
  private filteredAccel = 9.81;
  private alpha = 0.2; // Low-pass filter coefficient
  private minStepIntervalMs = 250; // Minimum 250 ms between steps
  private peakThreshold = 1.35; // Acceleration deviation threshold (m/s^2 above smoothed baseline)
  private calibrationFactor = 1.0;
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

  public addManualStep(): void {
    this.stepCount++;
    this.notify();
  }

  public getSteps(): number {
    return Math.round(this.stepCount * this.calibrationFactor);
  }

  public calibrate(actualStepsCounted: number, countedByDevice: number): void {
    if (countedByDevice > 0 && actualStepsCounted > 0) {
      this.calibrationFactor = actualStepsCounted / countedByDevice;
    }
  }

  public onStep(listener: (steps: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public static formatSteps(n: number): string {
    const rounded = Math.round(n);
    if (rounded <= 1) return 'about 1 step';
    return `about ${rounded} steps`;
  }

  private notify() {
    const effectiveSteps = this.getSteps();
    this.listeners.forEach((fn) => fn(effectiveSteps));
  }

  private handleMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const rawMagnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

    // Apply low-pass filter to isolate continuous gravity vector
    this.filteredAccel = this.alpha * rawMagnitude + (1 - this.alpha) * this.filteredAccel;
    const dynamicMagnitude = Math.abs(rawMagnitude - this.filteredAccel);

    const now = Date.now();
    if (
      dynamicMagnitude > this.peakThreshold &&
      now - this.lastStepTime >= this.minStepIntervalMs
    ) {
      this.lastStepTime = now;
      this.stepCount++;
      this.notify();
    }
  };
}

export const stepTracker = new StepTracker();
