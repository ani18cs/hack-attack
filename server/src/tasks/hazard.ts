import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const hazardItemSchema = z.object({
  type: z.string().describe('Hazard type (e.g. "Down stairs", "Wet floor", "Open drain", "Glass door", "Low hanging cable", "Pothole")'),
  direction: z.enum(['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown']),
  urgency: z.enum(['high', 'medium']),
});

export const hazardSchema = z.object({
  hazards: z.array(hazardItemSchema),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
});

export const hazardGeminiSchema = {
  type: 'object',
  properties: {
    hazards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Specific critical hazard: stairs, wet floor, glass doors, open drains, potholes, low overhead obstacles, vehicles, stray animals, two-wheelers on footpaths',
          },
          direction: {
            type: 'string',
            enum: ['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown'],
          },
          urgency: {
            type: 'string',
            enum: ['high', 'medium'],
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
  const lang = req.lang || 'en';
  return `You perform a critical safety scan for a blind pedestrian.
Report only what is in the walking path ahead; ignore the periphery.
Scan the forward walking path for dangerous physical hazards:
- Downward stairs or drop-offs
- Wet or slippery floors
- Transparent glass doors or unmarked panes
- Open drains, manholes, or street potholes
- Low-hanging overhead cables, tree branches, or awnings
- Moving vehicles or two-wheelers on pedestrian paths
- Stray dogs, cattle, or animals blocking the path

STRICT RULE: Report only what is clearly visible; do not guess.
Assign urgency:
- "high": immediate fall or collision risk in the direct path
- "medium": hazard nearby or off to the side

Target language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toHazardSummary(data: z.infer<typeof hazardSchema>): string {
  // Only speak high-urgency hazards per spec
  const highHazards = data.hazards.filter((h) => h.urgency === 'high');
  if (highHazards.length === 0) {
    return 'Path ahead appears clear of major hazards.';
  }

  const primary = highHazards[0];
  const dir = primary.direction === 'ahead' ? 'ahead' : `on your ${primary.direction.replace('-', ' ')}`;
  return `Caution: ${primary.type} ${dir}.`;
}
