import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GestureHandler } from './gestureHandler';

describe('GestureHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers single tap after 350ms window expires', () => {
    const single = vi.fn();
    const double = vi.fn();
    const triple = vi.fn();
    const longPress = vi.fn();

    const handler = new GestureHandler({
      onSingleTap: single,
      onDoubleTap: double,
      onTripleTap: triple,
      onLongPress: longPress,
    });

    handler.registerTap();
    expect(single).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);
    expect(single).toHaveBeenCalledTimes(1);
    expect(double).not.toHaveBeenCalled();
    expect(triple).not.toHaveBeenCalled();
    expect(longPress).not.toHaveBeenCalled();
  });

  it('triggers double tap when 2 taps occur within 350ms', () => {
    const single = vi.fn();
    const double = vi.fn();
    const triple = vi.fn();
    const longPress = vi.fn();

    const handler = new GestureHandler({
      onSingleTap: single,
      onDoubleTap: double,
      onTripleTap: triple,
      onLongPress: longPress,
    });

    handler.registerTap();
    vi.advanceTimersByTime(150);
    handler.registerTap();

    expect(double).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);
    expect(double).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
    expect(triple).not.toHaveBeenCalled();
  });

  it('triggers triple tap immediately on the 3rd tap without waiting 350ms', () => {
    const single = vi.fn();
    const double = vi.fn();
    const triple = vi.fn();
    const longPress = vi.fn();

    const handler = new GestureHandler({
      onSingleTap: single,
      onDoubleTap: double,
      onTripleTap: triple,
      onLongPress: longPress,
    });

    handler.registerTap();
    vi.advanceTimersByTime(100);
    handler.registerTap();
    vi.advanceTimersByTime(100);
    handler.registerTap();

    expect(triple).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
    expect(double).not.toHaveBeenCalled();

    // Advance further to ensure no double/single triggers leak
    vi.advanceTimersByTime(500);
    expect(single).not.toHaveBeenCalled();
    expect(double).not.toHaveBeenCalled();
  });

  it('triggers long press when held for 800ms and suppresses tap', () => {
    const single = vi.fn();
    const double = vi.fn();
    const triple = vi.fn();
    const longPress = vi.fn();

    const handler = new GestureHandler({
      onSingleTap: single,
      onDoubleTap: double,
      onTripleTap: triple,
      onLongPress: longPress,
    });

    handler.onPointerDown();
    expect(longPress).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(longPress).toHaveBeenCalledTimes(1);

    // Pointer up after long press should not register a tap
    handler.onPointerUp();
    vi.advanceTimersByTime(500);
    expect(single).not.toHaveBeenCalled();
  });

  it('releases pointer before 800ms to register normal tap', () => {
    const single = vi.fn();
    const double = vi.fn();
    const triple = vi.fn();
    const longPress = vi.fn();

    const handler = new GestureHandler({
      onSingleTap: single,
      onDoubleTap: double,
      onTripleTap: triple,
      onLongPress: longPress,
    });

    handler.onPointerDown();
    vi.advanceTimersByTime(200);
    handler.onPointerUp();

    expect(longPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(single).toHaveBeenCalledTimes(1);
  });
});
