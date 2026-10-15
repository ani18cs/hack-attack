export interface GestureCallbacks {
  onSingleTap: () => void;
  onDoubleTap: () => void;
  onTripleTap: () => void;
  onLongPress: () => void;
}

export interface GestureHandlerOptions {
  tapWindowMs?: number; // 350ms default
  longPressMs?: number; // 800ms default
}

export class GestureHandler {
  private tapCount = 0;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered = false;
  private callbacks: GestureCallbacks;
  private tapWindowMs: number;
  private longPressMs: number;

  constructor(callbacks: GestureCallbacks, options: GestureHandlerOptions = {}) {
    this.callbacks = callbacks;
    this.tapWindowMs = options.tapWindowMs ?? 350;
    this.longPressMs = options.longPressMs ?? 800;
  }

  public onPointerDown(): void {
    this.longPressTriggered = false;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      if (this.tapTimer) {
        clearTimeout(this.tapTimer);
        this.tapTimer = null;
      }
      this.tapCount = 0;
      this.callbacks.onLongPress();
    }, this.longPressMs);
  }

  public onPointerUp(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      return;
    }

    this.registerTap();
  }

  public onPointerCancel(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressTriggered = false;
  }

  /**
   * Registers a discrete tap (e.g. from pointerup or click / TalkBack double-tap activation)
   */
  public registerTap(): void {
    this.tapCount += 1;

    if (this.tapCount >= 3) {
      if (this.tapTimer) {
        clearTimeout(this.tapTimer);
        this.tapTimer = null;
      }
      this.tapCount = 0;
      this.callbacks.onTripleTap();
      return;
    }

    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
    }

    this.tapTimer = setTimeout(() => {
      const current = this.tapCount;
      this.tapCount = 0;
      this.tapTimer = null;

      if (current === 1) {
        this.callbacks.onSingleTap();
      } else if (current === 2) {
        this.callbacks.onDoubleTap();
      }
    }, this.tapWindowMs);
  }

  public reset(): void {
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.tapCount = 0;
    this.longPressTriggered = false;
  }
}
