import { z } from 'zod';
import type { DescribeData, AnalyzeRequest } from '../types.js';

export const describeSchema = z.object({
  summary: z.string().optional(),
  items: z.array(
    z.object({
      label: z.string(),
      direction: z.enum(['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown']),
      distance: z.enum(['very-close', 'close', 'near', 'far']),
    })
  ).max(5),
  confidence: z.number().min(0).max(1).optional(),
});

export const describeGeminiSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Spoken summary <= 25 words with positions (e.g. "A table straight ahead, two chairs to your right, a door on the left.")',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          direction: {
            type: 'string',
            enum: ['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown'],
          },
          distance: {
            type: 'string',
            enum: ['very-close', 'close', 'near', 'far'],
          },
        },
        required: ['label', 'direction', 'distance'],
      },
    },
    confidence: { type: 'number' },
  },
  required: ['summary', 'items'],
};

export function buildDescribePrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  return `Analyze this camera frame for a visually impaired user.
Report only what is in the walking path ahead; ignore the periphery.
Identify up to 5 navigation-relevant items (doors, stairs, people, furniture, obstacles).
For each item, give its label, spatial direction (left, slightly-left, ahead, slightly-right, right), and distance (very-close, close, near, far).
Provide a concise spoken summary <= 25 words mentioning key items and their positions.
Language for spoken summary: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toDescribeSummary(data: z.infer<typeof describeSchema>): string {
  if (data.summary && data.summary.trim()) {
    return data.summary.trim();
  }
  if (!data.items || data.items.length === 0) {
    return 'Area appears clear ahead.';
  }
  return data.items
    .map((item) => `${item.label} ${item.direction.replace('-', ' ')}`)
    .slice(0, 3)
    .join(', ') + '.';
}
