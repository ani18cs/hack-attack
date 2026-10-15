import { beforeEach, describe, expect, it, vi } from 'vitest';
import { speech } from '../core/speech';
import { detector } from '../vision/detector';
import { toolRuntime } from './toolRuntime';

describe('Layer 1 Safety Guarantees', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(speech, 'speak').mockImplementation(() => {});
  });

  it('ensures starting and stopping tools never calls detector.stopDetection or halts Layer 1', async () => {
    const stopSpy = vi.spyOn(detector, 'stopDetection');

    // 1. Start long-running tool
    await toolRuntime.execute({
      tool: 'find_target',
      args: { target: 'washroom' },
      confidence: 1.0,
      source: 'local',
    });

    expect(stopSpy).not.toHaveBeenCalled();

    // 2. Start another long-running tool (replacing the previous)
    await toolRuntime.execute({
      tool: 'scan_hazards',
      args: { enabled: true },
      confidence: 1.0,
      source: 'local',
    });

    expect(stopSpy).not.toHaveBeenCalled();

    // 3. Stop active tool
    toolRuntime.handleStopCurrent();
    expect(stopSpy).not.toHaveBeenCalled();

    // 4. Run one-shot tools
    await toolRuntime.execute({
      tool: 'repeat_last',
      args: {},
      confidence: 1.0,
      source: 'local',
    });

    expect(stopSpy).not.toHaveBeenCalled();

    // 5. Trigger SOS confirmation and cancel
    toolRuntime.startSosConfirmation();
    toolRuntime.cancelSos();

    expect(stopSpy).not.toHaveBeenCalled();
  });
});
