import { haptics } from '../core/haptics';
import { settings } from '../core/settings';
import { speech } from '../core/speech';
import { DistanceBucket, SceneObject } from '../types';

interface AnnouncedState {
  distance: DistanceBucket;
  timestamp: number;
}

const DISTANCE_RANKS: Record<DistanceBucket, number> = {
  'very-close': 3,
  'close': 2,
  'near': 1,
  'far': 0,
};

export class SpatialAnnouncer {
  private lastAnnounced: Map<string, AnnouncedState> = new Map();
  private lastDangerTimestamp = 0;
  private readonly generalCooldownMs = 8000;
  private readonly dangerCooldownMs = 2500;

  /**
   * Evaluates a batch of scene objects and speaks changes according to anti-chatter rules.
   */
  public process(objects: SceneObject[]): void {
    const now = Date.now();

    // 1. Check for immediate danger alerts
    const dangerObjects = objects.filter((o) => o.danger);
    if (dangerObjects.length > 0) {
      if (now - this.lastDangerTimestamp >= this.dangerCooldownMs) {
        this.lastDangerTimestamp = now;
        const primeHazard = dangerObjects[0];
        const dangerMsg = `Stop. ${primeHazard.label} ahead.`;
        haptics.pulseDanger();
        speech.speak(dangerMsg, { priority: 'danger' });
        return;
      }
    }

    // 2. Filter candidate objects worth announcing (ignore 'far')
    const candidates = objects.filter((o) => o.distance !== 'far' && !o.danger);
    if (candidates.length === 0) return;

    // 3. Check anti-chatter criteria for each candidate
    const toAnnounce: SceneObject[] = [];

    for (const obj of candidates) {
      const key = `${obj.label}_${obj.direction}`;
      const prev = this.lastAnnounced.get(key);

      let shouldAnnounce = false;

      if (!prev) {
        // Brand new object in this direction
        shouldAnnounce = true;
      } else {
        const isCloser = DISTANCE_RANKS[obj.distance] > DISTANCE_RANKS[prev.distance];
        const isCooldownExpired = now - prev.timestamp >= this.generalCooldownMs;

        if (isCloser || isCooldownExpired) {
          shouldAnnounce = true;
        }
      }

      if (shouldAnnounce) {
        toAnnounce.push(obj);
        this.lastAnnounced.set(key, {
          distance: obj.distance,
          timestamp: now,
        });
      }
    }

    if (toAnnounce.length === 0) return;

    // 4. Sort by closeness (highest rank first) and take at most 3
    toAnnounce.sort((a, b) => DISTANCE_RANKS[b.distance] - DISTANCE_RANKS[a.distance]);
    const topBatch = toAnnounce.slice(0, 3);

    // Format phrases: "{label} {distance}, {direction}."
    // e.g. "Chair close, right. Person ahead."
    const phrases = topBatch.map((item) => {
      if (item.direction === 'ahead') {
        return `${item.label} ${item.distance}, ahead.`;
      }
      return `${item.label} ${item.distance}, ${item.direction}.`;
    });

    const fullMessage = phrases.join(' ');
    haptics.pulseInfo();
    speech.speak(fullMessage, { priority: 'normal' });
  }

  public reset(): void {
    this.lastAnnounced.clear();
    this.lastDangerTimestamp = 0;
  }
}

export const announcer = new SpatialAnnouncer();
