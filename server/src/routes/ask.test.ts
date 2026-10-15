import { describe, expect, it } from 'vitest';
import express from 'express';
import { askRouter, askRequestSchema } from './ask.js';
import { ALLOWED_TOOLS, ROUTER_FUNCTION_DECLARATIONS, ROUTER_SYSTEM_INSTRUCTION } from '../prompts/router.js';
import { askSchema, buildAskPrompt, toAskSummary } from '../tasks/ask.js';

describe('Server Ask Router & Task Suite', () => {
  describe('Zod Request Validation', () => {
    it('accepts valid ask requests with transcript and state', () => {
      const valid = {
        transcript: 'Where is the nearest exit?',
        lang: 'en',
        state: {
          activeTool: null,
          online: true,
          venue: {
            id: 'amc-main',
            destinations: ['Washroom', 'Cafeteria', 'Exit'],
          },
        },
        history: [
          { role: 'user', text: 'Hello' },
          { role: 'assistant', text: 'SightLine ready.' },
        ],
      };

      const result = askRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects transcripts exceeding 300 characters', () => {
      const invalid = {
        transcript: 'a'.repeat(301),
        lang: 'en',
      };
      const result = askRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects history exceeding 3 turns', () => {
      const invalid = {
        transcript: 'Help me',
        history: [
          { role: 'user', text: '1' },
          { role: 'assistant', text: '2' },
          { role: 'user', text: '3' },
          { role: 'assistant', text: '4' },
        ],
      };
      const result = askRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Allowed Tools & Router Declarations', () => {
    it('includes all 17 declared router tools in ALLOWED_TOOLS', () => {
      expect(ALLOWED_TOOLS).toHaveLength(17);
      expect(ALLOWED_TOOLS).toContain('describe_scene');
      expect(ALLOWED_TOOLS).toContain('read_text');
      expect(ALLOWED_TOOLS).toContain('find_target');
      expect(ALLOWED_TOOLS).toContain('identify_currency');
      expect(ALLOWED_TOOLS).toContain('sort_waste');
      expect(ALLOWED_TOOLS).toContain('read_label');
      expect(ALLOWED_TOOLS).toContain('scan_hazards');
      expect(ALLOWED_TOOLS).toContain('navigate_to');
      expect(ALLOWED_TOOLS).toContain('where_am_i');
      expect(ALLOWED_TOOLS).toContain('answer_about_view');
      expect(ALLOWED_TOOLS).toContain('stop_current');
      expect(ALLOWED_TOOLS).toContain('repeat_last');
      expect(ALLOWED_TOOLS).toContain('set_verbosity');
      expect(ALLOWED_TOOLS).toContain('set_language');
      expect(ALLOWED_TOOLS).toContain('trigger_sos');
      expect(ALLOWED_TOOLS).toContain('help');
      expect(ALLOWED_TOOLS).toContain('clarify');
    });

    it('defines matching functionDeclarations for all allowed tools', () => {
      const declaredNames = ROUTER_FUNCTION_DECLARATIONS.map((f) => f.name);
      for (const tool of ALLOWED_TOOLS) {
        expect(declaredNames).toContain(tool);
      }
    });

    it('enforces concise system instruction constraints', () => {
      expect(ROUTER_SYSTEM_INSTRUCTION).toContain('Pick the single best tool');
      expect(ROUTER_SYSTEM_INSTRUCTION).toContain('Never invent destinations');
      expect(ROUTER_SYSTEM_INSTRUCTION).toContain('Keep any speechPrefix under 6 words');
    });
  });

  describe('MOCK_VLM Router Endpoint Behavior', () => {
    const app = express();
    app.use(express.json());
    app.use('/api', askRouter);

    process.env.MOCK_VLM = 'true';

    async function callAsk(body: any) {
      return new Promise<any>((resolve, reject) => {
        const server = app.listen(0, async () => {
          const port = (server.address() as any).port;
          try {
            const res = await fetch(`http://localhost:${port}/api/ask`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            server.close();
            resolve({ status: res.status, body: data });
          } catch (err) {
            server.close();
            reject(err);
          }
        });
      });
    }

    it('routes scene description queries to describe_scene', async () => {
      const res = await callAsk({ transcript: 'What is around me?' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.tool).toBe('describe_scene');
      expect(res.body.source).toBe('mock');
    });

    it('routes reading queries to read_text', async () => {
      const res = await callAsk({ transcript: 'Read this sign for me' });

      expect(res.status).toBe(200);
      expect(res.body.tool).toBe('read_text');
    });

    it('routes destination navigation with destination check', async () => {
      // 1. Matched destination in venue
      const res1 = await callAsk({
        transcript: 'Take me to Seminar Hall',
        state: {
          activeTool: null,
          online: true,
          venue: {
            destinations: ['Seminar Hall', 'Restroom Ground Floor'],
          },
        },
      });

      expect(res1.status).toBe(200);
      expect(res1.body.tool).toBe('navigate_to');
      expect(res1.body.args.destination).toBe('Seminar Hall');

      // 2. Unmatched destination converts to find_target
      const res2 = await callAsk({
        transcript: 'Take me to Library',
        state: {
          activeTool: null,
          online: true,
          venue: {
            destinations: ['Seminar Hall', 'Restroom Ground Floor'],
          },
        },
      });

      expect(res2.status).toBe(200);
      expect(res2.body.tool).toBe('find_target');
      expect(res2.body.args.target).toBe('library');
    });

    it('routes emergency requests to trigger_sos without sending message', async () => {
      const res = await callAsk({ transcript: 'Emergency help me right now' });

      expect(res.status).toBe(200);
      expect(res.body.tool).toBe('trigger_sos');
    });

    it('routes unclear queries to clarify with a short question', async () => {
      const res = await callAsk({ transcript: 'xyzzy 12345 blabla' });

      expect(res.status).toBe(200);
      expect(res.body.tool).toBe('clarify');
      expect(res.body.args.question).toBeDefined();
    });
  });

  describe('Ask Analyze Task Schema (task: "ask")', () => {
    it('validates correct ask schema output', () => {
      const valid = {
        answer: 'Yes, this is an accessible washroom door straight ahead.',
        confidence: 0.94,
      };

      const result = askSchema.safeParse(valid);
      expect(result.success).toBe(true);
      expect(toAskSummary(valid)).toBe(valid.answer);
    });

    it('builds concise question-grounded prompt', () => {
      const prompt = buildAskPrompt({
        task: 'ask',
        image: 'base64...',
        lang: 'en',
        context: 'Is there a chair in front of me?',
      });

      expect(prompt).toContain('Is there a chair in front of me?');
      expect(prompt).toContain('25 words or fewer');
      expect(prompt).toContain('Say "I\'m not sure"');
    });
  });
});
