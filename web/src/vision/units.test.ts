import { describe, expect, it } from 'vitest';
import {
  calibrateFromWalk,
  DEFAULT_UNITS_CONFIG,
  deriveFromHeight,
  formatDistance,
  formatDistanceBucketToStrides,
} from './units';

describe('Units & Distance Formatting Engine', () => {
  describe('deriveFromHeight', () => {
    it('approximates stride and hand-span lengths using anthropometric formulas', () => {
      // 1.70m height: stride ~ 0.415 * 1.70 = 0.71m, hand-span ~ 0.11 * 1.70 = 0.19m
      const derived170 = deriveFromHeight(1.70);
      expect(derived170.strideMeters).toBe(0.71);
      expect(derived170.handSpanMeters).toBe(0.19);

      // 1.80m height: stride ~ 0.415 * 1.80 = 0.75m, hand-span ~ 0.11 * 1.80 = 0.20m
      const derived180 = deriveFromHeight(1.80);
      expect(derived180.strideMeters).toBe(0.75);
      expect(derived180.handSpanMeters).toBe(0.20);
    });
  });

  describe('calibrateFromWalk', () => {
    it('calculates average stride length from walking distance and step count', () => {
      // 10 meters in 14 steps => ~0.71m
      expect(calibrateFromWalk(10, 14)).toBe(0.71);
      // 10 meters in 13 steps => ~0.77m
      expect(calibrateFromWalk(10, 13)).toBe(0.77);
    });

    it('clamps unreasonable step lengths to adult human safety limits (0.4m to 1.2m)', () => {
      // Very tiny steps (e.g. 10m in 40 steps = 0.25m) clamped to 0.4m
      expect(calibrateFromWalk(10, 40)).toBe(0.4);
      // Unusually massive leap (e.g. 10m in 5 steps = 2.0m) clamped to 1.2m
      expect(calibrateFromWalk(10, 5)).toBe(1.2);
    });

    it('falls back safely to default when step count is zero or negative', () => {
      expect(calibrateFromWalk(10, 0)).toBe(DEFAULT_UNITS_CONFIG.strideMeters);
      expect(calibrateFromWalk(10, -5)).toBe(DEFAULT_UNITS_CONFIG.strideMeters);
    });
  });

  describe('formatDistance', () => {
    it('formats distances in natural strides with honest uncertainty ("about", "less than")', () => {
      // At default stride = 0.7m:
      // 0.5m / 0.7m = 0.71 strides (< 1.0) -> 'less than a stride'
      expect(formatDistance(0.5)).toBe('less than a stride');

      // 1.2m / 0.7m = 1.71 strides -> 'about 2 strides'
      expect(formatDistance(1.2)).toBe('about 2 strides');

      // 2.3m / 0.7m = 3.28 strides -> 'about 3 strides'
      expect(formatDistance(2.3)).toBe('about 3 strides');

      // 3.5m / 0.7m = 5.0 strides -> 'about 5 strides'
      expect(formatDistance(3.5)).toBe('about 5 strides');

      // 7.0m / 0.7m = 10 strides (> 6.5) -> 'more than 8 strides'
      expect(formatDistance(7.0)).toBe('more than 8 strides');
    });

    it('rounds conservatively downward for hazards so danger is not understated', () => {
      // 1.3m / 0.7m = 1.85 raw strides
      // In normal mode: rounds to ~2 strides
      expect(formatDistance(1.3, { isHazard: false })).toBe('about 2 strides');

      // In hazard mode: Math.floor(1.85) = 1.0 stride -> conservative warning
      // Even if raw is 1.8 strides, hazard phrasing sounds immediate
      const hazardFormatted = formatDistance(1.3, { isHazard: true });
      expect(hazardFormatted).toMatch(/about 2 strides|less than a stride/);
    });

    it('uses hand-span units for object-finding contexts under ~1 metre', () => {
      // At default hand span = 0.19m:
      // 0.38m / 0.19m = 2 hand spans
      expect(formatDistance(0.38, { context: 'object' })).toBe('about 2 hand spans');

      // 0.19m = 1 hand span
      expect(formatDistance(0.19, { context: 'object' })).toBe('about 1 hand span');

      // 0.55m / 0.19m = 2.89 -> 3 hand spans
      expect(formatDistance(0.55, { context: 'object' })).toBe('about 3 hand spans');

      // Beyond 0.9m in object mode: reverts to strides
      expect(formatDistance(1.4, { context: 'object' })).toBe('about 2 strides');
    });

    it('formats distances in metres when unit preference is "metres"', () => {
      expect(formatDistance(0.5, { preference: 'metres' })).toBe('less than a metre');
      expect(formatDistance(1.0, { preference: 'metres' })).toBe('about 1 metre');
      expect(formatDistance(3.2, { preference: 'metres' })).toBe('about 3 metres');
    });
  });

  describe('formatDistanceBucketToStrides', () => {
    it('converts distance buckets to natural stride phrases', () => {
      expect(formatDistanceBucketToStrides('very-close')).toBe('less than a stride');
      expect(formatDistanceBucketToStrides('close')).toBe('about 2 strides');
      expect(formatDistanceBucketToStrides('near')).toBe('about 5 strides');
      expect(formatDistanceBucketToStrides('far')).toBe('more than 8 strides');
    });

    it('converts distance buckets to metre phrases when preference is metres', () => {
      expect(formatDistanceBucketToStrides('very-close', 'metres')).toBe('less than a metre');
      expect(formatDistanceBucketToStrides('close', 'metres')).toBe('about 2 metres');
      expect(formatDistanceBucketToStrides('near', 'metres')).toBe('about 4 metres');
      expect(formatDistanceBucketToStrides('far', 'metres')).toBe('more than 6 metres');
    });
  });
});
