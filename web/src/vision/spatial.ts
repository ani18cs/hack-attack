import { Direction, DistanceBucket, SceneObject, UnitPreference } from '../types';
import { FOCUS_CONFIG, FocusConfig, getDetectionZone } from './focus';
import { DEFAULT_UNITS_CONFIG, formatDistance } from './units';

export interface RawDetection {
  label: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

/**
 * Tunable spatial engine parameters.
 */
export const SPATIAL_CONFIG = {
  verticalFovDeg: 60,
  defaultPhoneHeightMeters: 1.2,
  dangerThresholdStrides: 2.0,
  dangerMarginStrides: 0.2, // Conservative safety margin (~2.2 strides)
  minPlausiblePitchDeg: 5,
  maxPlausiblePitchDeg: 75,
  rapidGrowthThreshold: 0.3, // > 30% area growth across frames
};

/**
 * Physical height priors for common objects (in meters).
 * Used for monocular pinhole distance estimation.
 */
export const CLASS_HEIGHT: Record<string, number> = {
  person: 1.7,
  chair: 0.9,
  couch: 0.85,
  sofa: 0.85,
  bench: 0.8,
  'dining table': 0.75,
  dining_table: 0.75,
  table: 0.75,
  bicycle: 1.0,
  motorcycle: 1.1,
  car: 1.5,
  bus: 2.8,
  truck: 2.8,
  dog: 0.5,
  cat: 0.3,
  suitcase: 0.65,
  backpack: 0.5,
  umbrella: 0.9,
  bottle: 0.25,
  cup: 0.1,
  laptop: 0.25,
  cell_phone: 0.15,
  phone: 0.15,
  door: 2.0,
  default: 1.0,
};

/**
 * Per-class size tuning table for area ratio fallbacks.
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
 * Calculates camera focal length in pixels from frame height and vertical FOV.
 * focalPx = (frameHeightPx / 2) / tan(verticalFovRad / 2)
 */
export function calculateFocalPixels(
  frameHeightPx: number,
  verticalFovDeg = SPATIAL_CONFIG.verticalFovDeg
): number {
  const vFovRad = (verticalFovDeg * Math.PI) / 180;
  return frameHeightPx / 2 / Math.tan(vFovRad / 2);
}

/**
 * Size-based distance estimation:
 * distance = (CLASS_HEIGHT[label] * focalPx) / boxHeightPx
 */
export function estimateDistanceBySize(
  label: string,
  boxHeightPx: number,
  frameHeightPx: number,
  verticalFovDeg = SPATIAL_CONFIG.verticalFovDeg
): number {
  if (boxHeightPx <= 0 || frameHeightPx <= 0) return 6.0;
  const normalizedLabel = label.toLowerCase().trim().replace(/_/g, ' ');
  const objectHeight =
    CLASS_HEIGHT[normalizedLabel] ??
    CLASS_HEIGHT[label.toLowerCase().trim()] ??
    CLASS_HEIGHT.default;

  const focalPx = calculateFocalPixels(frameHeightPx, verticalFovDeg);
  const distance = (objectHeight * focalPx) / boxHeightPx;
  return Math.max(0.1, Math.min(25.0, distance));
}

/**
 * Ground-plane distance estimation using device tilt (pitch below horizon) and phone height:
 * distance = phoneHeightMeters / tan(angleBelowHorizon)
 * Returns null if tilt angle is missing, outside plausible range (5° - 75°), or bottom edge is above horizon.
 */
export function estimateDistanceByGroundPlane(
  bottomEdgeY: number,
  frameHeightPx: number,
  pitchBelowHorizonDeg?: number,
  phoneHeightMeters = SPATIAL_CONFIG.defaultPhoneHeightMeters,
  verticalFovDeg = SPATIAL_CONFIG.verticalFovDeg
): number | null {
  if (
    pitchBelowHorizonDeg === undefined ||
    pitchBelowHorizonDeg === null ||
    Number.isNaN(pitchBelowHorizonDeg) ||
    pitchBelowHorizonDeg < SPATIAL_CONFIG.minPlausiblePitchDeg ||
    pitchBelowHorizonDeg > SPATIAL_CONFIG.maxPlausiblePitchDeg ||
    frameHeightPx <= 0
  ) {
    return null; // Tilt is implausible or unavailable
  }

  const focalPx = calculateFocalPixels(frameHeightPx, verticalFovDeg);
  const deltaY = bottomEdgeY - frameHeightPx / 2;
  const angleFromCenterRad = Math.atan(deltaY / focalPx);
  const pitchRad = (pitchBelowHorizonDeg * Math.PI) / 180;
  const angleBelowHorizon = pitchRad + angleFromCenterRad;

  // If ray is on or above the horizon, it does not intersect ground ahead
  if (angleBelowHorizon <= 0.05 || angleBelowHorizon >= Math.PI / 2 - 0.05) {
    return null;
  }

  const distance = phoneHeightMeters / Math.tan(angleBelowHorizon);
  if (distance < 0.1 || distance > 25.0 || Number.isNaN(distance)) {
    return null;
  }

  return distance;
}

/**
 * Maps metric distance to coarse distance buckets via strides:
 * very-close: < 1 stride
 * close: 1 - 2 strides
 * near: 3 - 5 strides
 * far: 6+ strides
 */
export function mapDistanceToBucket(
  distanceMeters: number,
  strideMeters = DEFAULT_UNITS_CONFIG.strideMeters
): DistanceBucket {
  const strides = distanceMeters / strideMeters;
  if (strides < 1.0) {
    return 'very-close';
  } else if (strides <= 2.4) {
    return 'close';
  } else if (strides <= 5.5) {
    return 'near';
  } else {
    return 'far';
  }
}

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
 * Determines whether a detected object poses a path hazard.
 */
export function isHazardous(
  centerX: number,
  yCenter: number,
  areaRatio: number,
  previousAreaRatio?: number,
  distanceStrides?: number
): boolean {
  if (yCenter < FOCUS_CONFIG.ignoreTop) {
    return false; // Upper zone ignored
  }

  const inWalkingCorridor =
    centerX >= FOCUS_CONFIG.corridor.xMin &&
    centerX <= FOCUS_CONFIG.corridor.xMax &&
    yCenter >= 0.35;

  if (!inWalkingCorridor) {
    return false;
  }

  // Under 2 strides in path with safety margin
  if (
    distanceStrides !== undefined &&
    distanceStrides <= SPATIAL_CONFIG.dangerThresholdStrides + SPATIAL_CONFIG.dangerMarginStrides
  ) {
    return true;
  }

  if (areaRatio < 0.08) {
    return false;
  }

  if (areaRatio >= 0.22) {
    return true;
  }

  if (
    previousAreaRatio &&
    previousAreaRatio > 0.05 &&
    (areaRatio - previousAreaRatio) / previousAreaRatio > SPATIAL_CONFIG.rapidGrowthThreshold
  ) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether an object in the side zones represents an imminent collision hazard.
 * Side zones: announce only if the box is very close, or area is growing fast.
 */
export function isSideHazardous(
  areaRatio: number,
  previousAreaRatio?: number,
  config: FocusConfig = FOCUS_CONFIG
): boolean {
  if (areaRatio >= config.sideDangerAreaRatio) {
    return true;
  }

  if (
    previousAreaRatio &&
    previousAreaRatio > 0.05 &&
    (areaRatio - previousAreaRatio) / previousAreaRatio > SPATIAL_CONFIG.rapidGrowthThreshold
  ) {
    return true;
  }

  return false;
}

export interface ProcessSpatialOptions {
  previousAreaRatio?: number;
  pitchBelowHorizonDeg?: number;
  phoneHeightMeters?: number;
  strideMeters?: number;
  handSpanMeters?: number;
  unitPreference?: UnitPreference;
  focusConfig?: FocusConfig;
}

/**
 * Converts raw pixel detections into rich spatial SceneObject items with
 * metric distance, unit phrasing (strides/hand-spans), zones, and zone hazard policies.
 */
export function processSpatialObject(
  detection: RawDetection,
  frameWidth: number,
  frameHeight: number,
  optionsOrPrevRatio?: number | ProcessSpatialOptions
): SceneObject {
  const options: ProcessSpatialOptions =
    typeof optionsOrPrevRatio === 'number'
      ? { previousAreaRatio: optionsOrPrevRatio }
      : optionsOrPrevRatio || {};

  const previousAreaRatio = options.previousAreaRatio;
  const pitchBelowHorizonDeg = options.pitchBelowHorizonDeg;
  const phoneHeightMeters = options.phoneHeightMeters ?? SPATIAL_CONFIG.defaultPhoneHeightMeters;
  const strideMeters = options.strideMeters ?? DEFAULT_UNITS_CONFIG.strideMeters;
  const handSpanMeters = options.handSpanMeters ?? DEFAULT_UNITS_CONFIG.handSpanMeters;
  const unitPreference = options.unitPreference ?? DEFAULT_UNITS_CONFIG.unitPreference;
  const focusConfig = options.focusConfig ?? FOCUS_CONFIG;

  const [x, y, width, height] = detection.bbox;

  const normX = x / frameWidth;
  const normY = y / frameHeight;
  const normW = width / frameWidth;
  const normH = height / frameHeight;

  const centerX = normX + normW / 2;
  const centerY = normY + normH / 2;
  const rawAreaRatio = normW * normH;
  const bottomEdgeY = y + height;

  const zone = getDetectionZone([normX, normY, normW, normH], focusConfig);
  const direction = calculateDirection(centerX);

  // Distance estimation: Ground-plane when tilt is available & plausible, else Size method
  const groundDistance = estimateDistanceByGroundPlane(
    bottomEdgeY,
    frameHeight,
    pitchBelowHorizonDeg,
    phoneHeightMeters
  );

  const distanceMeters =
    groundDistance !== null
      ? groundDistance
      : estimateDistanceBySize(detection.label, height, frameHeight);

  const distanceStrides = distanceMeters / strideMeters;
  const distanceBucket = mapDistanceToBucket(distanceMeters, strideMeters);

  // Zone policy evaluation
  let danger = false;
  if (zone === 'path') {
    // Treat anything under 2 strides in path as danger with conservative margin
    const under2Strides =
      distanceStrides <= SPATIAL_CONFIG.dangerThresholdStrides + SPATIAL_CONFIG.dangerMarginStrides;
    danger =
      under2Strides ||
      isHazardous(centerX, centerY, rawAreaRatio, previousAreaRatio, distanceStrides);
  } else if (zone === 'side') {
    // Side zone danger: only if very close or area is growing fast over frames
    danger = isSideHazardous(rawAreaRatio, previousAreaRatio, focusConfig);
  } else {
    // Upper zone: ignored
    danger = false;
  }

  const formattedDistance = formatDistance(distanceMeters, {
    isHazard: danger,
    preference: unitPreference,
    strideMeters,
    handSpanMeters,
  });

  return {
    label: detection.label,
    score: detection.score,
    direction,
    distance: distanceBucket,
    distanceMeters,
    formattedDistance,
    zone,
    areaRatio: rawAreaRatio,
    danger,
    bbox: detection.bbox,
  };
}

export const calculateSpatialProperties = processSpatialObject;
