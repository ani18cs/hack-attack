import { describe, expect, it } from 'vitest';
import type { VisionTask } from '../types.js';
import { MOCK_FIXTURES } from '../mock/fixtures.js';
import { TASK_REGISTRY } from './registry.js';

describe('Server Task Registry', () => {
  const allTasks: VisionTask[] = [
    'describe',
    'read',
    'find',
    'currency',
    'waste',
    'label',
    'hazard',
    'verify_landmark',
    'sos_context',
  ];

  it('registers all 9 vision tasks', () => {
    for (const task of allTasks) {
      expect(TASK_REGISTRY[task], `Missing preset for ${task}`).toBeDefined();
      expect(TASK_REGISTRY[task].task).toBe(task);
    }
  });

  it('marks Part 1 core tasks as implemented, and Part 2 as scaffolded', () => {
    expect(TASK_REGISTRY.describe.implemented).toBe(true);
    expect(TASK_REGISTRY.read.implemented).toBe(true);
    expect(TASK_REGISTRY.find.implemented).toBe(true);

    expect(TASK_REGISTRY.currency.implemented).toBe(false);
    expect(TASK_REGISTRY.waste.implemented).toBe(false);
    expect(TASK_REGISTRY.label.implemented).toBe(false);
    expect(TASK_REGISTRY.hazard.implemented).toBe(false);
    expect(TASK_REGISTRY.verify_landmark.implemented).toBe(false);
    expect(TASK_REGISTRY.sos_context.implemented).toBe(false);
  });

  it('validates describe mock fixture against describeSchema', () => {
    const fixture = MOCK_FIXTURES.describe;
    const result = TASK_REGISTRY.describe.schema.safeParse(fixture.data);
    expect(result.success).toBe(true);

    const summary = TASK_REGISTRY.describe.toSummary(fixture.data);
    expect(typeof summary).toBe('string');
    expect(summary.split(' ').length).toBeLessThanOrEqual(25);
  });

  it('validates read mock fixture and fuses arrows', () => {
    const fixture = MOCK_FIXTURES.read;
    const result = TASK_REGISTRY.read.schema.safeParse(fixture.data);
    expect(result.success).toBe(true);

    const summary = TASK_REGISTRY.read.toSummary(fixture.data);
    expect(summary).toContain('arrow points right');
    expect(summary.split(' ').length).toBeLessThanOrEqual(25);
  });

  it('validates find mock fixture with spatial cue and distance', () => {
    const fixture = MOCK_FIXTURES.find;
    const result = TASK_REGISTRY.find.schema.safeParse(fixture.data);
    expect(result.success).toBe(true);

    const summary = TASK_REGISTRY.find.toSummary(fixture.data, {
      task: 'find',
      image: '',
      target: 'restroom',
    });
    expect(typeof summary).toBe('string');
    expect(summary.split(' ').length).toBeLessThanOrEqual(25);
  });

  it('validates currency, waste, and label mock fixtures against their schemas', () => {
    expect(TASK_REGISTRY.currency.schema.safeParse(MOCK_FIXTURES.currency.data).success).toBe(true);
    expect(TASK_REGISTRY.waste.schema.safeParse(MOCK_FIXTURES.waste.data).success).toBe(true);
    expect(TASK_REGISTRY.label.schema.safeParse(MOCK_FIXTURES.label.data).success).toBe(true);
    expect(TASK_REGISTRY.hazard.schema.safeParse(MOCK_FIXTURES.hazard.data).success).toBe(true);
    expect(TASK_REGISTRY.verify_landmark.schema.safeParse(MOCK_FIXTURES.verify_landmark.data).success).toBe(true);
    expect(TASK_REGISTRY.sos_context.schema.safeParse(MOCK_FIXTURES.sos_context.data).success).toBe(true);
  });

  it('builds prompts with requested target and languages', () => {
    const findPrompt = TASK_REGISTRY.find.buildPrompt({
      task: 'find',
      image: '',
      target: 'emergency exit',
      lang: 'hi',
    });
    expect(findPrompt).toContain('emergency exit');
    expect(findPrompt).toContain('hi');

    const readPrompt = TASK_REGISTRY.read.buildPrompt({
      task: 'read',
      image: '',
      lang: 'kn',
    });
    expect(readPrompt).toContain('kn');
  });
});
