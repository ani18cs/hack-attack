import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speech } from '../core/speech';
import { askContext } from './context';
import { ToolRuntime } from './toolRuntime';

describe('ToolRuntime', () => {
  let runtime: ToolRuntime;

  beforeEach(() => {
    vi.restoreAllMocks();
    askContext.clear();
    runtime = new ToolRuntime();
    vi.spyOn(speech, 'speak').mockImplementation(() => {});
  });

  afterEach(() => {
    runtime.stopActiveLongRunning(false);
    vi.restoreAllMocks();
  });

  it('enforces single long-running tool rule and announces stopping previous', async () => {
    // Start first long-running tool: scan_hazards
    await runtime.execute({
      tool: 'scan_hazards',
      args: { enabled: true },
      confidence: 1.0,
      source: 'local',
    });

    expect(runtime.getActiveTool()).toBe('scan_hazards');
    expect(speech.speak).toHaveBeenCalledWith(
      expect.stringContaining('Hazard scan is a helper'),
      expect.anything()
    );

    // Starting a new long-running tool (find_target) must stop the previous and announce it
    await runtime.execute({
      tool: 'find_target',
      args: { target: 'chair' },
      confidence: 1.0,
      source: 'local',
    });

    expect(speech.speak).toHaveBeenCalledWith(
      'Stopping scan hazards.',
      expect.objectContaining({ priority: 'normal' })
    );
    expect(runtime.getActiveTool()).toBe('find_target');
  });

  it('allows one-shot tools to run and finish without stopping long-running tool', async () => {
    await runtime.execute({
      tool: 'find_target',
      args: { target: 'door' },
      confidence: 1.0,
      source: 'local',
    });

    expect(runtime.getActiveTool()).toBe('find_target');

    // Run repeat_last one-shot
    askContext.setLastAnswer('Front entrance clear.');
    await runtime.execute({
      tool: 'repeat_last',
      args: {},
      confidence: 1.0,
      source: 'local',
    });

    expect(speech.speak).toHaveBeenCalledWith('Front entrance clear.', expect.anything());
    // Active long-running tool is still find_target
    expect(runtime.getActiveTool()).toBe('find_target');
  });

  it('handles stop_current to stop active long running tool', async () => {
    await runtime.execute({
      tool: 'find_target',
      args: { target: 'exit' },
      confidence: 1.0,
      source: 'local',
    });

    expect(runtime.getActiveTool()).toBe('find_target');

    runtime.handleStopCurrent();
    expect(runtime.getActiveTool()).toBeNull();
    expect(speech.speak).toHaveBeenCalledWith(
      'Stopping find target.',
      expect.objectContaining({ priority: 'normal' })
    );
  });

  it('handles SOS confirmation flow deterministically without premature dispatch', () => {
    runtime.startSosConfirmation();
    expect(runtime.isSosPending()).toBe(true);
    expect(speech.speak).toHaveBeenCalledWith(
      'Send emergency message? Say yes or tap twice.',
      expect.objectContaining({ priority: 'danger' })
    );

    runtime.cancelSos();
    expect(runtime.isSosPending()).toBe(false);
    expect(speech.speak).toHaveBeenCalledWith(
      'Emergency cancelled.',
      expect.objectContaining({ priority: 'normal' })
    );
  });

  it('updates verbosity setting on set_verbosity', async () => {
    await runtime.execute({
      tool: 'set_verbosity',
      args: { level: 'quiet' },
      confidence: 1.0,
      source: 'local',
    });

    expect(speech.speak).toHaveBeenCalledWith(
      'Quiet mode enabled. Hazards only.',
      expect.anything()
    );
  });
});
