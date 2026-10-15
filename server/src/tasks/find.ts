import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const findSchema = z.object({
  found: z.boolean(),
  direction: z.enum(['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown']),
  distance: z.enum(['very-close', 'close', 'near', 'far']),
  gender: z.enum(['men', 'women', 'unisex', 'unknown']).optional(),
  cue: z.string().describe('Short spatial navigation cue, e.g. "Restroom sign, slightly left. Turn left a little."'),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const findGeminiSchema = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    direction: {
      type: 'string',
      enum: ['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown'],
    },
    distance: {
      type: 'string',
      enum: ['very-close', 'close', 'near', 'far'],
    },
    gender: {
      type: 'string',
      enum: ['men', 'women', 'unisex', 'unknown'],
    },
    cue: {
      type: 'string',
      description: 'Short spatial navigation guidance <= 20 words (e.g. "Restroom sign, slightly left. Turn left a little.")',
    },
    summary: {
      type: 'string',
      description: 'Spoken summary <= 25 words for the user',
    },
    confidence: { type: 'number' },
  },
  required: ['found', 'direction', 'distance', 'cue', 'summary'],
};

export function buildFindPrompt(req: AnalyzeRequest): string {
  const target = req.target || 'restroom';
  const lang = req.lang || 'en';

  return `You assist a blind user searching for a specific object or destination in the camera view.
Target to find: "${target}".

Guidelines for washroom/toilet/restroom:
- Recognize English text: WC, Toilet, Restroom, Washroom, Gents, Ladies, Men, Women.
- Recognize multilingual text (e.g., Hindi: शौचालय, Kannada: ಶೌಚಾಲಯ).
- Recognize male, female, or accessible wheelchair pictograms.
- Classify gender: men, women, unisex, or unknown.

If found:
- Specify spatial direction: left, slightly-left, ahead, slightly-right, right.
- Specify distance: very-close (<1m), close (1-3m), near (3-5m), far (>5m).
- Provide a concise cue under 20 words guiding the user's next movement.
- Provide a spoken summary <= 25 words in language: ${lang}.

If not found:
- set found: false, direction: "unknown", distance: "far", cue: "Target not in view. Pan your camera slowly.", summary: "${target} not visible. Try scanning around."

Output strictly valid JSON matching the schema.`;
}

export function toFindSummary(data: z.infer<typeof findSchema>, target?: string): string {
  if (data.summary && data.summary.trim()) {
    return data.summary.trim();
  }
  if (!data.found) {
    return `${target || 'Target'} not found. Try scanning around.`;
  }
  return data.cue || `${target || 'Target'} spotted ${data.direction.replace('-', ' ')}.`;
}
