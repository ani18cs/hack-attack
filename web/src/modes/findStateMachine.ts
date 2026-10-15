import type { Direction, DistanceBucket } from '../types';

export type FindState = 'IDLE' | 'SCANNING' | 'FOUND' | 'GUIDING' | 'ARRIVED' | 'NOT_FOUND';

export interface FindResult {
  found: boolean;
  direction: Direction;
  distance: DistanceBucket;
  confidence: number;
  cue?: string;
  gender?: string;
}

export interface FindCallbacks {
  onStateChange: (state: FindState) => void;
  onSpeak: (text: string, priority?: 'danger' | 'normal' | 'low') => void;
  onBeaconStart: (direction: Direction, distance: DistanceBucket) => void;
  onBeaconStop: () => void;
  onEarcon: (type: 'found' | 'success' | 'error') => void;
  onHaptic: (type: 'found') => void;
}

export const COCO_CLASSES = new Set([
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  'dining table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
]);

export class FindStateMachine {
  public state: FindState = 'IDLE';
  public target: string;
  private inFlight = false;
  private scanningStartTime = 0;
  private timeoutMs = 20000; // 20 seconds timeout
  private consecutiveVeryCloseCount = 0;
  private lastReportedDirection: Direction | null = null;
  private lastReportedDistance: DistanceBucket | null = null;
  private callbacks: FindCallbacks;

  constructor(target: string, callbacks: FindCallbacks, timeoutMs = 20000) {
    this.target = target.trim().toLowerCase();
    this.callbacks = callbacks;
    this.timeoutMs = timeoutMs;
  }

  public isCocoTarget(): boolean {
    return COCO_CLASSES.has(this.target);
  }

  public isInFlight(): boolean {
    return this.inFlight;
  }

  public setInFlight(inFlight: boolean): void {
    this.inFlight = inFlight;
  }

  public start(currentTime = Date.now()): void {
    this.state = 'SCANNING';
    this.scanningStartTime = currentTime;
    this.consecutiveVeryCloseCount = 0;
    this.lastReportedDirection = null;
    this.lastReportedDistance = null;
    this.inFlight = false;

    this.callbacks.onStateChange(this.state);
    this.callbacks.onSpeak(`Scanning for ${this.target}. Turn slowly.`, 'normal');
  }

  public stop(): void {
    this.state = 'IDLE';
    this.inFlight = false;
    this.callbacks.onBeaconStop();
    this.callbacks.onStateChange(this.state);
  }

  public tick(currentTime = Date.now()): void {
    if (this.state === 'SCANNING' || this.state === 'GUIDING') {
      if (currentTime - this.scanningStartTime >= this.timeoutMs) {
        this.state = 'NOT_FOUND';
        this.inFlight = false;
        this.callbacks.onBeaconStop();
        this.callbacks.onStateChange(this.state);
        this.callbacks.onSpeak(
          'Not found yet. Turn more or move forward and ask again.',
          'normal'
        );
      }
    }
  }

  public handleResult(result: FindResult): void {
    this.inFlight = false;

    if (this.state !== 'SCANNING' && this.state !== 'FOUND' && this.state !== 'GUIDING') {
      return;
    }

    if (!result.found) {
      return;
    }

    // High confidence: >= 0.6
    if (result.confidence >= 0.6) {
      if (this.state === 'SCANNING') {
        this.state = 'FOUND';
        this.callbacks.onStateChange(this.state);
        this.callbacks.onEarcon('found');
        this.callbacks.onHaptic('found');

        const cue = result.cue || `${this.target} spotted ${result.direction.replace('-', ' ')}.`;
        this.callbacks.onSpeak(cue, 'normal');

        // Transition to GUIDING and engage 3D spatial audio beacon
        this.state = 'GUIDING';
        this.callbacks.onStateChange(this.state);
        this.callbacks.onBeaconStart(result.direction, result.distance);
        this.lastReportedDirection = result.direction;
        this.lastReportedDistance = result.distance;
        this.consecutiveVeryCloseCount = result.distance === 'very-close' ? 1 : 0;
        return;
      }

      if (this.state === 'GUIDING') {
        this.callbacks.onBeaconStart(result.direction, result.distance);

        // Check if arrived: very-close for 2 consecutive checks
        if (result.distance === 'very-close') {
          this.consecutiveVeryCloseCount += 1;
          if (this.consecutiveVeryCloseCount >= 2) {
            this.state = 'ARRIVED';
            this.callbacks.onBeaconStop();
            this.callbacks.onStateChange(this.state);
            this.callbacks.onEarcon('success');
            this.callbacks.onSpeak('You have arrived.', 'normal');
            return;
          }
        } else {
          this.consecutiveVeryCloseCount = 0;
        }

        // Update aloud only on meaningful change in direction or distance
        const changed =
          result.direction !== this.lastReportedDirection ||
          result.distance !== this.lastReportedDistance;

        if (changed) {
          this.lastReportedDirection = result.direction;
          this.lastReportedDistance = result.distance;
          const updateMsg = `Now ${result.direction.replace('-', ' ')}, ${result.distance.replace('-', ' ')}.`;
          this.callbacks.onSpeak(updateMsg, 'normal');
        }
        return;
      }
    }

    // Medium/Cautious confidence: 0.35 to < 0.6
    if (result.confidence >= 0.35 && result.confidence < 0.6) {
      if (this.state === 'SCANNING') {
        const cautiousMsg = `I think that is a ${this.target} sign, but I'm not fully sure. Keep scanning.`;
        this.callbacks.onSpeak(cautiousMsg, 'normal');
      }
    }
  }
}
