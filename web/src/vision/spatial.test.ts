import { describe, expect, it } from 'vitest';
import {
  calculateDirection,
  calculateDistance,
  calculateFocalPixels,
  estimateDistanceByGroundPlane,
  estimateDistanceBySize,
  isHazardous,
  isSideHazardous,
  mapDistanceToBucket,
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

  describe('calculateDistance (Area-ratio Fallback)', () => {
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

  describe('Size-based distance estimation (Monocular Pinhole)', () => {
    it('accurately computes focal length in pixels from vertical FOV', () => {
      // Frame height 720px, 60 deg vertical FOV:
      // focalPx = (720 / 2) / tan(30 deg) = 360 * sqrt(3) ≈ 623.538px
      const focal = calculateFocalPixels(720, 60);
      expect(focal).toBeCloseTo(623.538, 2);
    });

    it('estimates physical distance using class height priors and box height in pixels', () => {
      const frameHeight = 720;
      // Person height prior = 1.7m.
      // Box height 360px (half screen):
      // distance = (1.7 * 623.538) / 360 ≈ 2.94m
      const personDist = estimateDistanceBySize('person', 360, frameHeight, 60);
      expect(personDist).toBeCloseTo(2.94, 1);

      // Chair height prior = 0.9m.
      // Box height 180px:
      // distance = (0.9 * 623.538) / 180 ≈ 3.12m
      const chairDist = estimateDistanceBySize('chair', 180, frameHeight, 60);
      expect(chairDist).toBeCloseTo(3.12, 1);
    });
  });

  describe('Ground-plane distance estimation (Device Tilt)', () => {
    it('calculates ground distance from camera downward pitch and bottom edge', () => {
      const frameHeight = 720;
      const phoneHeight = 1.2;
      const pitchDeg = 20; // 20 deg downward pitch

      // Bottom edge at bottom of frame (y = 720).
      // deltaY = 720 - 360 = 360.
      // angleFromCenter = atan(360 / (360 * sqrt(3))) = 30 deg.
      // angleBelowHorizon = 20 + 30 = 50 deg.
      // distance = 1.2 / tan(50 deg) ≈ 1.01m
      const dist = estimateDistanceByGroundPlane(720, frameHeight, pitchDeg, phoneHeight, 60);
      expect(dist).not.toBeNull();
      expect(dist!).toBeCloseTo(1.01, 1);
    });

    it('returns null and falls back when tilt angle is implausible', () => {
      const frameHeight = 720;
      // Phone pointing up at ceiling (< 5 deg pitch)
      expect(estimateDistanceByGroundPlane(720, frameHeight, 0)).toBeNull();
      expect(estimateDistanceByGroundPlane(720, frameHeight, -10)).toBeNull();

      // Excessive pitch (> 75 deg)
      expect(estimateDistanceByGroundPlane(720, frameHeight, 85)).toBeNull();

      // Undefined or NaN pitch
      expect(estimateDistanceByGroundPlane(720, frameHeight, undefined)).toBeNull();
      expect(estimateDistanceByGroundPlane(720, frameHeight, Number.NaN)).toBeNull();
    });

    it('returns null when bottom edge is above the horizon ray', () => {
      const frameHeight = 720;
      // Bottom edge high up in frame (y = 50), with shallow pitch 10 deg:
      // deltaY = 50 - 360 = -310. angleFromCenter ≈ -26 deg.
      // angleBelowHorizon = 10 - 26 = -16 deg (above horizon)
      expect(estimateDistanceByGroundPlane(50, frameHeight, 10)).toBeNull();
    });
  });

  describe('isHazardous & Danger Thresholds in Strides', () => {
    it('flags obstacles under 2 strides in path as immediate danger', () => {
      // Centered (x=0.5), path zone (y=0.6), distanceStrides = 1.8 (< 2.2 strides)
      expect(isHazardous(0.5, 0.6, 0.1, undefined, 1.8)).toBe(true);
    });

    it('does not flag obstacles far away in strides as immediate danger', () => {
      // Centered, distanceStrides = 5.0 (> 2.2 strides)
      expect(isHazardous(0.5, 0.6, 0.05, undefined, 5.0)).toBe(false);
    });

    it('flags large objects directly in walking corridor as hazardous', () => {
      expect(isHazardous(0.5, 0.6, 0.28)).toBe(true);
    });

    it('does NOT flag small items in path as immediate danger', () => {
      expect(isHazardous(0.5, 0.6, 0.05)).toBe(false);
    });

    it('does NOT flag large objects outside walking path', () => {
      // Large object at extreme left (x=0.1)
      expect(isHazardous(0.1, 0.6, 0.35)).toBe(false);
      // Large object high in sky/ceiling (y=0.15)
      expect(isHazardous(0.5, 0.15, 0.35)).toBe(false);
    });

    it('flags rapidly approaching objects in corridor via growth delta', () => {
      // Area grew from 0.10 to 0.18 (> 30% growth) in corridor
      expect(isHazardous(0.5, 0.5, 0.18, 0.1)).toBe(true);
    });
  });

  describe('isSideHazardous (Side Zone Policy)', () => {
    it('flags side objects as hazardous ONLY if very close or rapidly growing', () => {
      // Side danger area ratio threshold is 0.2
      expect(isSideHazardous(0.25)).toBe(true);
      expect(isSideHazardous(0.12)).toBe(false);

      // Fast approach from side (> 30% growth)
      expect(isSideHazardous(0.15, 0.09)).toBe(true);
    });
  });

  describe('mapDistanceToBucket', () => {
    it('maps stride distance to coarse buckets', () => {
      // Default stride = 0.7m
      // < 1 stride (< 0.7m) -> very-close
      expect(mapDistanceToBucket(0.5)).toBe('very-close');
      // 1-2 strides (0.7m - 1.6m) -> close
      expect(mapDistanceToBucket(1.2)).toBe('close');
      // 3-5 strides (2.1m - 3.8m) -> near
      expect(mapDistanceToBucket(2.5)).toBe('near');
      // 6+ strides (> 4.2m) -> far
      expect(mapDistanceToBucket(6.0)).toBe('far');
    });
  });

  describe('processSpatialObject', () => {
    it('accurately converts detections to SceneObject with zone, formatted distance, and danger', () => {
      const frameWidth = 1000;
      const frameHeight = 1000;

      // Chair in front: center around (500, 600), size (400x500)
      const detection: RawDetection = {
        label: 'chair',
        score: 0.88,
        bbox: [300, 350, 400, 500],
      };

      const result = processSpatialObject(detection, frameWidth, frameHeight);

      expect(result.label).toBe('chair');
      expect(result.direction).toBe('ahead');
      expect(result.zone).toBe('path');
      expect(result.distance).toBe('close');
      expect(result.formattedDistance).toMatch(/about 3 hand spans|about 2 hand spans/);
      expect(result.score).toBe(0.88);
    });

    it('classifies objects in upper zone as ignored (danger = false)', () => {
      const frameWidth = 1000;
      const frameHeight = 1000;

      // Object at top: y = 50, h = 100 -> centerY = 0.10 (< 0.25 ignoreTop)
      const detection: RawDetection = {
        label: 'person',
        score: 0.9,
        bbox: [400, 50, 200, 100],
      };

      const result = processSpatialObject(detection, frameWidth, frameHeight);
      expect(result.zone).toBe('upper');
      expect(result.danger).toBe(false);
    });

    it('uses ground-plane estimation when plausible tilt is provided', () => {
      const frameWidth = 720;
      const frameHeight = 720;

      const detection: RawDetection = {
        label: 'chair',
        score: 0.9,
        bbox: [200, 300, 200, 420], // bottomEdgeY = 720
      };

      const result = processSpatialObject(detection, frameWidth, frameHeight, {
        pitchBelowHorizonDeg: 20,
        phoneHeightMeters: 1.2,
      });

      // Ground plane distance ≈ 1.01m at pitch 20 deg
      expect(result.distanceMeters).toBeCloseTo(1.01, 1);
      expect(result.danger).toBe(true); // < 2 strides in path
    });
  });
});
