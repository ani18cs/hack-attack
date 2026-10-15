import { beforeEach, describe, expect, it, vi } from 'vitest';
import { announcer } from './announcer';
import { speech } from '../core/speech';
import { haptics } from '../core/haptics';
import { SceneObject } from '../types';

vi.mock('../core/speech', () => ({
  speech: {
    speak: vi.fn(),
  },
}));

vi.mock('../core/haptics', () => ({
  haptics: {
    pulseDanger: vi.fn(),
    pulseInfo: vi.fn(),
  },
}));

describe('SpatialAnnouncer with Zone Policies and Relevance Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    announcer.reset();
  });

  it('ignores objects in the upper zone completely', () => {
    const upperObj: SceneObject = {
      label: 'person',
      score: 0.95,
      direction: 'ahead',
      distance: 'close',
      formattedDistance: 'about 2 strides',
      zone: 'upper',
      areaRatio: 0.1,
      danger: false,
      bbox: [100, 10, 200, 100],
    };

    announcer.process([upperObj]);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('ignores non-walking allowlist classes', () => {
    const forkObj: SceneObject = {
      label: 'fork',
      score: 0.95,
      direction: 'ahead',
      distance: 'close',
      formattedDistance: 'about 2 strides',
      zone: 'path',
      areaRatio: 0.1,
      danger: false,
      bbox: [100, 300, 200, 200],
    };

    announcer.process([forkObj]);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('announces side zone objects ONLY when danger is true with danger priority', () => {
    // Non-danger side object: should NOT be announced
    const sideObjSafe: SceneObject = {
      label: 'chair',
      score: 0.95,
      direction: 'right',
      distance: 'near',
      formattedDistance: 'about 4 strides',
      zone: 'side',
      areaRatio: 0.08,
      danger: false,
      bbox: [850, 300, 100, 200],
    };

    announcer.process([sideObjSafe]);
    expect(speech.speak).not.toHaveBeenCalled();

    // Danger side object: announced as danger priority ("Person close, right.")
    const sideObjDanger: SceneObject = {
      label: 'person',
      score: 0.95,
      direction: 'right',
      distance: 'very-close',
      formattedDistance: 'less than a stride',
      zone: 'side',
      areaRatio: 0.25,
      danger: true,
      bbox: [850, 300, 150, 400],
    };

    announcer.process([sideObjDanger]);
    expect(haptics.pulseDanger).toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalledWith('person close, right.', { priority: 'danger' });
  });

  it('announces path zone candidates using natural distance phrasing', () => {
    const pathObj: SceneObject = {
      label: 'chair',
      score: 0.9,
      direction: 'ahead',
      distance: 'close',
      formattedDistance: 'about 2 strides',
      zone: 'path',
      areaRatio: 0.12,
      danger: false,
      bbox: [400, 350, 200, 300],
    };

    announcer.process([pathObj]);
    expect(speech.speak).toHaveBeenCalledWith('chair about 2 strides, ahead.', { priority: 'normal' });
  });
});
