import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const verifyLandmarkSchema = z.object({
  matches: z.boolean(),
  evidence: z.string().describe('Visual text, sign, or landmark cue that confirms or denies the match'),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
});

export const verifyLandmarkGeminiSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'boolean',
      description: 'True if the scene visually matches the expected landmark or checkpoint signs',
    },
    evidence: {
      type: 'string',
      description: 'Specific visible text or landmark object that confirms or refutes the checkpoint',
    },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['matches', 'evidence'],
};

export function buildVerifyLandmarkPrompt(req: AnalyzeRequest): string {
  const target = req.target || 'expected landmark';
  const context = req.context ? JSON.stringify(req.context) : '';
  const lang = req.lang || 'en';

  return `You verify navigation checkpoints for an indoor pedestrian assistant.
Expected landmark or destination: "${target}".
Expected sign text or features: ${context}.
Inspect the scene for matching signage, room numbers, doors, or architectural cues.
Return matches: true if clearly verified, false otherwise.
Provide concise evidence in <= 15 words.
Target language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toVerifyLandmarkSummary(data: z.infer<typeof verifyLandmarkSchema>, req?: AnalyzeRequest): string {
  if (data.matches) {
    return `${req?.target || 'Landmark'} verified: ${data.evidence}.`;
  }
  return `Cannot confirm landmark: ${data.evidence || 'Not visible in view'}.`;
}
