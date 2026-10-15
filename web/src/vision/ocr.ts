import { createWorker } from 'tesseract.js';

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}

/**
 * Performs on-device fallback OCR using Tesseract.js.
 */
export async function recognizeTextFallback(imageBase64: string): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(imageBase64);
    return result.data.text.trim();
  } catch (err) {
    console.error('Tesseract fallback OCR error:', err);
    throw err;
  }
}
