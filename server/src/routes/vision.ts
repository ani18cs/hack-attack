import { GoogleGenAI, Type } from '@google/genai';
import { Router, Request, Response } from 'express';
import { DESCRIBE_PROMPT, FIND_PROMPT, READ_PROMPT, SYSTEM_INSTRUCTION } from '../prompts.js';

export const visionRouter = Router();

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('PLACEHOLDER')) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

function cleanBase64(raw: string): { data: string; mimeType: string } {
  let mimeType = 'image/jpeg';
  let data = raw;

  if (raw.startsWith('data:')) {
    const parts = raw.split(';base64,');
    if (parts.length === 2) {
      mimeType = parts[0].replace('data:', '');
      data = parts[1];
    }
  }

  return { data, mimeType };
}

// POST /api/describe
visionRouter.post('/describe', async (req: Request, res: Response): Promise<void> => {
  try {
    const { image, lang = 'en' } = req.body;
    if (!image) {
      res.status(400).json({ error: 'Image data is required.' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      res.status(503).json({
        summary: 'Server vision key not configured yet.',
        objects: [],
        error: 'GEMINI_API_KEY missing in server/.env',
      });
      return;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const { data, mimeType } = cleanBase64(image);

    const describeSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        objects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              direction: {
                type: Type.STRING,
                enum: ['left', 'ahead', 'right', 'unknown', 'slightly left', 'slightly right'],
              },
              distance: {
                type: Type.STRING,
                enum: ['very close', 'close', 'a few steps away', 'far'],
              },
            },
            required: ['label', 'direction', 'distance'],
          },
        },
      },
      required: ['summary', 'objects'],
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: DESCRIBE_PROMPT(lang) },
            {
              inlineData: {
                data,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: describeSchema,
      },
    });

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: 'No response generated from Gemini vision model.' });
      return;
    }

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error('Vision describe error:', error);
    res.status(500).json({
      summary: 'Unable to describe scene right now.',
      objects: [],
      error: error.message || 'Vision description failed',
    });
  }
});

// POST /api/read
visionRouter.post('/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { image, lang = 'en' } = req.body;
    if (!image) {
      res.status(400).json({ error: 'Image data is required.' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      res.status(503).json({
        summary: 'Server vision key not configured yet.',
        texts: [],
        error: 'GEMINI_API_KEY missing in server/.env',
      });
      return;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const { data, mimeType } = cleanBase64(image);

    const readSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        texts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              kind: {
                type: Type.STRING,
                enum: ['exit', 'room', 'store', 'direction', 'warning', 'other'],
              },
              direction: {
                type: Type.STRING,
                enum: ['left', 'ahead', 'right'],
              },
            },
            required: ['text', 'kind'],
          },
        },
      },
      required: ['summary', 'texts'],
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: READ_PROMPT(lang) },
            {
              inlineData: {
                data,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: readSchema,
      },
    });

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: 'No response from OCR vision model.' });
      return;
    }

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error('Vision read error:', error);
    res.status(500).json({
      summary: 'Could not read text right now.',
      texts: [],
      error: error.message || 'Vision read failed',
    });
  }
});

// POST /api/find
visionRouter.post('/find', async (req: Request, res: Response): Promise<void> => {
  try {
    const { image, target = 'restroom', lang = 'en' } = req.body;
    if (!image) {
      res.status(400).json({ error: 'Image data is required.' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      res.status(503).json({
        found: false,
        direction: 'unknown',
        gender: 'unknown',
        confidence: 0,
        cue: '',
        error: 'GEMINI_API_KEY missing in server/.env',
      });
      return;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const { data, mimeType } = cleanBase64(image);

    const findSchema = {
      type: Type.OBJECT,
      properties: {
        found: { type: Type.BOOLEAN },
        direction: {
          type: Type.STRING,
          enum: ['left', 'ahead', 'right', 'unknown'],
        },
        gender: {
          type: Type.STRING,
          enum: ['men', 'women', 'unisex', 'unknown'],
        },
        confidence: { type: Type.NUMBER },
        cue: { type: Type.STRING },
      },
      required: ['found', 'direction', 'gender', 'confidence', 'cue'],
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: FIND_PROMPT(target, lang) },
            {
              inlineData: {
                data,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: findSchema,
      },
    });

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: 'No response from target finder.' });
      return;
    }

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error('Vision find error:', error);
    res.status(500).json({
      found: false,
      direction: 'unknown',
      gender: 'unknown',
      confidence: 0,
      cue: '',
      error: error.message || 'Vision find target failed',
    });
  }
});
