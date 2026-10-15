import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const labelSchema = z.object({
  product: z.string(),
  expiry: z.string().optional(),
  allergens: z.array(z.string()),
  legible: z.boolean(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0),
});

export const labelGeminiSchema = {
  type: 'object',
  properties: {
    product: { type: 'string' },
    expiry: { type: 'string' },
    allergens: {
      type: 'array',
      items: { type: 'string' },
    },
    legible: { type: 'boolean' },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['product', 'allergens', 'legible'],
};

export function buildLabelPrompt(req: AnalyzeRequest): string {
  return `Read packaging product label. If details cannot be clearly read, set legible: false. Never guess expiry or allergens.`;
}

export function toLabelSummary(data: z.infer<typeof labelSchema>): string {
  if (!data.legible) return 'Product label is not clearly legible. Please hold closer.';
  let res = `${data.product}.`;
  if (data.expiry) res += ` Expiry: ${data.expiry}.`;
  if (data.allergens.length > 0) res += ` Contains: ${data.allergens.join(', ')}.`;
  return res;
}
