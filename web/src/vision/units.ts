import type { DistanceBucket, UnitPreference } from '../types';

export interface UnitsConfig {
  strideMeters: number; // Stride length in meters (default 0.7)
  handSpanMeters: number; // Hand span in meters (thumb to pinky, default 0.19)
  userHeightMeters?: number; // Optional user height in meters
  unitPreference: UnitPreference; // 'strides' | 'metres'
}

export const DEFAULT_UNITS_CONFIG: UnitsConfig = {
  strideMeters: 0.7,
  handSpanMeters: 0.19,
  unitPreference: 'strides',
};

/**
 * Derives personalized stride and hand-span lengths from user height using anthropometric rules of thumb.
 * Note: These are population approximations (stride ~ 0.415 * height; hand span ~ 0.11 * height).
 * True individual values vary with biomechanics and pace.
 */
export function deriveFromHeight(heightMeters: number): {
  strideMeters: number;
  handSpanMeters: number;
} {
  // Approximation: human stride is roughly 41.5% of body height
  const strideMeters = Math.round(0.415 * heightMeters * 100) / 100;
  // Approximation: open hand span (thumb tip to pinky tip) is roughly 11% of body height
  const handSpanMeters = Math.round(0.11 * heightMeters * 100) / 100;

  return { strideMeters, handSpanMeters };
}

/**
 * Calibrates stride length from a known walking distance and counted steps.
 * e.g. walking 10 meters in 14 steps => stride length ~ 0.71 meters.
 */
export function calibrateFromWalk(knownDistanceMeters: number, stepsCounted: number): number {
  if (stepsCounted <= 0) return DEFAULT_UNITS_CONFIG.strideMeters;
  const raw = knownDistanceMeters / stepsCounted;
  // Clamp to realistic adult human stride range (0.4m to 1.2m)
  const clamped = Math.max(0.4, Math.min(1.2, raw));
  return Math.round(clamped * 100) / 100;
}

export interface FormatDistanceOptions {
  context?: 'walking' | 'object';
  preference?: UnitPreference;
  strideMeters?: number;
  handSpanMeters?: number;
  isHazard?: boolean;
}

/**
 * Formats a metric distance into natural, intuitive human terms (strides or hand spans).
 * All distances include "about", "less than", or "more than" to reflect honest measurement uncertainty.
 * For hazards, rounds conservatively (downward) so hazards are not understated.
 */
export function formatDistance(
  meters: number,
  options: FormatDistanceOptions = {}
): string {
  const context = options.context ?? 'walking';
  const preference = options.preference ?? 'strides';
  const stride = options.strideMeters ?? DEFAULT_UNITS_CONFIG.strideMeters;
  const handSpan = options.handSpanMeters ?? DEFAULT_UNITS_CONFIG.handSpanMeters;
  const isHazard = options.isHazard ?? false;

  if (preference === 'metres') {
    if (meters < 0.8) {
      return 'less than a metre';
    }
    const roundedMeters = isHazard ? Math.floor(meters) : Math.round(meters);
    if (roundedMeters <= 1) {
      return 'about 1 metre';
    }
    return `about ${roundedMeters} metres`;
  }

  // Unit preference: 'strides'
  // In object-finding mode (e.g. finding a bottle, keys, cup) within arm's reach (< 0.9m), use hand spans
  if (context === 'object' && meters < 0.9) {
    const rawSpans = meters / handSpan;
    const spans = Math.round(rawSpans);
    if (spans <= 1) {
      return 'about 1 hand span';
    }
    return `about ${spans} hand spans`;
  }

  // Walking context: calculate stride count
  const rawStrides = meters / stride;
  // Conservative rounding for hazards: round down so the obstacle sounds closer
  const effectiveStrides = isHazard ? Math.floor(rawStrides) : rawStrides;

  if (effectiveStrides < 1.0) {
    return 'less than a stride';
  } else if (effectiveStrides <= 2.4) {
    return 'about 2 strides';
  } else if (effectiveStrides <= 3.8) {
    return 'about 3 strides';
  } else if (effectiveStrides <= 6.5) {
    return 'about 5 strides';
  } else {
    return 'more than 8 strides';
  }
}

/**
 * Converts coarse distance buckets (from VLM server or COCO fallback) into natural stride phrases.
 */
export function formatDistanceBucketToStrides(
  bucket: DistanceBucket,
  preference: UnitPreference = 'strides'
): string {
  if (preference === 'metres') {
    switch (bucket) {
      case 'very-close':
        return 'less than a metre';
      case 'close':
        return 'about 2 metres';
      case 'near':
        return 'about 4 metres';
      case 'far':
        return 'more than 6 metres';
    }
  }

  switch (bucket) {
    case 'very-close':
      return 'less than a stride';
    case 'close':
      return 'about 2 strides';
    case 'near':
      return 'about 5 strides';
    case 'far':
      return 'more than 8 strides';
  }
}
