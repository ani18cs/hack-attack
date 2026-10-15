import { describe, expect, it } from 'vitest';
import {
  FOCUS_CONFIG,
  getCorridorCropRect,
  getDetectionZone,
  isRelevanceAllowed,
  mapCroppedBoxToFullFrame,
  normalizeClassLabel,
  WALKING_RELEVANT_CLASSES,
} from './focus';

describe('Focus and Corridor Vision Engine', () => {
  describe('getCorridorCropRect', () => {
    it('computes pixel crop coordinates matching corridor and ignoreTop ratios', () => {
      const videoWidth = 1280;
      const videoHeight = 720;

      const crop = getCorridorCropRect(videoWidth, videoHeight, FOCUS_CONFIG);

      // FOCUS_CONFIG: corridor { xMin: 0.2, xMax: 0.8 }, ignoreTop: 0.25
      expect(crop.sx).toBe(256);
      expect(crop.sy).toBe(180);
      expect(crop.sWidth).toBe(768);
      expect(crop.sHeight).toBe(540);
    });
  });

  describe('mapCroppedBoxToFullFrame', () => {
    it('accurately translates cropped bounding boxes back to full-frame coordinates', () => {
      const videoWidth = 1000;
      const videoHeight = 1000;

      // In the cropped canvas (which starts at x=200, y=250), box is at (50, 100, 200, 300)
      const croppedBox: [number, number, number, number] = [50, 100, 200, 300];
      const fullBox = mapCroppedBoxToFullFrame(croppedBox, videoWidth, videoHeight, FOCUS_CONFIG);

      // fullX = 50 + 1000 * 0.2 = 250
      // fullY = 100 + 1000 * 0.25 = 350
      // width & height in pixel space remain 200, 300
      expect(fullBox).toEqual([250, 350, 200, 300]);
    });
  });

  describe('getDetectionZone', () => {
    it('classifies boxes with center in upper zone as "upper"', () => {
      // centerY = 0.10 + 0.10 / 2 = 0.15 (< 0.25 ignoreTop)
      const zone = getDetectionZone([0.4, 0.1, 0.2, 0.1], FOCUS_CONFIG);
      expect(zone).toBe('upper');
    });

    it('classifies boxes within the horizontal corridor as "path"', () => {
      // centerY = 0.40 + 0.30 / 2 = 0.55 (>= 0.25), centerX = 0.35 + 0.30 / 2 = 0.50 (between 0.2 and 0.8)
      const zone = getDetectionZone([0.35, 0.4, 0.3, 0.3], FOCUS_CONFIG);
      expect(zone).toBe('path');
    });

    it('classifies boxes to the left or right of corridor as "side"', () => {
      // Left side: centerX = 0.05 + 0.10 / 2 = 0.10 (< 0.2)
      const leftZone = getDetectionZone([0.05, 0.4, 0.1, 0.3], FOCUS_CONFIG);
      expect(leftZone).toBe('side');

      // Right side: centerX = 0.85 + 0.10 / 2 = 0.90 (> 0.8)
      const rightZone = getDetectionZone([0.85, 0.4, 0.1, 0.3], FOCUS_CONFIG);
      expect(rightZone).toBe('side');
    });
  });

  describe('Walking-relevant class allowlist and relevance filtering', () => {
    it('contains all required walking-relevant COCO classes', () => {
      const required = [
        'person',
        'chair',
        'couch',
        'bench',
        'dining table',
        'bicycle',
        'motorcycle',
        'car',
        'bus',
        'truck',
        'dog',
        'cat',
        'suitcase',
        'backpack',
        'umbrella',
        'bottle',
        'cup',
        'laptop',
      ];

      for (const cls of required) {
        expect(WALKING_RELEVANT_CLASSES.has(cls)).toBe(true);
      }
    });

    it('allows relevant classes when area ratio meets minAreaRatio gate', () => {
      // Person with 5% area ratio (> 3% minAreaRatio)
      expect(isRelevanceAllowed('person', 0.05, FOCUS_CONFIG)).toBe(true);
      // Chair with 4% area ratio
      expect(isRelevanceAllowed('chair', 0.04, FOCUS_CONFIG)).toBe(true);
    });

    it('rejects relevant classes when smaller than minAreaRatio gate', () => {
      // Person with 1% area ratio (< 3% minAreaRatio)
      expect(isRelevanceAllowed('person', 0.01, FOCUS_CONFIG)).toBe(false);
    });

    it('rejects non-listed classes even if large', () => {
      // Non-walking items like 'tie', 'fork', 'cell phone', 'banana'
      expect(isRelevanceAllowed('banana', 0.1, FOCUS_CONFIG)).toBe(false);
      expect(isRelevanceAllowed('fork', 0.08, FOCUS_CONFIG)).toBe(false);
    });

    it('normalizes labels with underscores or whitespace', () => {
      expect(normalizeClassLabel('dining_table')).toBe('dining table');
      expect(normalizeClassLabel(' Dining Table ')).toBe('dining table');
      expect(isRelevanceAllowed('dining_table', 0.1, FOCUS_CONFIG)).toBe(true);
    });
  });
});
