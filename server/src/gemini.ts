import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('PLACEHOLDER')) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export function cleanBase64(raw: string): { data: string; mimeType: string } {
  let mimeType = 'image/jpeg';
  let data = raw;

  if (raw.startsWith('data:')) {
    const parts = raw.split(';base64,');
    if (parts.length === 2) {
      mimeType = parts[0].replace('data:', '');
      data = parts[1];
    }
  }

  return { data, mimeType };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export interface GeminiGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  imageBase64: string;
  responseSchema?: any;
  timeoutMs?: number;
}

/**
 * Robust Gemini wrapper using @google/genai:
 * - JSON mode & responseSchema support
 * - 10-second timeout
 * - Exactly one retry on failure
 * - Strictly never logs image payloads or API keys
 */
export async function generateVisionJSON<T = any>(options: GeminiGenerateOptions): Promise<T> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in server/.env');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const timeoutMs = options.timeoutMs ?? 10000;
  const { data, mimeType } = cleanBase64(options.imageBase64);

  const executeCall = async (): Promise<T> => {
    const config: any = {
      responseMimeType: 'application/json',
    };

    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    if (options.responseSchema) {
      config.responseSchema = options.responseSchema;
    }

    const contents = [
      {
        role: 'user',
        parts: [
          { text: options.prompt },
          {
            inlineData: {
              data,
              mimeType,
            },
          },
        ],
      },
    ];

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents,
      config,
    });

    const response = await withTimeout(generatePromise, timeoutMs);
    const rawText = response.text;

    if (!rawText || rawText.trim() === '') {
      throw new Error('Gemini returned an empty response');
    }

    try {
      return JSON.parse(rawText) as T;
    } catch (parseErr: any) {
      throw new Error(`Failed to parse Gemini JSON output: ${parseErr.message}`);
    }
  };

  // Execute with 1 retry on error/timeout
  try {
    return await executeCall();
  } catch (firstError: any) {
    console.warn(`[Gemini] First attempt failed (${firstError.message}). Retrying once...`);
    try {
      return await executeCall();
    } catch (secondError: any) {
      console.error(`[Gemini] Retry failed: ${secondError.message}`);
      throw secondError;
    }
  }
}
