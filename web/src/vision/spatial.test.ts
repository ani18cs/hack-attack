import { describe, expect, it } from 'vitest';
import {
  calculateDirection,
  calculateDistance,
  isHazardous,
  processSpatialObject,
  RawDetection,
} from './spatial';

describe('Spatial Engine Unit Tests', () => {
  describe('calculateDirection', () => {
    it('returns "left" for coordinates < 0.25', () => {
      expect(calculateDirection(0.1)).toBe('left');
      expect(calculateDirection(0.24)).toBe('left');
    });

    it('returns "slightly-left" for 0.25 to 0.38', () => {
      expect(calculateDirection(0.3)).toBe('slightly-left');
      expect(calculateDirection(0.35)).toBe('slightly-left');
    });

    it('returns "ahead" for central coordinates (0.38 to 0.62)', () => {
      expect(calculateDirection(0.45)).toBe('ahead');
      expect(calculateDirection(0.5)).toBe('ahead');
      expect(calculateDirection(0.6)).toBe('ahead');
    });

    it('returns "slightly-right" for 0.62 to 0.75', () => {
      expect(calculateDirection(0.65)).toBe('slightly-right');
      expect(calculateDirection(0.72)).toBe('slightly-right');
    });

    it('returns "right" for coordinates > 0.75', () => {
      expect(calculateDirection(0.8)).toBe('right');
      expect(calculateDirection(0.95)).toBe('right');
    });
  });

  describe('calculateDistance', () => {
    it('returns "very-close" when area ratio exceeds 0.35', () => {
      expect(calculateDistance(0.4)).toBe('very-close');
      expect(calculateDistance(0.65)).toBe('very-close');
    });

    it('returns "close" when area ratio is between 0.12 and 0.35', () => {
      expect(calculateDistance(0.15)).toBe('close');
      expect(calculateDistance(0.3)).toBe('close');
    });

    it('returns "near" when area ratio is between 0.03 and 0.12', () => {
      expect(calculateDistance(0.04)).toBe('near');
      expect(calculateDistance(0.1)).toBe('near');
    });

    it('returns "far" when area ratio is less than 0.03', () => {
      expect(calculateDistance(0.02)).toBe('far');
      expect(calculateDistance(0.005)).toBe('far');
    });

    it('applies per-class size multiplier for smaller items like bottle/phone', () => {
      // Bottle with raw area 0.05 gets multiplied by 2.5 = 0.125 -> 'close'
      expect(calculateDistance(0.05, 'bottle')).toBe('close');
    });
  });

  describe('isHazardous (Danger Rules)', () => {
    it('flags large objects directly in walking corridor as hazardous', () => {
      expect(isHazardous(0.5, 0.6, 0.28)).toBe(true);
    });

    it('does NOT flag small items in path as immediate danger', () => {
      expect(isHazardous(0.5, 0.6, 0.05)).toBe(false);
    });

    it('does NOT flag large objects outside walking path', () => {
      expect(isHazardous(0.1, 0.6, 0.35)).toBe(false);
      expect(isHazardous(0.5, 0.15, 0.35)).toBe(false);
    });

    it('flags rapidly approaching objects in corridor via growth delta', () => {
      expect(isHazardous(0.5, 0.5, 0.18, 0.10)).toBe(true);
    });
  });

  describe('processSpatialObject', () => {
    it('accurately normalizes pixel coordinates from camera frame', () => {
      const frameWidth = 1000;
      const frameHeight = 1000;

      const detection: RawDetection = {
        label: 'chair',
        score: 0.88,
        bbox: [300, 350, 400, 500],
      };

      const result = processSpatialObject(detection, frameWidth, frameHeight);

      expect(result.label).toBe('chair');
      expect(result.direction).toBe('ahead');
      expect(result.distance).toBe('close');
      expect(result.score).toBe(0.88);
    });
  });
});
