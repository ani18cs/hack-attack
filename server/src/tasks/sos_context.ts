import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const sosContextSchema = z.object({
  description: z.string(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0),
});

export const sosContextGeminiSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['description'],
};

export function buildSosContextPrompt(req: AnalyzeRequest): string {
  return `Generate concise emergency situation context from this camera view: current room/area type, signage, identifiable markers, potential hazards, and presence of bystanders.`;
}

export function toSosContextSummary(data: z.infer<typeof sosContextSchema>): string {
  return data.description.slice(0, 150);
}
