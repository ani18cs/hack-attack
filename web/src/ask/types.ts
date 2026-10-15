import { z } from 'zod';

export const ROUTER_TOOLS = [
  'describe_scene',
  'read_text',
  'find_target',
  'identify_currency',
  'sort_waste',
  'read_label',
  'scan_hazards',
  'navigate_to',
  'where_am_i',
  'answer_about_view',
  'stop_current',
  'repeat_last',
  'set_verbosity',
  'set_language',
  'trigger_sos',
  'help',
  'clarify',
] as const;

export type RouterTool = (typeof ROUTER_TOOLS)[number];

export interface ToolCall {
  tool: RouterTool;
  args: Record<string, any>;
  speechPrefix?: string;
  confidence: number;
  source: 'local' | 'gemini' | 'mock';
}

export interface VenueState {
  id?: string;
  currentLandmarkId?: string;
  destinations: string[];
}

export interface AskState {
  activeTool: string | null;
  online: boolean;
  lastTool?: string;
  lastAnswerSummary?: string;
  venue?: VenueState;
}

export interface AskHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface AskRouterRequest {
  transcript: string;
  lang?: 'en' | 'hi' | 'kn';
  state: AskState;
  history?: AskHistoryItem[];
}

export const askRouterResponseSchema = z.object({
  ok: z.boolean(),
  tool: z.enum(ROUTER_TOOLS),
  args: z.record(z.string(), z.any()).default({}),
  speechPrefix: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1),
  latencyMs: z.number().optional(),
  source: z.enum(['gemini', 'mock']).default('gemini'),
  error: z.string().optional(),
});

export type AskRouterResponse = z.infer<typeof askRouterResponseSchema>;

export interface HeadlessTool {
  name: RouterTool;
  isLongRunning: boolean;
  run: (args: Record<string, any>, ctx: AskState) => Promise<void>;
  stop?: () => void;
}
