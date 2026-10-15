import { Router, Request, Response } from 'express';
import type { HealthResponse } from '../types.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response): void => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const sarvamKey = process.env.SARVAM_API_KEY;

  const hasApiKey = !!geminiKey && geminiKey.trim() !== '' && !geminiKey.includes('PLACEHOLDER');
  const hasSarvamKey = !!sarvamKey && sarvamKey.trim() !== '' && !sarvamKey.includes('PLACEHOLDER');
  const mockVlm = process.env.MOCK_VLM === 'true';

  const response: HealthResponse = {
    ok: true,
    timestamp: Date.now(),
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    hasApiKey,
    hasSarvamKey,
    mockVlm,
  };

  res.json(response);
});
