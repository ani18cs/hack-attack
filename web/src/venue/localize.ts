import { Landmark, LocalizationResult, VenuePack } from './types';

/**
 * Normalizes input text for fuzzy token/alias matching.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches a voice transcript against landmarks in the venue pack.
 * Supports English aliases, Hindi/Kannada regional names, and common prefix phrases.
 */
export function matchLandmarkByVoice(
  transcript: string,
  venue: VenuePack
): Landmark | null {
  const clean = normalize(transcript);

  // Strip common conversational carrier phrases
  const stripped = clean
    .replace(/^(?:i am|i'm|im|we are|we're|standing|located)\s+(?:at|near|in|by|inside)?\s+(?:the|a)?\s+/i, '')
    .replace(/^(?:take me to|navigate to|go to|at the|near the)\s+/i, '')
    .trim();

  let bestMatch: Landmark | null = null;
  let highestScore = 0;

  for (const landmark of venue.landmarks) {
    const candidates = [
      landmark.id,
      landmark.name,
      ...landmark.aliases,
      landmark.names?.hi,
      landmark.names?.kn,
    ]
      .filter((c): c is string => Boolean(c))
      .map(normalize);

    for (const cand of candidates) {
      if (stripped === cand || clean === cand) {
        return landmark; // Exact match
      }
      if (clean.includes(cand) || stripped.includes(cand)) {
        const score = cand.length;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = landmark;
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Matches a scanned QR code text against landmarks (e.g., "LM-ENTRANCE" -> entrance).
 */
export function matchLandmarkByQr(
  qrCode: string,
  venue: VenuePack
): Landmark | null {
  const clean = qrCode.trim().toUpperCase();
  for (const landmark of venue.landmarks) {
    if (landmark.qr && landmark.qr.toUpperCase() === clean) {
      return landmark;
    }
    if (clean === landmark.id.toUpperCase() || clean.includes(landmark.id.toUpperCase())) {
      return landmark;
    }
  }
  return null;
}

/**
 * Matches visible OCR sign text tokens against landmark signText definitions.
 */
export function matchLandmarkBySignText(
  detectedSigns: string[],
  venue: VenuePack
): { landmark: Landmark; evidence: string } | null {
  const combinedSigns = detectedSigns.map(normalize).join(' ');

  for (const landmark of venue.landmarks) {
    for (const sign of landmark.signText) {
      const cleanSign = normalize(sign);
      if (cleanSign && combinedSigns.includes(cleanSign)) {
        return {
          landmark,
          evidence: `Matched sign text: "${sign}"`,
        };
      }
    }
  }
  return null;
}

/**
 * Scans video element or image source for QR codes using BarcodeDetector API if available.
 */
export async function detectQrFromCanvasOrVideo(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap
): Promise<string | null> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    return null;
  }

  try {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
    const codes = await detector.detect(source);
    if (codes && codes.length > 0 && codes[0].rawValue) {
      return codes[0].rawValue;
    }
  } catch (err) {
    console.warn('BarcodeDetector error:', err);
  }
  return null;
}

/**
 * High-level localization resolver trying voice, QR, and visual sign recognition.
 */
export async function localizeUser(options: {
  voiceTranscript?: string;
  qrCode?: string;
  detectedSigns?: string[];
  venue: VenuePack;
}): Promise<LocalizationResult> {
  const { voiceTranscript, qrCode, detectedSigns, venue } = options;

  // 1. QR Code match (highest confidence)
  if (qrCode) {
    const qrMatch = matchLandmarkByQr(qrCode, venue);
    if (qrMatch) {
      return {
        landmarkId: qrMatch.id,
        landmark: qrMatch,
        confidence: 0.99,
        method: 'qr',
        evidence: `QR Code: ${qrCode}`,
      };
    }
  }

  // 2. Voice match
  if (voiceTranscript) {
    const voiceMatch = matchLandmarkByVoice(voiceTranscript, venue);
    if (voiceMatch) {
      return {
        landmarkId: voiceMatch.id,
        landmark: voiceMatch,
        confidence: 0.9,
        method: 'voice',
        evidence: `Voice: "${voiceTranscript}"`,
      };
    }
  }

  // 3. Visual Sign match
  if (detectedSigns && detectedSigns.length > 0) {
    const signMatch = matchLandmarkBySignText(detectedSigns, venue);
    if (signMatch) {
      return {
        landmarkId: signMatch.landmark.id,
        landmark: signMatch.landmark,
        confidence: 0.85,
        method: 'visual_sign',
        evidence: signMatch.evidence,
      };
    }
  }

  return {
    landmarkId: null,
    landmark: null,
    confidence: 0,
    method: 'voice',
  };
}
