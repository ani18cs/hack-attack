import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const hazardSchema = z.object({
  hazards: z.array(
    z.object({
      type: z.string(),
      direction: z.enum(['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown']),
      urgency: z.enum(['low', 'medium', 'high']),
    })
  ),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0),
});

export const hazardGeminiSchema = {
  type: 'object',
  properties: {
    hazards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          direction: {
            type: 'string',
            enum: ['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown'],
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
        },
        required: ['type', 'direction', 'urgency'],
      },
    },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['hazards'],
};

export function buildHazardPrompt(req: AnalyzeRequest): string {
  return `Scan specifically for critical pedestrian hazards: downward stairs, drop-offs, open manholes, low-hanging cables, wet slippery floors, construction barricades.`;
}

export function toHazardSummary(data: z.infer<typeof hazardSchema>): string {
  if (data.hazards.length === 0) return 'No immediate hazards detected.';
  const top = data.hazards[0];
  return `Caution: ${top.type} ${top.direction.replace('-', ' ')}.`;
}
