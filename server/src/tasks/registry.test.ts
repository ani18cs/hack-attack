import { describe, expect, it } from 'vitest';
import type { VisionTask } from '../types.js';
import { MOCK_FIXTURES } from '../mock/fixtures.js';
import { TASK_REGISTRY } from './registry.js';
import { toCurrencySummary } from './currency.js';
import { toWasteSummary } from './waste.js';
import { toLabelSummary } from './label.js';
import { toHazardSummary } from './hazard.js';

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

  it('marks all tasks as fully implemented presets for Part 2', () => {
    for (const task of allTasks) {
      expect(TASK_REGISTRY[task].implemented, `Task ${task} should be implemented`).toBe(true);
    }
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

  it('handles currency denomination and honest refusal to guess', () => {
    const valid500 = toCurrencySummary({ denomination: 500, confidence: 0.95 });
    expect(valid500).toBe('Five hundred rupee note.');

    const unclear = toCurrencySummary({ denomination: null, confidence: 0.2 });
    expect(unclear).toBe("I can't tell, hold the note flat and closer.");
  });

  it('handles waste categories and unknown bin label fallback', () => {
    const bottle = toWasteSummary({
      item: 'Plastic water bottle',
      category: 'recyclable',
      confidence: 0.9,
    });
    expect(bottle).toContain('Plastic water bottle');
    expect(bottle.toLowerCase()).toContain('blue bin');

    const unknownWaste = toWasteSummary({
      item: 'Mystery wrapper',
      category: 'unknown',
      confidence: 0.3,
    });
    expect(unknownWaste).toBe("I'm not sure. Please check the bin label.");
  });

  it('handles label reading, allergen prioritization, and medicine verification warning', () => {
    // 1. Food label with allergens
    const food = toLabelSummary({
      product: 'Oat Cookies',
      isMedicine: false,
      allergens: ['Peanuts', 'Gluten'],
      expiry: '2026-12-31',
      legible: true,
      confidence: 0.9,
    });
    expect(food).toContain('Allergens: Peanuts, Gluten.');
    expect(food).toContain('Oat Cookies');
    expect(food).toContain('Expires 2026-12-31.');

    // 2. Medicine label
    const med = toLabelSummary({
      product: 'Paracetamol 500mg',
      isMedicine: true,
      allergens: [],
      expiry: '2027-05-15',
      legible: true,
      confidence: 0.95,
    });
    expect(med).toContain('Please verify medicine details with a person.');

    // 3. Illegible label
    const illegible = toLabelSummary({
      product: 'Unknown',
      isMedicine: false,
      allergens: [],
      legible: false,
      confidence: 0.2,
    });
    expect(illegible).toBe("I can't read that clearly. Please ask someone to check, especially the expiry date.");
  });

  it('handles hazard scan and speaks only high urgency hazards', () => {
    const hazardsWithHigh = toHazardSummary({
      hazards: [
        { type: 'Downward stairs', direction: 'ahead', urgency: 'high' },
        { type: 'Wet floor sign', direction: 'slightly-right', urgency: 'medium' },
      ],
      confidence: 0.9,
    });
    expect(hazardsWithHigh).toBe('Caution: Downward stairs ahead.');

    const mediumOnly = toHazardSummary({
      hazards: [
        { type: 'Bicycle on curb', direction: 'right', urgency: 'medium' },
      ],
      confidence: 0.8,
    });
    expect(mediumOnly).toBe('Path ahead appears clear of major hazards.');
  });
});
