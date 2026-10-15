import { beforeEach, describe, expect, it } from 'vitest';
import { askLog } from './askLog';

describe('AskLog Manager', () => {
  beforeEach(() => {
    askLog.clear();
  });

  it('keeps strictly at most 5 entries in memory', () => {
    for (let i = 1; i <= 7; i++) {
      askLog.add({
        transcript: `query ${i}`,
        tool: 'describe_scene',
        source: 'local',
        confidence: 0.95,
      });
    }

    const logs = askLog.getLogs();
    expect(logs).toHaveLength(5);
    // Newest is first
    expect(logs[0].transcript).toBe('query 7');
    expect(logs[4].transcript).toBe('query 3');
  });

  it('notifies subscribers when new entries are recorded', () => {
    let captured: any[] = [];
    const unsub = askLog.subscribe((updated) => {
      captured = updated;
    });

    askLog.add({
      transcript: 'where is washroom',
      tool: 'find_target',
      source: 'local',
      confidence: 1.0,
      latencyMs: 0,
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].tool).toBe('find_target');
    expect(captured[0].latencyMs).toBe(0);

    unsub();
  });
});
