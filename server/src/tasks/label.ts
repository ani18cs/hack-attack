import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const labelSchema = z.object({
  product: z.string().describe('Extracted product or medicine name'),
  isMedicine: z.boolean().default(false),
  expiry: z.string().nullable().optional(),
  allergens: z.array(z.string()).default([]),
  legible: z.boolean().describe('False if label, date, or text is blurry or partially obscured'),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
});

export const labelGeminiSchema = {
  type: 'object',
  properties: {
    product: { type: 'string' },
    isMedicine: { type: 'boolean', description: 'Whether this is a pharmaceutical, pill, tablet, or medicine package' },
    expiry: { type: 'string', description: 'Exact expiry date printed, or null if illegible/unseen' },
    allergens: {
      type: 'array',
      items: { type: 'string' },
      description: 'Listed allergen ingredients (e.g. peanuts, milk, soy, gluten)',
    },
    legible: {
      type: 'boolean',
      description: 'STRICT: false if any critical field (especially expiry date) is cut off, blurry, or missing.',
    },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['product', 'isMedicine', 'allergens', 'legible'],
};

export function buildLabelPrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  return `You assist a visually impaired user in reading food packaging and medicine labels.
SAFETY DIRECTIVE:
1. Extract product name, printed expiry date, and allergens.
2. REFUSE TO GUESS: If the print is partially hidden, blurry, faded, or cut off, set legible: false.
3. NEVER guess, estimate, or infer expiry dates, dosages, or allergen warnings.
4. If this is a medicine (tablets, cough syrup, blister pack, ointment), set isMedicine: true.
Target language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toLabelSummary(data: z.infer<typeof labelSchema>): string {
  if (!data.legible) {
    return "I can't read that clearly. Please ask someone to check, especially the expiry date.";
  }

  const parts: string[] = [];

  // Read allergens first for immediate food safety
  if (data.allergens && data.allergens.length > 0) {
    parts.push(`Allergens: ${data.allergens.join(', ')}.`);
  }

  parts.push(data.product);

  if (data.expiry) {
    parts.push(`Expires ${data.expiry}.`);
  } else {
    parts.push('Expiry date not visible.');
  }

  if (data.isMedicine) {
    parts.push('Please verify medicine details with a person.');
  }

  return parts.join(' ');
}
