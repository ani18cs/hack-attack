import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const sosContextSchema = z.object({
  description: z.string().max(200).describe('One-line neutral description of surroundings <= 20 words'),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.9),
});

export const sosContextGeminiSchema = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'Concise one-line neutral environmental context <= 20 words (e.g. "Third floor corridor near room 302, dimly lit hallway with closed doors"). NO personal identification or face descriptions.',
    },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['description'],
};

export function buildSosContextPrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  return `You generate emergency environmental context for a blind person who triggered SOS.
Provide a strictly neutral, factual, one-line summary of their physical surroundings in <= 20 words:
- Room or corridor type
- Nearest visible door numbers, exit signs, or landmarks
- Indoor or outdoor setting
CRITICAL PRIVACY DIRECTIVE: Do NOT identify, describe, or guess the identity of any faces or people.
Target language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toSosContextSummary(data: z.infer<typeof sosContextSchema>): string {
  return data.description.trim();
}
