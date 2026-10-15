export type Direction = 'left' | 'ahead' | 'right' | 'unknown' | 'slightly left' | 'slightly right';

export type DistanceBucket = 'very close' | 'close' | 'a few steps away' | 'far';

export type SpeakPriority = 'danger' | 'normal' | 'low';

export type TextKind = 'exit' | 'room' | 'store' | 'direction' | 'warning' | 'other';

export type GenderKind = 'men' | 'women' | 'unisex' | 'unknown';

export interface SceneObject {
  label: string;
  direction: Direction;
  distance: DistanceBucket;
  danger: boolean;
  score?: number;
  bbox?: [number, number, number, number]; // [x, y, width, height] normalized or pixel
}

export interface DescribeResponse {
  summary: string;
  objects: Array<{
    label: string;
    direction: Direction;
    distance: DistanceBucket;
  }>;
  error?: string;
}

export interface ReadResponse {
  summary: string;
  texts: Array<{
    text: string;
    kind: TextKind;
    direction?: Direction;
  }>;
  error?: string;
}

export interface FindResponse {
  found: boolean;
  direction: Direction;
  gender: GenderKind;
  confidence: number;
  cue: string;
  error?: string;
}

export interface HealthResponse {
  ok: boolean;
  timestamp?: number;
  model?: string;
}

export type VoiceIntent =
  | 'AROUND_ME'
  | 'READ'
  | 'FIND_WASHROOM'
  | 'OBSTACLE_ON'
  | 'OBSTACLE_OFF'
  | 'FIND_ITEM'
  | 'STOP'
  | 'HELP'
  | 'REPEAT'
  | 'UNKNOWN';

export type ActiveMode = 'idle' | 'around_me' | 'read' | 'find_washroom' | 'obstacle_alert';
