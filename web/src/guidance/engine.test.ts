import { describe, it, expect, beforeEach } from 'vitest';
import { GuidanceEngine, type GuidanceInputItem } from './engine';

describe('GuidanceEngine', () => {
  let engine: GuidanceEngine;

  beforeEach(() => {
    engine = new GuidanceEngine();
  });

  it('starts in CLEAR state', () => {
    expect(engine.getState()).toBe('CLEAR');
  });

  describe('Conservative distance calculation', () => {
    it('scales raw distance by conservativeFactor (0.75) for decisions', () => {
      // 1.5m raw * 0.75 = 1.125m <= stopM (1.2m)
      const stopItem: GuidanceInputItem = {
        label: 'chair',
        distanceM: 1.5,
        direction: 'ahead',
        zone: 'path',
      };
      // Frame 1
      engine.processFrame({ items: [stopItem] });
      // Frame 2
      const output = engine.processFrame({ items: [stopItem] });
      expect(output.state).toBe('STOP');
      expect(output.nearestBlocker?.effectiveDistanceM).toBeCloseTo(1.125);
    });

    it('triggers CAUTION when scaled distance is between stopM (1.2m) and cautionM (2.5m)', () => {
      // 2.8m raw * 0.75 = 2.1m -> CAUTION
      const cautionItem: GuidanceInputItem = {
        label: 'person',
        distanceM: 2.8,
        direction: 'ahead',
        zone: 'path',
      };
      engine.processFrame({ items: [cautionItem] });
      const output = engine.processFrame({ items: [cautionItem] });
      expect(output.state).toBe('CAUTION');
    });
  });

  describe('Hysteresis - STOP and CLEAR', () => {
    it('enters STOP only after 2 consecutive STOP frames (prevents single-frame flicker)', () => {
      const stopItem: GuidanceInputItem = {
        label: 'box',
        distanceM: 1.0,
        direction: 'ahead',
        zone: 'path',
      };

      // Frame 1: raw candidate STOP, but state stays CLEAR
      const out1 = engine.processFrame({ items: [stopItem] });
      expect(out1.rawCandidateState).toBe('STOP');
      expect(out1.state).toBe('CLEAR');
      expect(out1.stateChanged).toBe(false);

      // Frame 2: 2nd consecutive STOP frame -> state becomes STOP
      const out2 = engine.processFrame({ items: [stopItem] });
      expect(out2.state).toBe('STOP');
      expect(out2.stateChanged).toBe(true);
    });

    it('exits STOP only after 4 consecutive CLEAR frames', () => {
      const stopItem: GuidanceInputItem = {
        label: 'box',
        distanceM: 1.0,
        direction: 'ahead',
        zone: 'path',
      };

      // Transition to STOP
      engine.processFrame({ items: [stopItem] });
      engine.processFrame({ items: [stopItem] });
      expect(engine.getState()).toBe('STOP');

      // Frame 1 of CLEAR: should stay in STOP
      const f1 = engine.processFrame({ items: [] });
      expect(f1.state).toBe('STOP');

      // Frame 2 of CLEAR: should stay in STOP
      const f2 = engine.processFrame({ items: [] });
      expect(f2.state).toBe('STOP');

      // Frame 3 of CLEAR: should stay in STOP
      const f3 = engine.processFrame({ items: [] });
      expect(f3.state).toBe('STOP');

      // Frame 4 of CLEAR: reached exitStopFrames (4) -> transitions to CLEAR
      const f4 = engine.processFrame({ items: [] });
      expect(f4.state).toBe('CLEAR');
      expect(f4.stateChanged).toBe(true);
    });
  });

  describe('Hysteresis - CAUTION', () => {
    it('enters CAUTION after 2 consecutive frames and exits after 4 clear frames', () => {
      const cautionItem: GuidanceInputItem = {
        label: 'chair',
        distanceM: 2.2,
        direction: 'ahead',
        zone: 'path',
      };

      // Frame 1
      const f1 = engine.processFrame({ items: [cautionItem] });
      expect(f1.state).toBe('CLEAR');

      // Frame 2
      const f2 = engine.processFrame({ items: [cautionItem] });
      expect(f2.state).toBe('CAUTION');

      // Clear frame 1-3: still CAUTION
      engine.processFrame({ items: [] });
      engine.processFrame({ items: [] });
      engine.processFrame({ items: [] });
      expect(engine.getState()).toBe('CAUTION');

      // Clear frame 4: transitions to CLEAR
      const f6 = engine.processFrame({ items: [] });
      expect(f6.state).toBe('CLEAR');
    });

    it('transitions from STOP to CAUTION if obstacle steps back to caution range for 4 frames', () => {
      const stopItem: GuidanceInputItem = { label: 'table', distanceM: 1.0, direction: 'ahead', zone: 'path' };
      const cautionItem: GuidanceInputItem = { label: 'table', distanceM: 2.2, direction: 'ahead', zone: 'path' };

      // Enter STOP
      engine.processFrame({ items: [stopItem] });
      engine.processFrame({ items: [stopItem] });
      expect(engine.getState()).toBe('STOP');

      // 4 frames of CAUTION
      engine.processFrame({ items: [cautionItem] });
      engine.processFrame({ items: [cautionItem] });
      engine.processFrame({ items: [cautionItem] });
      const f4 = engine.processFrame({ items: [cautionItem] });
      expect(f4.state).toBe('CAUTION');
    });
  });

  describe('Side-zone policy', () => {
    it('triggers CAUTION with direction for close side objects, not STOP', () => {
      const sideItem: GuidanceInputItem = {
        label: 'pillar',
        distanceM: 2.0,
        direction: 'left',
        zone: 'side',
        danger: true,
      };

      engine.processFrame({ items: [sideItem] });
      const out = engine.processFrame({ items: [sideItem] });
      expect(out.state).toBe('CAUTION');
      expect(out.nearestBlocker?.direction).toBe('left');
    });

    it('triggers STOP for side objects if within stopM (<= 1.2m effective)', () => {
      const veryCloseSide: GuidanceInputItem = {
        label: 'wall',
        distanceM: 1.0, // effective: 0.75m <= 1.2m
        direction: 'left',
        zone: 'side',
      };

      engine.processFrame({ items: [veryCloseSide] });
      const out = engine.processFrame({ items: [veryCloseSide] });
      expect(out.state).toBe('STOP');
    });
  });

  describe('Free-space analysis', () => {
    it('reports right free when obstacle is on the left', () => {
      const leftObstacle: GuidanceInputItem = {
        label: 'cart',
        distanceM: 1.8,
        direction: 'left',
        zone: 'path',
      };
      const out = engine.processFrame({ items: [leftObstacle] });
      expect(out.freeSpace.clearestSide).toBe('right');
    });

    it('reports left free when obstacle is on the right', () => {
      const rightObstacle: GuidanceInputItem = {
        label: 'cart',
        distanceM: 1.8,
        direction: 'right',
        zone: 'path',
      };
      const out = engine.processFrame({ items: [rightObstacle] });
      expect(out.freeSpace.clearestSide).toBe('left');
    });
  });
});
