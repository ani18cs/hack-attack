/**
 * GUIDANCE Configuration - Single place for all tunable navigation and sensory values.
 *
 * PRODUCT DECISION NOTICES (Do not change values without product approval):
 * 1. Hand span default: 0.50m (50 cm).
 *    A normal adult hand span is about 18-23 cm. 50 cm is closer to a forearm length.
 *    If the user judges "hand span" with their own physical hand, they will misjudge by about 2.5x.
 *    The spoken label lives in `unitNames.handSpan`, so it can be renamed (e.g. "forearm") with one line.
 * 2. Stride default: 0.30m (30 cm).
 *    A normal walking step is about 60-75 cm. A 30 cm "stride" is closer to one foot length.
 *    If the user walks normal steps while the app says "8 strides", they will overshoot by about 2x.
 *    That is why `walkStepMeters` (0.60m) is kept as a separate constant used strictly for pedometer-based
 *    venue steps, and why calibration is supported.
 */

export interface GuidanceConfig {
  units: {
    strideMeters: number; // measurement unit "stride" (per product decision: 0.30)
    handSpanMeters: number; // measurement unit "hand span" (per product decision: 0.50)
    walkStepMeters: number; // real footstep length for the pedometer; calibrate per user (0.60)
    handSpanMaxM: number; // below this speak hand spans, above speak strides (2.0)
    unitNames: {
      stride: string;
      handSpan: string;
    };
  };
  distance: {
    conservativeFactor: number; // multiply estimated distance by this for safety decisions (0.75)
    stopM: number; // <= this in the path => STOP (1.2)
    cautionM: number; // <= this (and > stopM) => CAUTION (2.5)
  };
  hysteresis: {
    enterStopFrames: number; // consecutive frames to trigger STOP (2)
    exitStopFrames: number; // consecutive frames clear to leave STOP (4)
    enterCautionFrames: number; // consecutive frames to trigger CAUTION (2)
    exitCautionFrames: number; // consecutive frames clear to leave CAUTION (4)
  };
  haptics: {
    clearPulseMs: number;
    clearIntervalMs: number;
    cautionPattern: number[];
    cautionIntervalMs: number;
    cautionEnabled: boolean;
    stopPatternMs: number[];
    stopReissueMs: number;
  };
  speech: {
    defaultRate: number;
    minRate: number;
    maxRate: number;
    urgentRate: number;
    nonUrgentMinGapMs: number;
    sameMessageCooldownMs: number;
  };
  corridor: {
    xMin: number;
    xMax: number;
    ignoreTop: number;
    minAreaRatio: number;
  };
  signWatch: {
    intervalMs: number;
    maxCallsPerMinute: number;
    rereadCooldownMs: number;
  };
  pathScan: {
    intervalMs: number;
  };
  quality: {
    minBrightness: number;
    minSharpness: number;
  };
}

export const DEFAULT_GUIDANCE: GuidanceConfig = {
  units: {
    strideMeters: 0.30, // measurement unit "stride" (per product decision)
    handSpanMeters: 0.50, // measurement unit "hand span" (per product decision)
    walkStepMeters: 0.60, // real footstep length for the pedometer; calibrate per user
    handSpanMaxM: 2.0, // below this speak hand spans, above speak strides
    unitNames: { stride: 'strides', handSpan: 'hand spans' }, // rename in one line if needed
  },
  distance: {
    conservativeFactor: 0.75, // multiply estimated distance by this for safety decisions
    stopM: 1.2, // <= this in the path => STOP
    cautionM: 2.5, // <= this (and > stopM) => CAUTION
  },
  hysteresis: {
    enterStopFrames: 2,
    exitStopFrames: 4,
    enterCautionFrames: 2,
    exitCautionFrames: 4,
  },
  haptics: {
    clearPulseMs: 60,
    clearIntervalMs: 2500,
    cautionPattern: [60, 80, 60],
    cautionIntervalMs: 1500,
    cautionEnabled: true,
    stopPatternMs: [900, 100],
    stopReissueMs: 1000,
  },
  speech: {
    defaultRate: 0.85,
    minRate: 0.6,
    maxRate: 1.2,
    urgentRate: 0.95,
    nonUrgentMinGapMs: 5000,
    sameMessageCooldownMs: 12000,
  },
  corridor: {
    xMin: 0.2,
    xMax: 0.8,
    ignoreTop: 0.25,
    minAreaRatio: 0.03,
  },
  signWatch: {
    intervalMs: 3000,
    maxCallsPerMinute: 15,
    rereadCooldownMs: 60000,
  },
  pathScan: {
    intervalMs: 6000,
  },
  quality: {
    minBrightness: 40,
    minSharpness: 60, // tune on the demo phone
  },
};

const STORAGE_KEY = 'andhadhun_guidance_config_overrides';

function loadPersistedOverrides(): Partial<GuidanceConfig> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<GuidanceConfig>;
  } catch {
    return {};
  }
}

/**
 * Deep merge helper to combine overrides with default guidance config.
 */
function mergeDeep<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const val = source[key];
    if (val !== undefined) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val) && typeof target[key] === 'object') {
        result[key] = mergeDeep(target[key], val);
      } else {
        result[key] = val as any;
      }
    }
  }
  return result;
}

// Active singleton instance with localStorage overrides applied
export const GUIDANCE: GuidanceConfig = mergeDeep(DEFAULT_GUIDANCE, loadPersistedOverrides());

/**
 * Save updated overrides to localStorage and update in-memory GUIDANCE object.
 */
export function updateGuidanceConfig(updates: Partial<GuidanceConfig>): GuidanceConfig {
  mergeDeep(GUIDANCE, updates);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = loadPersistedOverrides();
      const merged = mergeDeep(existing, updates);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Safe fallback if localStorage fails or is blocked
    }
  }
  return GUIDANCE;
}

/**
 * Reset GUIDANCE to defaults.
 */
export function resetGuidanceConfig(): GuidanceConfig {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  Object.assign(GUIDANCE, JSON.parse(JSON.stringify(DEFAULT_GUIDANCE)));
  return GUIDANCE;
}
