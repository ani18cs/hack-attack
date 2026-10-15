import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const wasteSchema = z.object({
  item: z.string(),
  category: z.enum(['wet', 'dry', 'recyclable', 'hazardous', 'e-waste', 'unknown']),
  binHint: z.string(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0),
});

export const wasteGeminiSchema = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    category: {
      type: 'string',
      enum: ['wet', 'dry', 'recyclable', 'hazardous', 'e-waste', 'unknown'],
    },
    binHint: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['item', 'category', 'binHint'],
};

export function buildWastePrompt(req: AnalyzeRequest): string {
  return `Identify the waste item and classify it into wet, dry, recyclable, hazardous, or e-waste. Provide bin recommendation.`;
}

export function toWasteSummary(data: z.infer<typeof wasteSchema>): string {
  return `${data.item}. Put in ${data.binHint}.`;
}
