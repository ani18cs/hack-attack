import { GUIDANCE, type GuidanceConfig } from '../config/guidance';
import type { Direction, DetectionZone } from '../types';

export type GuidanceState = 'CLEAR' | 'CAUTION' | 'STOP';

export interface BlockerInfo {
  label: string;
  distanceM: number;
  direction: Direction;
  widthM?: number;
  zone?: DetectionZone;
  effectiveDistanceM?: number;
}

export interface FreeSpaceInfo {
  clearestSide: 'left' | 'right' | 'ahead' | 'none';
  freeWidthM: number;
  leftFreeWidthM?: number;
  rightFreeWidthM?: number;
  occupiedColumns: {
    left: boolean;
    center: boolean;
    right: boolean;
  };
}

export interface GuidanceInputItem {
  label: string;
  distanceM: number;
  direction: Direction;
  zone?: DetectionZone;
  widthM?: number;
  bbox?: [number, number, number, number]; // [x, y, w, h]
  danger?: boolean;
  isApproachingFast?: boolean;
}

export interface GuidanceInputFrame {
  items: GuidanceInputItem[];
  timestamp?: number;
}

export interface GuidanceOutput {
  state: GuidanceState;
  rawCandidateState: GuidanceState;
  previousState: GuidanceState;
  stateChanged: boolean;
  nearestBlocker: BlockerInfo | null;
  freeSpace: FreeSpaceInfo;
  timestamp: number;
}

/**
 * Pure Guidance Engine: State machine evaluating obstacle inputs against safety thresholds,
 * applying hysteresis (enter/exit frame counters) to eliminate flicker, and computing
 * free-space escape paths.
 */
export class GuidanceEngine {
  private currentState: GuidanceState = 'CLEAR';
  private config: GuidanceConfig;

  // Hysteresis counters
  private consecutiveStopFrames = 0;
  private consecutiveCautionFrames = 0;
  private consecutiveClearFrames = 0;
  private consecutiveNonStopFrames = 0;

  constructor(customConfig?: Partial<GuidanceConfig>) {
    this.config = customConfig ? ({ ...GUIDANCE, ...customConfig } as GuidanceConfig) : GUIDANCE;
  }

  public updateConfig(newConfig: Partial<GuidanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getState(): GuidanceState {
    return this.currentState;
  }

  public reset(): void {
    this.currentState = 'CLEAR';
    this.consecutiveStopFrames = 0;
    this.consecutiveCautionFrames = 0;
    this.consecutiveClearFrames = 0;
    this.consecutiveNonStopFrames = 0;
  }

  /**
   * Processes a single detector tick (~100-200ms) with path-zone and side-zone detections.
   */
  public processFrame(frame: GuidanceInputFrame): GuidanceOutput {
    const timestamp = frame.timestamp ?? Date.now();
    const items = frame.items || [];
    const previousState = this.currentState;

    const conservativeFactor = this.config.distance.conservativeFactor;
    const stopM = this.config.distance.stopM;
    const cautionM = this.config.distance.cautionM;

    let rawCandidateState: GuidanceState = 'CLEAR';
    let nearestBlocker: BlockerInfo | null = null;
    let minDistance = Infinity;

    // Occupied column tracking for free-space analysis
    const occupiedColumns = { left: false, center: false, right: false };

    for (const item of items) {
      const zone = item.zone ?? 'path';
      if (zone === 'upper') continue; // Upper zone ignored for pedestrian walking clearance

      const effectiveDistance = item.distanceM * conservativeFactor;

      // Track nearest obstacle across all walking-relevant items
      if (item.distanceM < minDistance) {
        minDistance = item.distanceM;
        nearestBlocker = {
          label: item.label,
          distanceM: item.distanceM,
          direction: item.direction,
          widthM: item.widthM,
          zone,
          effectiveDistanceM: effectiveDistance,
        };
      }

      // Mark occupied column
      if (item.direction === 'left' || item.direction === 'slightly-left') {
        occupiedColumns.left = true;
      } else if (item.direction === 'ahead') {
        occupiedColumns.center = true;
      } else if (item.direction === 'right' || item.direction === 'slightly-right') {
        occupiedColumns.right = true;
      }

      // Evaluate candidate state based on zone policy:
      if (zone === 'path') {
        if (effectiveDistance <= stopM) {
          rawCandidateState = 'STOP';
        } else if (effectiveDistance <= cautionM) {
          if (rawCandidateState !== 'STOP') {
            rawCandidateState = 'CAUTION';
          }
        }
      } else if (zone === 'side') {
        // Side-zone objects only matter if very close or approaching fast.
        // Trigger CAUTION with a direction, NOT STOP, unless within stopM.
        if (effectiveDistance <= stopM) {
          rawCandidateState = 'STOP';
        } else if (
          item.danger ||
          item.isApproachingFast ||
          effectiveDistance <= cautionM
        ) {
          if (rawCandidateState !== 'STOP') {
            rawCandidateState = 'CAUTION';
          }
        }
      }
    }

    // Free space analysis
    const freeSpace = this.calculateFreeSpace(occupiedColumns, nearestBlocker);

    // Apply Hysteresis
    this.applyHysteresis(rawCandidateState);

    const stateChanged = this.currentState !== previousState;

    return {
      state: this.currentState,
      rawCandidateState,
      previousState,
      stateChanged,
      nearestBlocker,
      freeSpace,
      timestamp,
    };
  }

  /**
   * Applies hysteresis thresholds to prevent guidance state flickering.
   */
  private applyHysteresis(rawCandidateState: GuidanceState): void {
    const enterStopFrames = this.config.hysteresis.enterStopFrames;
    const exitStopFrames = this.config.hysteresis.exitStopFrames;
    const enterCautionFrames = this.config.hysteresis.enterCautionFrames;
    const exitCautionFrames = this.config.hysteresis.exitCautionFrames;

    if (this.currentState === 'CLEAR') {
      if (rawCandidateState === 'STOP') {
        this.consecutiveStopFrames++;
        this.consecutiveCautionFrames = 0;
        this.consecutiveClearFrames = 0;
        if (this.consecutiveStopFrames >= enterStopFrames) {
          this.currentState = 'STOP';
          this.consecutiveStopFrames = 0;
        }
      } else if (rawCandidateState === 'CAUTION') {
        this.consecutiveCautionFrames++;
        this.consecutiveStopFrames = 0;
        this.consecutiveClearFrames = 0;
        if (this.consecutiveCautionFrames >= enterCautionFrames) {
          this.currentState = 'CAUTION';
          this.consecutiveCautionFrames = 0;
        }
      } else {
        // Raw state is CLEAR
        this.consecutiveStopFrames = 0;
        this.consecutiveCautionFrames = 0;
        this.consecutiveClearFrames++;
      }
    } else if (this.currentState === 'CAUTION') {
      if (rawCandidateState === 'STOP') {
        this.consecutiveStopFrames++;
        this.consecutiveClearFrames = 0;
        if (this.consecutiveStopFrames >= enterStopFrames) {
          this.currentState = 'STOP';
          this.consecutiveStopFrames = 0;
        }
      } else if (rawCandidateState === 'CAUTION') {
        this.consecutiveStopFrames = 0;
        this.consecutiveClearFrames = 0;
      } else {
        // Raw candidate is CLEAR
        this.consecutiveStopFrames = 0;
        this.consecutiveClearFrames++;
        if (this.consecutiveClearFrames >= exitCautionFrames) {
          this.currentState = 'CLEAR';
          this.consecutiveClearFrames = 0;
        }
      }
    } else if (this.currentState === 'STOP') {
      if (rawCandidateState === 'STOP') {
        this.consecutiveNonStopFrames = 0;
        this.consecutiveClearFrames = 0;
      } else if (rawCandidateState === 'CAUTION') {
        this.consecutiveNonStopFrames++;
        this.consecutiveClearFrames = 0;
        if (this.consecutiveNonStopFrames >= exitStopFrames) {
          this.currentState = 'CAUTION';
          this.consecutiveNonStopFrames = 0;
        }
      } else {
        // Raw candidate is CLEAR
        this.consecutiveNonStopFrames++;
        this.consecutiveClearFrames++;
        if (this.consecutiveClearFrames >= exitStopFrames) {
          this.currentState = 'CLEAR';
          this.consecutiveClearFrames = 0;
          this.consecutiveNonStopFrames = 0;
        } else if (this.consecutiveNonStopFrames >= exitStopFrames) {
          // If 4 frames were not STOP, but some were caution, transition to caution
          this.currentState = 'CAUTION';
          this.consecutiveNonStopFrames = 0;
        }
      }
    }
  }

  /**
   * Evaluates corridor columns to find the clearest bypass direction and free width.
   */
  private calculateFreeSpace(
    occupied: { left: boolean; center: boolean; right: boolean },
    _nearestBlocker: BlockerInfo | null
  ): FreeSpaceInfo {
    const totalCorridorWidthM = 1.8; // approximate standard indoor walking corridor width in metres
    const columnWidthM = totalCorridorWidthM / 3; // 0.60m per column

    let clearestSide: 'left' | 'right' | 'ahead' | 'none' = 'ahead';
    let freeWidthM = totalCorridorWidthM;

    if (!occupied.left && !occupied.center && !occupied.right) {
      clearestSide = 'ahead';
      freeWidthM = totalCorridorWidthM;
    } else if (!occupied.right && occupied.left) {
      clearestSide = 'right';
      freeWidthM = !occupied.center ? columnWidthM * 2 : columnWidthM;
    } else if (!occupied.left && occupied.right) {
      clearestSide = 'left';
      freeWidthM = !occupied.center ? columnWidthM * 2 : columnWidthM;
    } else if (occupied.center) {
      if (!occupied.right && !occupied.left) {
        // Center blocked, both sides open: pick right as default convention
        clearestSide = 'right';
        freeWidthM = columnWidthM;
      } else if (!occupied.right) {
        clearestSide = 'right';
        freeWidthM = columnWidthM;
      } else if (!occupied.left) {
        clearestSide = 'left';
        freeWidthM = columnWidthM;
      } else {
        clearestSide = 'none';
        freeWidthM = 0;
      }
    } else {
      clearestSide = 'ahead';
      freeWidthM = columnWidthM;
    }

    return {
      clearestSide,
      freeWidthM: Math.round(freeWidthM * 10) / 10,
      occupiedColumns: occupied,
    };
  }
}
