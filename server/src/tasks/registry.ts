import { z } from 'zod';
import type { VisionTask, AnalyzeRequest } from '../types.js';
import { currencySchema, currencyGeminiSchema, buildCurrencyPrompt, toCurrencySummary } from './currency.js';
import { describeSchema, describeGeminiSchema, buildDescribePrompt, toDescribeSummary } from './describe.js';
import { findSchema, findGeminiSchema, buildFindPrompt, toFindSummary } from './find.js';
import { hazardSchema, hazardGeminiSchema, buildHazardPrompt, toHazardSummary } from './hazard.js';
import { labelSchema, labelGeminiSchema, buildLabelPrompt, toLabelSummary } from './label.js';
import { readSchema, readGeminiSchema, buildReadPrompt, toReadSummary } from './read.js';
import { sosContextSchema, sosContextGeminiSchema, buildSosContextPrompt, toSosContextSummary } from './sos_context.js';
import { verifyLandmarkSchema, verifyLandmarkGeminiSchema, buildVerifyLandmarkPrompt, toVerifyLandmarkSummary } from './verify_landmark.js';
import { wasteSchema, wasteGeminiSchema, buildWastePrompt, toWasteSummary } from './waste.js';

export const SHARED_SYSTEM_INSTRUCTION =
  'You assist a blind user. Be concise, factual, spatial. Use left / slightly left / ahead / slightly right / right and rough distance. Never invent text you cannot read. If unsure, say so and lower confidence. Output JSON matching the schema.';

export interface TaskPreset<T = any> {
  task: VisionTask;
  systemPrompt: string;
  buildPrompt: (req: AnalyzeRequest) => string;
  schema: z.ZodType<T>;
  geminiSchema: any;
  toSummary: (data: T, req?: AnalyzeRequest) => string;
  implemented: boolean;
}

export const TASK_REGISTRY: Record<VisionTask, TaskPreset> = {
  describe: {
    task: 'describe',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildDescribePrompt,
    schema: describeSchema,
    geminiSchema: describeGeminiSchema,
    toSummary: (data) => toDescribeSummary(data),
    implemented: true,
  },

  read: {
    task: 'read',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildReadPrompt,
    schema: readSchema,
    geminiSchema: readGeminiSchema,
    toSummary: (data) => toReadSummary(data),
    implemented: true,
  },

  find: {
    task: 'find',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildFindPrompt,
    schema: findSchema,
    geminiSchema: findGeminiSchema,
    toSummary: (data, req) => toFindSummary(data, req?.target),
    implemented: true,
  },

  // Part 2 scaffolded presets (marked implemented: false for Part 1)
  currency: {
    task: 'currency',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildCurrencyPrompt,
    schema: currencySchema,
    geminiSchema: currencyGeminiSchema,
    toSummary: (data) => toCurrencySummary(data),
    implemented: false,
  },

  waste: {
    task: 'waste',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildWastePrompt,
    schema: wasteSchema,
    geminiSchema: wasteGeminiSchema,
    toSummary: (data) => toWasteSummary(data),
    implemented: false,
  },

  label: {
    task: 'label',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildLabelPrompt,
    schema: labelSchema,
    geminiSchema: labelGeminiSchema,
    toSummary: (data) => toLabelSummary(data),
    implemented: false,
  },

  hazard: {
    task: 'hazard',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildHazardPrompt,
    schema: hazardSchema,
    geminiSchema: hazardGeminiSchema,
    toSummary: (data) => toHazardSummary(data),
    implemented: false,
  },

  verify_landmark: {
    task: 'verify_landmark',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildVerifyLandmarkPrompt,
    schema: verifyLandmarkSchema,
    geminiSchema: verifyLandmarkGeminiSchema,
    toSummary: (data) => toVerifyLandmarkSummary(data),
    implemented: false,
  },

  sos_context: {
    task: 'sos_context',
    systemPrompt: SHARED_SYSTEM_INSTRUCTION,
    buildPrompt: buildSosContextPrompt,
    schema: sosContextSchema,
    geminiSchema: sosContextGeminiSchema,
    toSummary: (data) => toSosContextSummary(data),
    implemented: false,
  },
};
