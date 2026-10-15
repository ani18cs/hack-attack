import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

export const readSchema = z.object({
  summary: z.string().optional(),
  texts: z.array(
    z.object({
      text: z.string(),
      kind: z.enum(['exit', 'room', 'store', 'direction', 'warning', 'other']),
      direction: z.enum(['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown']),
      arrow: z.enum(['left', 'right', 'up', 'down']).optional(),
    })
  ),
  confidence: z.number().min(0).max(1).optional(),
});

export const readGeminiSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Spoken summary <= 25 words. Fuse directional arrows with text (e.g. "Exit, arrow points right.")',
    },
    texts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['exit', 'room', 'store', 'direction', 'warning', 'other'],
          },
          direction: {
            type: 'string',
            enum: ['left', 'slightly-left', 'ahead', 'slightly-right', 'right', 'unknown'],
          },
          arrow: {
            type: 'string',
            enum: ['left', 'right', 'up', 'down'],
          },
        },
        required: ['text', 'kind', 'direction'],
      },
    },
    confidence: { type: 'number' },
  },
  required: ['summary', 'texts'],
};

export function buildReadPrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  return `You assist a blind user with reading signs and text in their environment.
Transcribe clearly legible text on signs, doors, walls, or boards.
Classify each item as: exit, room, store, direction, warning, or other.
Detect its direction (left, slightly-left, ahead, slightly-right, right).
CRITICAL: Fuse any nearby directional arrows with the sign text (e.g., if an arrow points right next to EXIT, indicate arrow: "right" and state "Exit, arrow points right").
Never invent or hallucinate text you cannot clearly read.
Target spoken language: ${lang}.
Provide a spoken summary <= 25 words. Output strictly valid JSON matching the schema.`;
}

export function toReadSummary(data: z.infer<typeof readSchema>): string {
  if (data.summary && data.summary.trim()) {
    return data.summary.trim();
  }
  if (!data.texts || data.texts.length === 0) {
    return 'No legible text detected.';
  }
  const first = data.texts[0];
  if (first.arrow) {
    return `${first.text}, arrow points ${first.arrow}.`;
  }
  return `Sign reads: ${first.text}.`;
}
