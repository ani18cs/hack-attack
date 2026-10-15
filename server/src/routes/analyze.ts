import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AnalyzeResponse, VisionTask } from '../types.js';
import { generateVisionJSON } from '../gemini.js';
import { MOCK_FIXTURES } from '../mock/fixtures.js';
import { TASK_REGISTRY } from '../tasks/registry.js';

export const analyzeRouter = Router();

// Rate limiter: 30 requests per minute per IP for vision analysis
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    task: 'describe',
    ok: false,
    summary: 'Too many requests. Please slow down and try again in a moment.',
    confidence: 0,
    data: null,
    error: 'Rate limit exceeded (max 30 requests/min)',
  },
});

const analyzeRequestSchema = z.object({
  task: z.enum([
    'describe',
    'read',
    'find',
    'currency',
    'waste',
    'label',
    'hazard',
    'verify_landmark',
    'sos_context',
  ]),
  image: z.string().min(1, 'Image data is required.'),
  lang: z.string().optional().default('en'),
  target: z.string().optional(),
  context: z.any().optional(),
});

analyzeRouter.post('/analyze', analyzeLimiter, async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  // 1. Zod input validation
  const parseResult = analyzeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    res.status(400).json({
      task: req.body?.task || 'describe',
      ok: false,
      summary: 'Invalid request data provided.',
      confidence: 0,
      data: null,
      error: `Validation failed: ${errorDetails}`,
      latencyMs: Date.now() - startTime,
    } satisfies AnalyzeResponse);
    return;
  }

  const { task, image, lang, target, context } = parseResult.data;

  // 2. MOCK_VLM offline development / demo mode
  const isMock = process.env.MOCK_VLM === 'true';
  if (isMock) {
    const fixture = MOCK_FIXTURES[task as VisionTask];
    res.json({
      task: task as VisionTask,
      ok: fixture.ok,
      summary: fixture.summary,
      confidence: fixture.confidence,
      data: fixture.data,
      hazards: fixture.hazards || [],
      latencyMs: Date.now() - startTime,
    } satisfies AnalyzeResponse);
    return;
  }

  // 3. Look up preset in registry
  const preset = TASK_REGISTRY[task as VisionTask];
  if (!preset) {
    res.status(400).json({
      task: task as VisionTask,
      ok: false,
      summary: 'Unknown vision task requested.',
      confidence: 0,
      data: null,
      error: `Task preset "${task}" does not exist in registry.`,
      latencyMs: Date.now() - startTime,
    } satisfies AnalyzeResponse);
    return;
  }

  // 4. Scaffolded task check: return { ok: false, error: 'not implemented' }
  if (!preset.implemented) {
    res.json({
      task: task as VisionTask,
      ok: false,
      summary: `${task.replace('_', ' ')} is not implemented yet.`,
      confidence: 0,
      data: null,
      error: 'not implemented',
      latencyMs: Date.now() - startTime,
    } satisfies AnalyzeResponse);
    return;
  }

  // 5. Execute Gemini call
  try {
    const prompt = preset.buildPrompt({ task, image, lang, target, context });
    const rawResult = await generateVisionJSON({
      prompt,
      systemInstruction: preset.systemPrompt,
      imageBase64: image,
      responseSchema: preset.geminiSchema,
      timeoutMs: 10000,
    });

    // Validate result against task Zod schema
    const schemaValidation = preset.schema.safeParse(rawResult);
    const data = schemaValidation.success ? schemaValidation.data : rawResult;
    const summary = preset.toSummary(data, { task, image, lang, target, context });
    const confidence = typeof (data as any)?.confidence === 'number' ? (data as any).confidence : 0.85;

    res.json({
      task: task as VisionTask,
      ok: true,
      summary,
      confidence,
      data,
      hazards: (data as any)?.hazards || [],
      latencyMs: Date.now() - startTime,
    } satisfies AnalyzeResponse);
  } catch (error: any) {
    console.error(`[SightLine Analyze Error] Task ${task}:`, error.message);

    // Spoken-friendly fallback messaging
    let spokenSummary = 'I had trouble analyzing the view. Please try holding the phone steady.';
    if (task === 'read') spokenSummary = 'Could not read any signs right now.';
    if (task === 'find') spokenSummary = `Could not find ${target || 'target'} right now.`;

    res.status(500).json({
      task: task as VisionTask,
      ok: false,
      summary: spokenSummary,
      confidence: 0,
      data: null,
      error: error.message || 'Vision analysis failed',
      latencyMs: Date.now() - startTime,
    } satisfies AnalyzeResponse);
  }
});
