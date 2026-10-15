import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getGeminiClient } from '../gemini.js';
import {
  ALLOWED_TOOLS,
  ROUTER_FUNCTION_DECLARATIONS,
  ROUTER_SYSTEM_INSTRUCTION,
  RouterTool,
} from '../prompts/router.js';

export const askRouter = Router();

// Rate Limiter: 20 requests per minute per IP for ask routing
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    tool: 'clarify',
    args: { question: 'Please slow down and ask again in a moment.' },
    confidence: 0,
    latencyMs: 0,
    source: 'gemini',
    error: 'Rate limit exceeded (max 20 requests/min)',
  },
});

export const askRequestSchema = z.object({
  transcript: z.string().min(1).max(300),
  lang: z.enum(['en', 'hi', 'kn']).optional().default('en'),
  state: z
    .object({
      activeTool: z.string().nullable().optional(),
      online: z.boolean().optional().default(true),
      lastTool: z.string().optional(),
      lastAnswerSummary: z.string().optional(),
      venue: z
        .object({
          id: z.string().optional(),
          currentLandmarkId: z.string().optional(),
          destinations: z.array(z.string()).optional().default([]),
        })
        .optional(),
    })
    .optional()
    .default({ activeTool: null, online: true }),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(300),
      })
    )
    .max(3)
    .optional(),
});

export interface AskRouterResponse {
  ok: boolean;
  tool: RouterTool;
  args: Record<string, any>;
  speechPrefix?: string;
  confidence: number;
  latencyMs: number;
  source: 'gemini' | 'mock';
  error?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Router request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Deterministic mock fixtures when MOCK_VLM=true for unit tests and local mock development.
 */
function getMockRouterResponse(
  transcript: string,
  destinations: string[]
): { tool: RouterTool; args: Record<string, any>; confidence: number; speechPrefix?: string } {
  const lower = transcript.toLowerCase();

  if (lower.includes('emergency') || lower.includes('sos')) {
    return { tool: 'trigger_sos', args: {}, confidence: 1.0, speechPrefix: 'SOS' };
  }
  if (lower.includes('stop')) {
    return { tool: 'stop_current', args: {}, confidence: 1.0 };
  }
  if (lower.includes('repeat') || lower.includes('again')) {
    return { tool: 'repeat_last', args: {}, confidence: 1.0 };
  }
  if (lower.includes('help')) {
    return { tool: 'help', args: {}, confidence: 1.0 };
  }
  if (lower.includes('around') || lower.includes('describe') || lower.includes('front of me')) {
    return { tool: 'describe_scene', args: {}, confidence: 0.95 };
  }
  if (lower.includes('read') || lower.includes('sign') || lower.includes('text')) {
    return { tool: 'read_text', args: {}, confidence: 0.95 };
  }
  if (lower.includes('currency') || lower.includes('rupee') || lower.includes('note') || lower.includes('money')) {
    return { tool: 'identify_currency', args: {}, confidence: 0.95 };
  }
  if (lower.includes('waste') || lower.includes('bin') || lower.includes('trash') || lower.includes('garbage')) {
    return { tool: 'sort_waste', args: {}, confidence: 0.95 };
  }
  if (lower.includes('label') || lower.includes('medicine') || lower.includes('expiry') || lower.includes('ingredient')) {
    return { tool: 'read_label', args: {}, confidence: 0.95 };
  }
  if (lower.includes('hazard') || lower.includes('stairs') || lower.includes('drop-off')) {
    return { tool: 'scan_hazards', args: { enabled: true }, confidence: 0.95 };
  }
  if (lower.includes('where am i') || lower.includes('location')) {
    return { tool: 'where_am_i', args: {}, confidence: 0.95 };
  }
  if (lower.includes('take me to') || lower.includes('navigate to')) {
    const destMatch = lower.replace(/^(take me to|navigate to)\s+/i, '').trim();
    const matched = destinations.find((d) => d.toLowerCase() === destMatch.toLowerCase());
    if (matched) {
      return { tool: 'navigate_to', args: { destination: matched }, confidence: 0.95 };
    }
    // Fall back to find_target if destination is not in venue pack
    return { tool: 'find_target', args: { target: destMatch || 'washroom' }, confidence: 0.85 };
  }
  if (lower.includes('find') || lower.includes('where is')) {
    const targetMatch = lower.replace(/^(find|where is)\s+(the\s+|my\s+)?/i, '').trim();
    return { tool: 'find_target', args: { target: targetMatch || 'washroom' }, confidence: 0.9 };
  }
  if (lower.includes('quiet') || lower.includes('normal') || lower.includes('detailed')) {
    const level = lower.includes('quiet') ? 'quiet' : lower.includes('detailed') ? 'detailed' : 'normal';
    return { tool: 'set_verbosity', args: { level }, confidence: 1.0 };
  }
  if (lower.includes('hindi') || lower.includes('kannada') || lower.includes('english')) {
    const lang = lower.includes('hindi') ? 'hi' : lower.includes('kannada') ? 'kn' : 'en';
    return { tool: 'set_language', args: { lang }, confidence: 1.0 };
  }
  if (lower.includes('what colour') || lower.includes('is this') || lower.includes('who is')) {
    return { tool: 'answer_about_view', args: { question: transcript }, confidence: 0.85 };
  }

  return { tool: 'clarify', args: { question: 'Could you please say what you would like to do?' }, confidence: 0.5 };
}

askRouter.post('/ask', askLimiter, async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  const parseResult = askRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      tool: 'clarify',
      args: { question: 'Please speak a short request.' },
      confidence: 0,
      latencyMs: Date.now() - startTime,
      source: 'gemini',
      error: parseResult.error.issues[0]?.message || 'Invalid request body',
    });
    return;
  }

  const { transcript, lang, state, history } = parseResult.data;
  const destinations = state.venue?.destinations || [];

  // MOCK_VLM mode support
  if (process.env.MOCK_VLM === 'true') {
    const mockRes = getMockRouterResponse(transcript, destinations);
    res.json({
      ok: true,
      tool: mockRes.tool,
      args: mockRes.args,
      speechPrefix: mockRes.speechPrefix,
      confidence: mockRes.confidence,
      latencyMs: Date.now() - startTime,
      source: 'mock',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    // If no API key configured, use local mock routing fallback safely
    const fallback = getMockRouterResponse(transcript, destinations);
    res.json({
      ok: true,
      tool: fallback.tool,
      args: fallback.args,
      confidence: fallback.confidence,
      latencyMs: Date.now() - startTime,
      source: 'mock',
    });
    return;
  }

  const modelName =
    process.env.GEMINI_ROUTER_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  // Construct context instructions for Gemini
  let contextPrompt = `Language: ${lang}\n`;
  if (state.activeTool) {
    contextPrompt += `Active Tool: ${state.activeTool}\n`;
  }
  if (state.lastTool) {
    contextPrompt += `Last Tool: ${state.lastTool}\n`;
  }
  if (state.lastAnswerSummary) {
    contextPrompt += `Last Answer: ${state.lastAnswerSummary}\n`;
  }
  if (destinations.length > 0) {
    contextPrompt += `Venue Pre-mapped Destinations: [${destinations.join(', ')}]\n`;
  }

  const contents: any[] = [];

  // Append up to 3 history turns
  if (history && history.length > 0) {
    history.forEach((turn) => {
      contents.push({
        role: turn.role === 'user' ? 'user' : 'model',
        parts: [{ text: turn.text }],
      });
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: `${contextPrompt}\nUser Request: "${transcript}"` }],
  });

  const executeRouterCall = async () => {
    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: ROUTER_SYSTEM_INSTRUCTION,
        tools: [
          {
            functionDeclarations: ROUTER_FUNCTION_DECLARATIONS as any,
          },
        ],
      },
    });

    return await withTimeout(generatePromise, 10000);
  };

  try {
    let response;
    try {
      response = await executeRouterCall();
    } catch (firstErr: any) {
      // 10s timeout with exactly one retry
      console.warn('[Router] First call failed, retrying once...');
      response = await executeRouterCall();
    }

    const rawResponse = response as any;
    const functionCalls = rawResponse.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const toolName = call.name as RouterTool;
      let args = (call.args || {}) as Record<string, any>;

      // Validate allowlist
      if (!ALLOWED_TOOLS.includes(toolName)) {
        res.json({
          ok: true,
          tool: 'clarify',
          args: { question: "I didn't quite catch that. Could you ask in another way?" },
          confidence: 0.4,
          latencyMs: Date.now() - startTime,
          source: 'gemini',
        });
        return;
      }

      // Validate navigate_to destination constraint
      if (toolName === 'navigate_to') {
        const dest = (args.destination || '').trim();
        const validMatch = destinations.find((d) => d.toLowerCase() === dest.toLowerCase());
        if (!validMatch) {
          // Never invent destinations: route to find_target instead
          res.json({
            ok: true,
            tool: 'find_target',
            args: { target: dest || 'washroom' },
            confidence: 0.85,
            latencyMs: Date.now() - startTime,
            source: 'gemini',
          });
          return;
        }
        args.destination = validMatch;
      }

      // Check if low confidence clarify is needed
      res.json({
        ok: true,
        tool: toolName,
        args,
        confidence: 0.95,
        latencyMs: Date.now() - startTime,
        source: 'gemini',
      });
      return;
    }

    // Gemini returned plain text instead of function call: map to clarify
    const plainText = (response.text || '').trim();
    const clarifyQuestion =
      plainText.length > 0 && plainText.length < 120
        ? plainText
        : 'Could you please say what you would like me to do?';

    res.json({
      ok: true,
      tool: 'clarify',
      args: { question: clarifyQuestion },
      confidence: 0.5,
      latencyMs: Date.now() - startTime,
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('[Router Error]:', err.message);
    res.json({
      ok: false,
      tool: 'clarify',
      args: { question: 'Could you please repeat that?' },
      confidence: 0,
      latencyMs: Date.now() - startTime,
      source: 'gemini',
      error: err.message || 'Router request failed',
    });
  }
});
