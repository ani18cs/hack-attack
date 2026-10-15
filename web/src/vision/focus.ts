import type { DetectionZone } from '../types';

export interface FocusConfig {
  corridor: {
    xMin: number; // Left boundary of walking path (default 0.2)
    xMax: number; // Right boundary of walking path (default 0.8)
  };
  ignoreTop: number; // Fraction of top frame to ignore (default 0.25)
  minAreaRatio: number; // Minimum box area relative to corridor to consider relevant (default 0.03)
  sideDangerAreaRatio: number; // Minimum area ratio for side-zone obstacles to trigger danger alert (default 0.2)
  zoom: number; // Camera optical/digital zoom factor if supported (default 1.5)
}

/**
 * Tunable focus configuration for walking path corridor and zone policies.
 */
export const FOCUS_CONFIG: FocusConfig = {
  corridor: { xMin: 0.2, xMax: 0.8 },
  ignoreTop: 0.25,
  minAreaRatio: 0.03,
  sideDangerAreaRatio: 0.2,
  zoom: 1.5,
};

/**
 * Allowlist of walking-relevant COCO-SSD classes that impact pedestrian navigation.
 * Non-listed classes are ignored unless the user specifically asks.
 */
export const WALKING_RELEVANT_CLASSES = new Set([
  'person',
  'chair',
  'couch',
  'bench',
  'dining table',
  'dining_table',
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
]);

/**
 * Normalizes class labels to match the allowlist (handling underscores and spaces).
 */
export function normalizeClassLabel(label: string): string {
  return label.trim().toLowerCase().replace(/_/g, ' ');
}

/**
 * Checks if a detected object meets the relevance filter:
 * 1. Must be in the walking-relevant allowlist (unless explicitly asked by user).
 * 2. Must meet the minimum area ratio gate (ignoring tiny background noise).
 */
export function isRelevanceAllowed(
  label: string,
  areaRatio: number,
  userAskedOrConfig?: boolean | FocusConfig,
  config?: FocusConfig
): boolean {
  let userAsked = false;
  let cfg: FocusConfig = FOCUS_CONFIG;

  if (typeof userAskedOrConfig === 'boolean') {
    userAsked = userAskedOrConfig;
    if (config) cfg = config;
  } else if (typeof userAskedOrConfig === 'object' && userAskedOrConfig !== null) {
    cfg = userAskedOrConfig;
  }

  if (userAsked) {
    // If the user explicitly asks ("where is the bottle", "read label"), allow non-allowlisted classes with minimal threshold
    return areaRatio >= 0.01;
  }

  const normalized = normalizeClassLabel(label);
  const isClassAllowed =
    WALKING_RELEVANT_CLASSES.has(normalized) ||
    WALKING_RELEVANT_CLASSES.has(label.toLowerCase());

  if (!isClassAllowed) {
    return false;
  }

  return areaRatio >= cfg.minAreaRatio;
}

/**
 * Classifies a bounding box into one of three zones:
 * - 'upper': above ignoreTop cutoff (e.g. ceiling lights, sky) -> ignored
 * - 'path': inside walking corridor (xMin to xMax) below ignoreTop -> normal announcements
 * - 'side': outside corridor on left or right below ignoreTop -> danger only if very close/rapid growth
 */
export function getDetectionZone(
  bbox: [number, number, number, number],
  frameWidthOrConfig?: number | FocusConfig,
  frameHeight?: number,
  config?: FocusConfig
): DetectionZone {
  let cfg: FocusConfig = FOCUS_CONFIG;
  let fw = 1;
  let fh = 1;

  if (typeof frameWidthOrConfig === 'object' && frameWidthOrConfig !== null) {
    cfg = frameWidthOrConfig;
  } else if (typeof frameWidthOrConfig === 'number') {
    fw = frameWidthOrConfig;
    if (typeof frameHeight === 'number') {
      fh = frameHeight;
    }
    if (config) {
      cfg = config;
    }
  }

  const [x, y, w, h] = bbox;
  const normX = fw > 1 ? x / fw : x;
  const normY = fh > 1 ? y / fh : y;
  const normW = fw > 1 ? w / fw : w;
  const normH = fh > 1 ? h / fh : h;

  const centerY = normY + normH / 2;

  if (centerY < cfg.ignoreTop) {
    return 'upper';
  }

  const centerX = normX + normW / 2;
  if (centerX >= cfg.corridor.xMin && centerX <= cfg.corridor.xMax) {
    return 'path';
  }

  return 'side';
}

/**
 * Maps a bounding box detected within the cropped corridor canvas back to the full camera frame coordinate system.
 */
export function mapCroppedBoxToFullFrame(
  croppedBox: [number, number, number, number],
  frameWidth: number,
  frameHeight: number,
  config: FocusConfig = FOCUS_CONFIG
): [number, number, number, number] {
  const [cx, cy, cw, ch] = croppedBox;
  const cropOffsetX = Math.round(frameWidth * config.corridor.xMin);
  const cropOffsetY = Math.round(frameHeight * config.ignoreTop);

  return [cx + cropOffsetX, cy + cropOffsetY, cw, ch];
}

/**
 * Calculates the crop rectangle in pixel coordinates for a given video/canvas frame.
 */
export function getCorridorCropRect(
  frameWidth: number,
  frameHeight: number,
  config: FocusConfig = FOCUS_CONFIG
): { sx: number; sy: number; sWidth: number; sHeight: number } {
  const sx = Math.round(frameWidth * config.corridor.xMin);
  const sy = Math.round(frameHeight * config.ignoreTop);
  const sWidth = Math.round(frameWidth * (config.corridor.xMax - config.corridor.xMin));
  const sHeight = Math.round(frameHeight * (1 - config.ignoreTop));

  return { sx, sy, sWidth, sHeight };
}
