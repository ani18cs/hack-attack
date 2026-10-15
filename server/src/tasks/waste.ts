import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AnalyzeRequest } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasteMapPath = path.resolve(__dirname, '../config/waste-map.json');

interface WasteCategoryConfig {
  bin: string;
  color: string;
  categoryName: string;
  items: string[];
}

interface WasteMap {
  _note?: string;
  categories: Record<string, WasteCategoryConfig>;
}

let wasteMapCache: WasteMap | null = null;

function getWasteMap(): WasteMap {
  if (!wasteMapCache) {
    try {
      const raw = fs.readFileSync(wasteMapPath, 'utf8');
      wasteMapCache = JSON.parse(raw);
    } catch {
      wasteMapCache = {
        categories: {
          wet: { bin: 'Green bin', color: 'green', categoryName: 'Wet waste', items: [] },
          dry: { bin: 'Blue bin', color: 'blue', categoryName: 'Dry waste', items: [] },
          recyclable: { bin: 'Blue bin', color: 'blue', categoryName: 'Recyclable', items: [] },
          hazardous: { bin: 'Red bin', color: 'red', categoryName: 'Hazardous waste', items: [] },
          'e-waste': { bin: 'Red/E-waste drop', color: 'red', categoryName: 'Electronic waste', items: [] },
          unknown: { bin: 'Check bin label', color: 'gray', categoryName: 'Uncertain', items: [] },
        },
      };
    }
  }
  return wasteMapCache!;
}

export const wasteSchema = z.object({
  item: z.string().describe('Identified waste object (e.g. "Plastic bottle", "Banana peel")'),
  category: z.enum(['wet', 'dry', 'recyclable', 'hazardous', 'e-waste', 'unknown']),
  binHint: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
});

export const wasteGeminiSchema = {
  type: 'object',
  properties: {
    item: {
      type: 'string',
      description: 'The specific waste object held in front of the camera (e.g. "Plastic bottle", "Tea bag", "Battery")',
    },
    category: {
      type: 'string',
      enum: ['wet', 'dry', 'recyclable', 'hazardous', 'e-waste', 'unknown'],
      description: 'The municipal segregation category',
    },
    binHint: {
      type: 'string',
      description: 'Suggested disposal instruction',
    },
    summary: {
      type: 'string',
      description: 'Concise spoken summary <= 15 words',
    },
    confidence: { type: 'number' },
  },
  required: ['item', 'category'],
};

export function buildWastePrompt(req: AnalyzeRequest): string {
  const lang = req.lang || 'en';
  return `You assist a blind user in disposing of waste responsibly into correct segregated bins.
Identify the item held up to the camera.
Classify its waste category as one of:
- wet (organic, compostable, food scraps, fruit peel)
- dry (paper, non-recyclable wrappers, dust)
- recyclable (clean plastic bottles, soda cans, glass, cardboard)
- hazardous (sanitary pads, diapers, expired medicine, batteries, chemicals)
- e-waste (cables, broken electronics, chargers)
- unknown (cannot be determined clearly)

If item is not clearly distinguishable or ambiguous, set category: "unknown".
Target language: ${lang}.
Output strictly valid JSON matching the schema.`;
}

export function toWasteSummary(data: z.infer<typeof wasteSchema>): string {
  if (data.category === 'unknown') {
    return "I'm not sure. Please check the bin label.";
  }

  const map = getWasteMap();
  const cfg = map.categories[data.category] || map.categories.dry;
  const binName = cfg.bin || 'designated bin';
  const catName = cfg.categoryName || data.category;

  return `${data.item}. ${catName}, ${binName.toLowerCase()}.`;
}
