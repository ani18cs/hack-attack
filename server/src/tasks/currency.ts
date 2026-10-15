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
  unclearReason: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
});

export const currencyGeminiSchema = {
  type: 'object',
  properties: {
    denomination: {
      type: 'integer',
      enum: [10, 20, 50, 100, 200, 500, 2000],
      description: 'The numeric denomination of the Indian Rupee banknote, or null if not identifiable.',
    },
    unclearReason: {
      type: 'string',
      description: 'Reason if note cannot be identified with high confidence.',
    },
    summary: {
      type: 'string',
      description: 'Spoken summary <= 15 words.',
    },
    confidence: { type: 'number' },
  },
  required: ['denomination'],
};

export function buildCurrencyPrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  return `You assist a blind user in identifying Indian currency banknotes.
Analyze this camera image. Inspect numerals, color (10 chocolate brown, 20 greenish-yellow, 50 cyan, 100 lavender, 200 bright orange, 500 stone grey, 2000 magenta), and Mahatma Gandhi portrait watermark.
Valid denominations: 10, 20, 50, 100, 200, 500, 2000.
STRICT RULE: If the note is folded, blurry, partially cropped, or cannot be identified with complete certainty, return denomination: null and set summary to: "I can't tell, hold the note flat and closer."
Never guess or hallucinate currency denominations.
Target language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export const DENOMINATION_WORDS: Record<number, string> = {
  10: 'Ten',
  20: 'Twenty',
  50: 'Fifty',
  100: 'One hundred',
  200: 'Two hundred',
  500: 'Five hundred',
  2000: 'Two thousand',
};

export function toCurrencySummary(data: z.infer<typeof currencySchema>): string {
  if (data.denomination === null || data.denomination === undefined) {
    return "I can't tell, hold the note flat and closer.";
  }
  const word = DENOMINATION_WORDS[data.denomination] || String(data.denomination);
  return `${word} rupee note.`;
}
