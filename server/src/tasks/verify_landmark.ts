import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const verifyLandmarkSchema = z.object({
  matches: z.boolean(),
  evidence: z.string(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0),
});

export const verifyLandmarkGeminiSchema = {
  type: 'object',
  properties: {
    matches: { type: 'boolean' },
    evidence: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['matches', 'evidence'],
};

export function buildVerifyLandmarkPrompt(req: AnalyzeRequest): string {
  const target = req.target || 'expected landmark';
  return `Verify whether the scene matches the expected landmark: "${target}". Provide concrete visual evidence.`;
}

export function toVerifyLandmarkSummary(data: z.infer<typeof verifyLandmarkSchema>): string {
  return data.matches
    ? `Landmark confirmed: ${data.evidence}`
    : `Landmark not verified: ${data.evidence}`;
}
