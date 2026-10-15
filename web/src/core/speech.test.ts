import { describe, it, expect, beforeEach } from 'vitest';
import { speech } from './speech';
import { settings } from './settings';
import { GUIDANCE } from '../config/guidance';

describe('SpeechController - Rate Clamping and Persistence', () => {
  beforeEach(() => {
    speech.normalSpeed();
  });

  it('initializes rate with GUIDANCE.speech.defaultRate (0.85)', () => {
    expect(speech.getRate()).toBe(GUIDANCE.speech.defaultRate);
  });

  it('adjusts rate with slower() and faster() by 0.1', () => {
    const rate1 = speech.slower(); // 0.85 -> 0.75
    expect(rate1).toBeCloseTo(0.75);
    expect(settings.getSettings().speechRate).toBeCloseTo(0.75);

    const rate2 = speech.faster(); // 0.75 -> 0.85
    expect(rate2).toBeCloseTo(0.85);
    expect(settings.getSettings().speechRate).toBeCloseTo(0.85);
  });

  it('clamps rate to minRate (0.6) and maxRate (1.2)', () => {
    // Slower past minRate
    for (let i = 0; i < 10; i++) {
      speech.slower();
    }
    expect(speech.getRate()).toBe(GUIDANCE.speech.minRate);
    expect(settings.getSettings().speechRate).toBe(GUIDANCE.speech.minRate);

    // Faster past maxRate
    for (let i = 0; i < 15; i++) {
      speech.faster();
    }
    expect(speech.getRate()).toBe(GUIDANCE.speech.maxRate);
    expect(settings.getSettings().speechRate).toBe(GUIDANCE.speech.maxRate);
  });

  it('resets to default rate with normalSpeed()', () => {
    speech.slower();
    speech.slower();
    expect(speech.getRate()).toBeCloseTo(0.65);

    speech.normalSpeed();
    expect(speech.getRate()).toBe(GUIDANCE.speech.defaultRate);
    expect(settings.getSettings().speechRate).toBe(GUIDANCE.speech.defaultRate);
  });
});
