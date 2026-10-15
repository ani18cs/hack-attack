import { haptics } from '../core/haptics';
import { settings } from '../core/settings';
import { speech } from '../core/speech';
import { DistanceBucket, SceneObject } from '../types';
import { isRelevanceAllowed } from './focus';

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
   * Evaluates a batch of scene objects and speaks changes according to anti-chatter rules,
   * zone policies, and walking-relevance filters.
   */
  public process(objects: SceneObject[]): void {
    const now = Date.now();

    // 1. Zone Policy: Upper zone is completely ignored
    const nonUpperObjects = objects.filter((o) => o.zone !== 'upper');

    // 2. Relevance Filter: Allowlist of walking-relevant COCO classes with minAreaRatio
    const relevantObjects = nonUpperObjects.filter((o) =>
      isRelevanceAllowed(o.label, o.areaRatio ?? 0.05)
    );

    // 3. Zone Policy - Danger Alerts
    // Side zone objects: announced only if danger (very close or rapid growth), spoken as danger priority ("Person close, right").
    // Path zone objects: danger if under 2 strides or rapid approach ("Stop. Person ahead.").
    const dangerObjects = relevantObjects.filter((o) => o.danger);
    if (dangerObjects.length > 0) {
      if (now - this.lastDangerTimestamp >= this.dangerCooldownMs) {
        this.lastDangerTimestamp = now;
        const primeHazard = dangerObjects[0];

        let dangerMsg: string;
        if (primeHazard.zone === 'side') {
          // e.g. "Person close, right."
          dangerMsg = `${primeHazard.label} close, ${primeHazard.direction}.`;
        } else {
          // Path zone default
          dangerMsg = `Stop. ${primeHazard.label} ahead.`;
        }

        haptics.pulseDanger();
        speech.speak(dangerMsg, { priority: 'danger' });
        return;
      }
    }

    // Respect verbosity: quiet suppresses non-danger announcements
    const verbosity = settings.getSettings().verbosity;
    if (verbosity === 'quiet') return;

    // 4. Zone Policy - Normal Announcements
    // Only objects in the path zone are announced for normal situational awareness. Side zones only announce danger.
    const candidates = relevantObjects.filter(
      (o) => (o.zone === 'path' || o.zone === undefined) && o.distance !== 'far' && !o.danger
    );
    if (candidates.length === 0) return;

    // 5. Anti-chatter criteria for each candidate
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

    // 6. Sort by closeness (highest rank first) and take at most 3
    toAnnounce.sort((a, b) => DISTANCE_RANKS[b.distance] - DISTANCE_RANKS[a.distance]);
    const topBatch = toAnnounce.slice(0, 3);

    // Format phrases using natural units (strides/hand-spans) via formattedDistance
    // e.g. "Chair about 2 strides, ahead." or "Person about 3 strides, left."
    const phrases = topBatch.map((item) => {
      const distancePhrase = item.formattedDistance || item.distance;
      if (item.direction === 'ahead') {
        return `${item.label} ${distancePhrase}, ahead.`;
      }
      return `${item.label} ${distancePhrase}, ${item.direction}.`;
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
