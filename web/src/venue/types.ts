export interface VenueLandmark {
  id: string;
  name: string;
  x: number;
  y: number;
  cues: string[];
}

export interface VenueFloor {
  floor: number;
  landmarks: VenueLandmark[];
}

export interface VenuePack {
  id: string;
  name: string;
  floors: VenueFloor[];
}

export interface LocalizationResult {
  currentLandmarkId: string | null;
  confidence: number;
  floor: number;
}
