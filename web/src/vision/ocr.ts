import { createWorker } from 'tesseract.js';
import { speech } from '../core/speech';
import type { ReadData } from '../types';

let workerPromise: ReturnType<typeof createWorker> | null = null;
let announcedOfflineOnce = false;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}

/**
 * Performs on-device fallback OCR using Tesseract.js when offline or server unreachable.
 * Announces "Offline mode, may be less accurate."
 */
export async function recognizeTextFallback(imageBase64: string): Promise<ReadData> {
  if (!announcedOfflineOnce) {
    speech.speak('Offline mode, may be less accurate.', { priority: 'normal' });
    announcedOfflineOnce = true;
  }

  try {
    const worker = await getWorker();
    const result = await worker.recognize(imageBase64);
    const rawText = result.data.text.trim();

    if (!rawText) {
      return { texts: [] };
    }

    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 1);

    const texts = lines.map((line) => {
      let kind: 'exit' | 'room' | 'store' | 'direction' | 'warning' | 'other' = 'other';
      const lower = line.toLowerCase();
      if (lower.includes('exit')) kind = 'exit';
      else if (lower.includes('room') || /\b\d{3,4}\b/.test(lower)) kind = 'room';
      else if (lower.includes('warning') || lower.includes('danger') || lower.includes('caution')) kind = 'warning';

      let arrow: 'left' | 'right' | 'up' | 'down' | undefined = undefined;
      if (lower.includes('->') || lower.includes('right')) arrow = 'right';
      else if (lower.includes('<-') || lower.includes('left')) arrow = 'left';

      return {
        text: line,
        kind,
        direction: 'ahead' as const,
        arrow,
      };
    });

    return { texts };
  } catch (err) {
    console.error('Tesseract fallback OCR error:', err);
    return { texts: [] };
  }
}
