import { Direction, DistanceBucket, SceneObject } from '../types';

export interface RawDetection {
  label: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

/**
 * Calculates direction from normalized center X coordinate (0 to 1).
 */
export function calculateDirection(centerX: number): Direction {
  if (centerX < 0.25) {
    return 'left';
  } else if (centerX < 0.38) {
    return 'slightly left';
  } else if (centerX <= 0.62) {
    return 'ahead';
  } else if (centerX <= 0.75) {
    return 'slightly right';
  } else {
    return 'right';
  }
}

/**
 * Calculates distance bucket based on normalized area ratio (0 to 1).
 */
export function calculateDistance(areaRatio: number): DistanceBucket {
  if (areaRatio > 0.35) {
    return 'very close';
  } else if (areaRatio >= 0.12) {
    return 'close';
  } else if (areaRatio >= 0.03) {
    return 'a few steps away';
  } else {
    return 'far';
  }
}

/**
 * Determines whether a detected object poses an immediate navigational hazard / danger.
 * Danger rule per section 6.4:
 * - Object in the central 50% of frame (0.25 <= centerX <= 0.75)
 * - In walking path (yCenter >= 0.35)
 * - Area ratio > 0.22 (close/huge) or area growing rapidly
 */
export function isHazardous(
  centerX: number,
  yCenter: number,
  areaRatio: number,
  previousAreaRatio?: number
): boolean {
  // Ignore very small items
  if (areaRatio < 0.08) {
    return false;
  }

  const inWalkingCorridor = centerX >= 0.25 && centerX <= 0.75 && yCenter >= 0.35;

  if (inWalkingCorridor) {
    // Immediate close proximity hazard
    if (areaRatio >= 0.22) {
      return true;
    }

    // Fast-approaching obstacle (area grew by > 40% in consecutive check)
    if (previousAreaRatio && previousAreaRatio > 0.05 && (areaRatio - previousAreaRatio) / previousAreaRatio > 0.4) {
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

  // Normalize coordinates
  const normX = x / frameWidth;
  const normY = y / frameHeight;
  const normW = width / frameWidth;
  const normH = height / frameHeight;

  const centerX = normX + normW / 2;
  const centerY = normY + normH / 2;
  const areaRatio = normW * normH;

  const direction = calculateDirection(centerX);
  const distance = calculateDistance(areaRatio);
  const danger = isHazardous(centerX, centerY, areaRatio, previousAreaRatio);

  return {
    label: detection.label,
    direction,
    distance,
    danger,
    score: detection.score,
    bbox: detection.bbox,
  };
}
