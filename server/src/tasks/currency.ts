import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const currencySchema = z.object({
  denomination: z.union([
    z.literal(10),
    z.literal(20),
    z.literal(50),
    z.literal(100),
    z.literal(200),
    z.literal(500),
    z.literal(2000),
    z.null(),
  ]),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0),
});

export const currencyGeminiSchema = {
  type: 'object',
  properties: {
    denomination: {
      type: 'integer',
      enum: [10, 20, 50, 100, 200, 500, 2000],
    },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['denomination'],
};

export function buildCurrencyPrompt(req: AnalyzeRequest): string {
  return `Identify the Indian Rupee banknote denomination (10, 20, 50, 100, 200, 500, 2000). If unclear, set null.`;
}

export function toCurrencySummary(data: z.infer<typeof currencySchema>): string {
  if (data.denomination === null) return 'Could not identify currency note.';
  return `${data.denomination} rupee note.`;
}
