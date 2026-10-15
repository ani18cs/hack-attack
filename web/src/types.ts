export type Direction =
  | 'left'
  | 'slightly-left'
  | 'ahead'
  | 'slightly-right'
  | 'right'
  | 'unknown';

export type DistanceBucket = 'very-close' | 'close' | 'near' | 'far';

export type SpeakPriority = 'danger' | 'normal' | 'low';

export type Verbosity = 'quiet' | 'normal' | 'detailed';

export interface SceneObject {
  label: string;
  score: number;
  direction: Direction;
  distance: DistanceBucket;
  danger: boolean;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export type VisionTask =
  | 'describe'
  | 'read'
  | 'find'
  | 'currency'
  | 'waste'
  | 'label'
  | 'hazard'
  | 'verify_landmark'
  | 'sos_context';

export interface AnalyzeRequest {
  task: VisionTask;
  image: string; // Base64 JPEG data
  lang?: string;
  target?: string;
  context?: any;
}

export interface HazardAlert {
  type: string;
  direction: Direction;
  urgency: 'low' | 'medium' | 'high';
}

export interface AnalyzeResponse<T = any> {
  task: VisionTask;
  ok: boolean;
  summary: string; // Spoken text (<= 25 words)
  confidence: number; // 0 to 1
  data: T;
  hazards?: HazardAlert[];
  error?: string;
  latencyMs?: number;
}

// Task-specific data payloads:
export interface DescribeData {
  items: Array<{
    label: string;
    direction: Direction;
    distance: DistanceBucket;
  }>;
}

export interface ReadTextItem {
  text: string;
  kind: 'exit' | 'room' | 'store' | 'direction' | 'warning' | 'other';
  direction: Direction;
  arrow?: 'left' | 'right' | 'up' | 'down';
}

export interface ReadData {
  texts: ReadTextItem[];
}

export type GenderKind = 'men' | 'women' | 'unisex' | 'unknown';

export interface FindData {
  found: boolean;
  direction: Direction;
  distance: DistanceBucket;
  gender?: GenderKind;
  cue: string;
}

export interface CurrencyData {
  denomination: 10 | 20 | 50 | 100 | 200 | 500 | 2000 | null;
}

export interface WasteData {
  item: string;
  category: 'wet' | 'dry' | 'recyclable' | 'hazardous' | 'e-waste' | 'unknown';
  binHint: string;
}

export interface LabelData {
  product: string;
  expiry?: string;
  allergens: string[];
  legible: boolean;
}

export interface VerifyLandmarkData {
  matches: boolean;
  evidence: string;
}

export interface SosContextData {
  description: string;
}

export interface HazardData {
  hazards: HazardAlert[];
}

// Health check contract
export interface HealthResponse {
  ok: boolean;
  timestamp?: number;
  model?: string;
  hasApiKey?: boolean;
  hasSarvamKey?: boolean;
  mockVlm?: boolean;
}

export type VoiceIntent =
  | 'AROUND_ME'
  | 'READ'
  | 'FIND'
  | 'CURRENCY'
  | 'WASTE'
  | 'LABEL'
  | 'HAZARD'
  | 'NAVIGATE'
  | 'SOS'
  | 'OBSTACLE_ON'
  | 'OBSTACLE_OFF'
  | 'VERBOSITY_QUIET'
  | 'VERBOSITY_NORMAL'
  | 'VERBOSITY_DETAILED'
  | 'LANGUAGE_EN'
  | 'LANGUAGE_HI'
  | 'LANGUAGE_KN'
  | 'STOP'
  | 'REPEAT'
  | 'HELP'
  | 'PRIVACY'
  | 'UNKNOWN';

export type ActiveMode =
  | 'idle'
  | 'around_me'
  | 'read'
  | 'find'
  | 'currency'
  | 'waste'
  | 'label'
  | 'hazard'
  | 'sos'
  | 'navigate'
  | 'obstacle_alert';
