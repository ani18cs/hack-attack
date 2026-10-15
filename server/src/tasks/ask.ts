import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const askSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
});

export const askGeminiSchema = {
  type: 'object',
  properties: {
    answer: {
      type: 'string',
      description:
        'Concise spoken answer in 25 words or fewer based strictly on visible features. Use left/ahead/right spatial terms. Say "I\'m not sure" if ambiguous or uncertain.',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score between 0.0 and 1.0.',
    },
  },
  required: ['answer', 'confidence'],
};

export function buildAskPrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  const question = (typeof req.context === 'string' ? req.context : req.context?.question) || 'What is in front of me?';

  return `You assist a blind user asking a specific question about what is in front of their phone camera.
Question: "${question}"
Rules:
- Answer the question in 25 words or fewer.
- Use only what is clearly visible in the image.
- Use left/ahead/right spatial wording when referring to locations.
- Say "I'm not sure" if you are uncertain, details are blurry, or the item is not visible.
- Never invent text or details.
- Output strictly in language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toAskSummary(data: z.infer<typeof askSchema>): string {
  if (data.answer && data.answer.trim()) {
    return data.answer.trim();
  }
  return "I'm not sure about what is visible.";
}
