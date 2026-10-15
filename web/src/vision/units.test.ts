import { describe, expect, it } from 'vitest';
import { GUIDANCE } from '../config/guidance';
import {
  bucketToMeters,
  calibrateWalkStep,
  deriveFromHeight,
  formatDistance,
  formatDistanceBucketToStrides,
  lateralShiftStrides,
  metersToHandSpans,
  metersToStrides,
} from './units';

describe('Units & Distance Formatting Engine (Phase 3)', () => {
  describe('deriveFromHeight', () => {
    it('sets stride and hand-span from GUIDANCE.units and derives chest phone height ~0.7 * body height', () => {
      const derived170 = deriveFromHeight(1.70);
      expect(derived170.strideMeters).toBe(0.30);
      expect(derived170.handSpanMeters).toBe(0.50);
      expect(derived170.phoneHeightMeters).toBe(1.19); // Math.round(0.7 * 1.70 * 100) / 100

      const derived180 = deriveFromHeight(1.80);
      expect(derived180.phoneHeightMeters).toBe(1.26); // Math.round(0.7 * 1.80 * 100) / 100
    });
  });

  describe('calibrateWalkStep', () => {
    it('calculates average pedometer footstep length from walking distance and step count', () => {
      // 10 meters in 14 steps => ~0.71m
      expect(calibrateWalkStep(10, 14)).toBe(0.71);
      // 6 meters in 10 steps => 0.60m
      expect(calibrateWalkStep(6, 10)).toBe(0.60);
    });

    it('clamps unreasonable footstep lengths to adult human safety limits (0.35m to 1.10m)', () => {
      // Very tiny steps (e.g. 10m in 40 steps = 0.25m) clamped to 0.35m
      expect(calibrateWalkStep(10, 40)).toBe(0.35);
      // Massive leaps (e.g. 10m in 5 steps = 2.0m) clamped to 1.10m
      expect(calibrateWalkStep(10, 5)).toBe(1.10);
    });

    it('falls back safely to current walkStepMeters when step count is zero or negative', () => {
      const current = GUIDANCE.units.walkStepMeters;
      expect(calibrateWalkStep(10, 0)).toBe(current);
      expect(calibrateWalkStep(10, -5)).toBe(current);
    });
  });

  describe('metersToStrides & metersToHandSpans', () => {
    it('converts meters to strides using 0.30m unit', () => {
      expect(metersToStrides(3.0)).toBe(10);
      expect(metersToStrides(1.5)).toBe(5);
    });

    it('converts meters to hand spans using 0.50m unit', () => {
      expect(metersToHandSpans(1.5)).toBe(3);
      expect(metersToHandSpans(0.5)).toBe(1);
    });
  });

  describe('lateralShiftStrides', () => {
    it('computes strides needed to clear an obstacle with safety margin', () => {
      // Object width 0.8m + default margin 0.5m -> 0.4 + 0.5 = 0.9m. Stride 0.3m -> 3 strides
      expect(lateralShiftStrides(0.8)).toBe(3);
      // Object width 1.2m + margin 0.5m -> 0.6 + 0.5 = 1.1m -> ceil(1.1 / 0.3) = 4 strides
      expect(lateralShiftStrides(1.2, 0.5)).toBe(4);
    });
  });

  describe('bucketToMeters', () => {
    it('maps coarse server distance buckets deterministically to meters', () => {
      expect(bucketToMeters('very-close')).toBe(0.8);
      expect(bucketToMeters('close')).toBe(1.5);
      expect(bucketToMeters('near')).toBe(3.0);
      expect(bucketToMeters('far')).toBe(6.0);
    });
  });

  describe('formatDistance', () => {
    it('formats distances below 0.5m as "less than a hand span"', () => {
      expect(formatDistance(0.2)).toBe('less than a hand span');
      expect(formatDistance(0.49)).toBe('less than a hand span');
    });

    it('formats distances from 0.5m to 2.0m as hand spans (rounded to nearest whole unit)', () => {
      // 0.5m / 0.50m = 1 hand span
      expect(formatDistance(0.5)).toBe('about 1 hand span');
      // 1.0m / 0.50m = 2 hand spans
      expect(formatDistance(1.0)).toBe('about 2 hand spans');
      // 1.5m / 0.50m = 3 hand spans
      expect(formatDistance(1.5)).toBe('about 3 hand spans');
      // 2.0m / 0.50m = 4 hand spans
      expect(formatDistance(2.0)).toBe('about 4 hand spans');
    });

    it('formats distances above 2.0m as strides (rounded to nearest whole unit)', () => {
      // 2.5m / 0.30m = 8.33 strides -> 'about 8 strides'
      expect(formatDistance(2.5)).toBe('about 8 strides');
      // 3.0m / 0.30m = 10 strides -> 'about 10 strides'
      expect(formatDistance(3.0)).toBe('about 10 strides');
    });

    it('rounds conservatively downward for hazards so danger sounds closer', () => {
      // 1.4m / 0.50m = 2.8 hand spans.
      // Normal: round to 3
      expect(formatDistance(1.4, { isHazard: false })).toBe('about 3 hand spans');
      // Hazard: floor to 2
      expect(formatDistance(1.4, { isHazard: true })).toBe('about 2 hand spans');

      // 2.6m / 0.30m = 8.67 strides.
      // Normal: round to 9
      expect(formatDistance(2.6, { isHazard: false })).toBe('about 9 strides');
      // Hazard: floor to 8
      expect(formatDistance(2.6, { isHazard: true })).toBe('about 8 strides');
    });

    it('formats distances in metres when unit preference is "metres"', () => {
      expect(formatDistance(0.4, { preference: 'metres' })).toBe('less than a metre');
      expect(formatDistance(1.0, { preference: 'metres' })).toBe('about 1 metre');
      expect(formatDistance(3.2, { preference: 'metres' })).toBe('about 3 metres');
      // Hazard rounds down in metres
      expect(formatDistance(3.8, { preference: 'metres', isHazard: true })).toBe('about 3 metres');
    });
  });

  describe('formatDistanceBucketToStrides', () => {
    it('converts distance buckets to natural human units', () => {
      // very-close (0.8m) -> 0.8/0.50 = 1.6 -> 'about 2 hand spans'
      expect(formatDistanceBucketToStrides('very-close')).toBe('about 2 hand spans');
      // close (1.5m) -> 1.5/0.50 = 3 -> 'about 3 hand spans'
      expect(formatDistanceBucketToStrides('close')).toBe('about 3 hand spans');
      // near (3.0m) -> 3.0/0.30 = 10 -> 'about 10 strides'
      expect(formatDistanceBucketToStrides('near')).toBe('about 10 strides');
      // far (6.0m) -> 6.0/0.30 = 20 -> 'about 20 strides'
      expect(formatDistanceBucketToStrides('far')).toBe('about 20 strides');
    });

    it('converts distance buckets to metre phrases when preference is metres', () => {
      expect(formatDistanceBucketToStrides('very-close', 'metres')).toBe('about 1 metre');
      expect(formatDistanceBucketToStrides('close', 'metres')).toBe('about 2 metres');
      expect(formatDistanceBucketToStrides('near', 'metres')).toBe('about 3 metres');
      expect(formatDistanceBucketToStrides('far', 'metres')).toBe('about 6 metres');
    });
  });
});
