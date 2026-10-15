import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FindCallbacks, FindStateMachine } from './findStateMachine';

describe('FindStateMachine', () => {
  let callbacks: FindCallbacks;
  let fsm: FindStateMachine;

  beforeEach(() => {
    callbacks = {
      onStateChange: vi.fn(),
      onSpeak: vi.fn(),
      onBeaconStart: vi.fn(),
      onBeaconStop: vi.fn(),
      onEarcon: vi.fn(),
      onHaptic: vi.fn(),
    };
    fsm = new FindStateMachine('washroom', callbacks, 20000);
  });

  it('initializes in IDLE state', () => {
    expect(fsm.state).toBe('IDLE');
    expect(fsm.target).toBe('washroom');
    expect(fsm.isCocoTarget()).toBe(false);
  });

  it('correctly identifies COCO target classes for offline local detection', () => {
    const chairFsm = new FindStateMachine('chair', callbacks);
    expect(chairFsm.isCocoTarget()).toBe(true);

    const bottleFsm = new FindStateMachine('bottle', callbacks);
    expect(bottleFsm.isCocoTarget()).toBe(true);
  });

  it('starts scanning and announces initial cue', () => {
    fsm.start(1000);
    expect(fsm.state).toBe('SCANNING');
    expect(callbacks.onStateChange).toHaveBeenCalledWith('SCANNING');
    expect(callbacks.onSpeak).toHaveBeenCalledWith('Scanning for washroom. Turn slowly.', 'normal');
  });

  it('handles confident detection (>=0.6) by transitioning to FOUND, triggering earcon/haptic, starting beacon and entering GUIDING', () => {
    fsm.start(1000);

    fsm.handleResult({
      found: true,
      direction: 'slightly-left',
      distance: 'close',
      confidence: 0.85,
      cue: 'Restroom sign on your left.',
    });

    expect(callbacks.onEarcon).toHaveBeenCalledWith('found');
    expect(callbacks.onHaptic).toHaveBeenCalledWith('found');
    expect(callbacks.onSpeak).toHaveBeenCalledWith('Restroom sign on your left.', 'normal');
    expect(callbacks.onBeaconStart).toHaveBeenCalledWith('slightly-left', 'close');
    expect(fsm.state).toBe('GUIDING');
  });

  it('handles low confidence (0.35 to < 0.6) with cautious phrasing and stays in SCANNING', () => {
    fsm.start(1000);

    fsm.handleResult({
      found: true,
      direction: 'ahead',
      distance: 'far',
      confidence: 0.45,
    });

    expect(fsm.state).toBe('SCANNING');
    expect(callbacks.onSpeak).toHaveBeenCalledWith(
      "I think that is a washroom sign, but I'm not fully sure. Keep scanning.",
      'normal'
    );
    expect(callbacks.onBeaconStart).not.toHaveBeenCalled();
  });

  it('updates spoken direction in GUIDING only on meaningful change', () => {
    fsm.start(1000);
    fsm.handleResult({
      found: true,
      direction: 'ahead',
      distance: 'close',
      confidence: 0.9,
    });
    expect(fsm.state).toBe('GUIDING');

    // Same direction and distance: should not spam speak
    vi.clearAllMocks();
    fsm.handleResult({
      found: true,
      direction: 'ahead',
      distance: 'close',
      confidence: 0.9,
    });
    expect(callbacks.onSpeak).not.toHaveBeenCalled();

    // Changed direction: announces update
    fsm.handleResult({
      found: true,
      direction: 'left',
      distance: 'close',
      confidence: 0.9,
    });
    expect(callbacks.onSpeak).toHaveBeenCalledWith('Now left, close.', 'normal');
  });

  it('reaches ARRIVED after 2 consecutive very-close checks and stops beacon', () => {
    fsm.start(1000);
    fsm.handleResult({
      found: true,
      direction: 'ahead',
      distance: 'very-close',
      confidence: 0.9,
    });
    expect(fsm.state).toBe('GUIDING');

    // Second consecutive very-close check
    fsm.handleResult({
      found: true,
      direction: 'ahead',
      distance: 'very-close',
      confidence: 0.92,
    });

    expect(fsm.state).toBe('ARRIVED');
    expect(callbacks.onBeaconStop).toHaveBeenCalled();
    expect(callbacks.onEarcon).toHaveBeenCalledWith('success');
    expect(callbacks.onSpeak).toHaveBeenCalledWith('You have arrived.', 'normal');
  });

  it('times out after 20 seconds of scanning and transitions to NOT_FOUND', () => {
    fsm.start(1000);
    expect(fsm.state).toBe('SCANNING');

    // 15 seconds passed: still scanning
    fsm.tick(16000);
    expect(fsm.state).toBe('SCANNING');

    // 21 seconds passed: timeout
    fsm.tick(22000);
    expect(fsm.state).toBe('NOT_FOUND');
    expect(callbacks.onBeaconStop).toHaveBeenCalled();
    expect(callbacks.onSpeak).toHaveBeenCalledWith(
      'Not found yet. Turn more or move forward and ask again.',
      'normal'
    );
  });

  it('enforces one in-flight rule', () => {
    fsm.start(1000);
    expect(fsm.isInFlight()).toBe(false);

    fsm.setInFlight(true);
    expect(fsm.isInFlight()).toBe(true);

    fsm.handleResult({
      found: true,
      direction: 'ahead',
      distance: 'close',
      confidence: 0.8,
    });
    expect(fsm.isInFlight()).toBe(false);
  });
});
