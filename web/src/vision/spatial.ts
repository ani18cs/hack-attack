import { Direction, DistanceBucket, SceneObject } from '../types';

export interface RawDetection {
  label: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

/**
 * Per-class size tuning table.
 * A bottle or cup at arm's length subtends a much smaller area than a standing person.
 * We apply size multipliers to normalize semantic closeness.
 */
export const CLASS_SIZE_MULTIPLIERS: Record<string, number> = {
  bottle: 2.5,
  cup: 2.5,
  cell_phone: 3.0,
  phone: 3.0,
  book: 2.0,
  backpack: 1.2,
  handbag: 1.4,
  chair: 1.0,
  couch: 0.8,
  person: 0.9,
  dining_table: 0.8,
  table: 0.8,
};

/**
 * Calculates direction from normalized center X coordinate (0 to 1).
 */
export function calculateDirection(centerX: number): Direction {
  if (centerX < 0.25) {
    return 'left';
  } else if (centerX < 0.38) {
    return 'slightly-left';
  } else if (centerX <= 0.62) {
    return 'ahead';
  } else if (centerX <= 0.75) {
    return 'slightly-right';
  } else {
    return 'right';
  }
}

/**
 * Calculates distance bucket based on normalized area ratio (0 to 1).
 * Buckets per section 6.4:
 * > 0.35: 'very-close'
 * 0.12 - 0.35: 'close'
 * 0.03 - 0.12: 'near'
 * < 0.03: 'far'
 */
export function calculateDistance(areaRatio: number, label = ''): DistanceBucket {
  const multiplier = CLASS_SIZE_MULTIPLIERS[label.toLowerCase()] || 1.0;
  const effectiveArea = areaRatio * multiplier;

  if (effectiveArea > 0.35) {
    return 'very-close';
  } else if (effectiveArea >= 0.12) {
    return 'close';
  } else if (effectiveArea >= 0.03) {
    return 'near';
  } else {
    return 'far';
  }
}

/**
 * Determines whether a detected object poses an immediate hazard in walking path.
 * Danger rule:
 * - Central 50% corridor (0.25 <= centerX <= 0.75)
 * - Lower-center walking path zone (centerY >= 0.35)
 * - Area ratio > 0.25 OR rapid growth across consecutive frames (> 40%)
 */
export function isHazardous(
  centerX: number,
  yCenter: number,
  areaRatio: number,
  previousAreaRatio?: number
): boolean {
  if (areaRatio < 0.08) {
    return false;
  }

  const inWalkingCorridor = centerX >= 0.25 && centerX <= 0.75 && yCenter >= 0.35;

  if (inWalkingCorridor) {
    if (areaRatio >= 0.22) {
      return true;
    }
    if (
      previousAreaRatio &&
      previousAreaRatio > 0.05 &&
      (areaRatio - previousAreaRatio) / previousAreaRatio > 0.4
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Converts raw pixel or normalized detections into spatial SceneObject items.
 */
export function processSpatialObject(
  detection: RawDetection,
  frameWidth: number,
  frameHeight: number,
  previousAreaRatio?: number
): SceneObject {
  const [x, y, width, height] = detection.bbox;

  const normX = x / frameWidth;
  const normY = y / frameHeight;
  const normW = width / frameWidth;
  const normH = height / frameHeight;

  const centerX = normX + normW / 2;
  const centerY = normY + normH / 2;
  const rawAreaRatio = normW * normH;

  const direction = calculateDirection(centerX);
  const distance = calculateDistance(rawAreaRatio, detection.label);
  const danger = isHazardous(centerX, centerY, rawAreaRatio, previousAreaRatio);

  return {
    label: detection.label,
    score: detection.score,
    direction,
    distance,
    danger,
    bbox: detection.bbox,
  };
}
