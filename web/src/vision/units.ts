import { GUIDANCE, updateGuidanceConfig } from '../config/guidance';
import type { DistanceBucket, UnitPreference } from '../types';

export interface UnitsConfig {
  strideMeters: number; // Stride length in meters (default 0.30)
  handSpanMeters: number; // Hand span in meters (default 0.50)
  walkStepMeters: number; // Real footstep length for the pedometer (default 0.60)
  userHeightMeters?: number; // Optional user height in meters
  phoneHeightMeters?: number; // Derived or calibrated chest-height holding position
  unitPreference: UnitPreference; // 'strides' | 'metres'
}

export const DEFAULT_UNITS_CONFIG: UnitsConfig = {
  strideMeters: GUIDANCE.units.strideMeters,
  handSpanMeters: GUIDANCE.units.handSpanMeters,
  walkStepMeters: GUIDANCE.units.walkStepMeters,
  unitPreference: 'strides',
};

/**
 * Derives personalized phone holding height and stride lengths from user height.
 * Default holding height: chest height ~ 0.7 * body height.
 */
export function deriveFromHeight(heightMeters: number): {
  strideMeters: number;
  handSpanMeters: number;
  phoneHeightMeters: number;
} {
  const strideMeters = GUIDANCE.units.strideMeters;
  const handSpanMeters = GUIDANCE.units.handSpanMeters;
  const phoneHeightMeters = Math.round(0.7 * heightMeters * 100) / 100;

  return { strideMeters, handSpanMeters, phoneHeightMeters };
}

/**
 * Converts metric distance to strides (using product unit stride = 0.30m).
 */
export function metersToStrides(
  meters: number,
  strideMeters = GUIDANCE.units.strideMeters
): number {
  if (strideMeters <= 0) return 0;
  return meters / strideMeters;
}

/**
 * Converts metric distance to hand spans (using product unit hand span = 0.50m).
 */
export function metersToHandSpans(
  meters: number,
  handSpanMeters = GUIDANCE.units.handSpanMeters
): number {
  if (handSpanMeters <= 0) return 0;
  return meters / handSpanMeters;
}

/**
 * Calculates the number of strides required to laterally step around an obstacle of width objectWidthM.
 * Adds a safety buffer margin (default 0.5m) so the user clears the obstacle completely.
 */
export function lateralShiftStrides(
  objectWidthM: number,
  marginM = 0.5,
  strideMeters = GUIDANCE.units.strideMeters
): number {
  const neededMeters = objectWidthM / 2 + marginM;
  return Math.max(1, Math.ceil(neededMeters / strideMeters));
}

/**
 * Calibrates the real footstep length for the pedometer (walkStepMeters)
 * from a known walking distance (e.g. 6.0m or 10.0m) and counted steps.
 */
export function calibrateWalkStep(
  knownDistanceM: number,
  stepsCounted: number
): number {
  if (stepsCounted <= 0) return GUIDANCE.units.walkStepMeters;
  const raw = knownDistanceM / stepsCounted;
  // Clamp to realistic adult human walking step range (0.35m to 1.10m)
  const clamped = Math.max(0.35, Math.min(1.1, raw));
  const rounded = Math.round(clamped * 100) / 100;

  GUIDANCE.units.walkStepMeters = rounded;
  updateGuidanceConfig({
    units: {
      ...GUIDANCE.units,
      walkStepMeters: rounded,
    },
  });

  return rounded;
}

export const calibrateFromWalk = calibrateWalkStep;

/**
 * Converts coarse distance buckets (from VLM server) into meters.
 * Server rule: Gemini is never asked for meters; conversion happens deterministically on client.
 */
export function bucketToMeters(bucket: DistanceBucket): number {
  switch (bucket) {
    case 'very-close':
      return 0.8;
    case 'close':
      return 1.5;
    case 'near':
      return 3.0;
    case 'far':
      return 6.0;
    default:
      return 3.0;
  }
}

export interface FormatDistanceOptions {
  context?: 'walking' | 'object';
  preference?: UnitPreference;
  strideMeters?: number;
  handSpanMeters?: number;
  isHazard?: boolean;
}

/**
 * Formats a metric distance into natural, intuitive human guidance units.
 *
 * Rules:
 * - below 0.5m: "less than a hand span"
 * - 0.5m to handSpanMaxM (2.0m): "about N hand spans" (rounded to nearest whole unit; hazards round down)
 * - above 2.0m: "about N strides" (rounded to nearest whole unit; hazards round down)
 * - Always prefix with "about" (except "less than ...")
 * - For hazards, rounds down conservatively (says closer).
 */
export function formatDistance(
  meters: number,
  options: FormatDistanceOptions = {}
): string {
  const preference = options.preference ?? 'strides';
  const stride = options.strideMeters ?? GUIDANCE.units.strideMeters;
  const handSpan = options.handSpanMeters ?? GUIDANCE.units.handSpanMeters;
  const handSpanMaxM = GUIDANCE.units.handSpanMaxM; // 2.0m
  const isHazard = options.isHazard ?? false;

  if (preference === 'metres') {
    if (meters < 0.5) {
      return 'less than a metre';
    }
    const roundedMeters = isHazard ? Math.floor(meters) : Math.round(meters);
    if (roundedMeters <= 1) {
      return 'about 1 metre';
    }
    return `about ${roundedMeters} metres`;
  }

  // Unit preference: 'strides' & 'hand spans'
  // Rule 1: Below 0.5m -> "less than a hand span"
  if (meters < 0.5) {
    return 'less than a hand span';
  }

  // Rule 2: From 0.5m to handSpanMaxM (2.0m) -> speak hand spans
  if (meters <= handSpanMaxM) {
    const rawSpans = meters / handSpan;
    // For hazards: round down conservatively so the obstacle sounds closer
    const spans = isHazard ? Math.floor(rawSpans) : Math.round(rawSpans);
    const effectiveSpans = Math.max(1, spans);

    if (effectiveSpans === 1) {
      return 'about 1 hand span';
    }
    return `about ${effectiveSpans} ${GUIDANCE.units.unitNames.handSpan}`;
  }

  // Rule 3: Above handSpanMaxM (2.0m) -> speak strides
  const rawStrides = meters / stride;
  // For hazards: round down conservatively
  const strides = isHazard ? Math.floor(rawStrides) : Math.round(rawStrides);
  const effectiveStrides = Math.max(1, strides);

  if (effectiveStrides === 1) {
    return 'about 1 stride';
  }
  return `about ${effectiveStrides} ${GUIDANCE.units.unitNames.stride}`;
}

/**
 * Converts coarse distance buckets (from VLM server or COCO fallback) into natural stride phrases.
 */
export function formatDistanceBucketToStrides(
  bucket: DistanceBucket,
  preference: UnitPreference = 'strides'
): string {
  const meters = bucketToMeters(bucket);
  return formatDistance(meters, { preference });
}
