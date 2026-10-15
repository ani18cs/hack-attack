import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { TASK_REGISTRY } from '../src/tasks/registry.js';
import { generateVisionJSON } from '../src/gemini.js';
import type { VisionTask } from '../src/types.js';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const task = (args[0] || 'describe') as VisionTask;
  const imagePath = args[1];

  console.log(`[try-analyze] Testing task: ${task}`);

  const preset = TASK_REGISTRY[task];
  if (!preset) {
    console.error(`Unknown task: ${task}. Valid tasks: ${Object.keys(TASK_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  let base64Image = '';
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`[try-analyze] Loading image from: ${imagePath}`);
    const buffer = fs.readFileSync(imagePath);
    base64Image = buffer.toString('base64');
  } else {
    console.log('[try-analyze] No valid image file supplied. Generating minimal 1x1 test JPEG payload...');
    // Minimal 1x1 pixel JPEG
    base64Image =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  }

  const prompt = preset.buildPrompt({
    task,
    image: base64Image,
    lang: 'en',
    target: 'restroom',
  });

  console.log(`[try-analyze] Executing with model: ${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}`);
  const startTime = Date.now();

  try {
    const rawResult = await generateVisionJSON({
      prompt,
      systemInstruction: preset.systemPrompt,
      imageBase64: base64Image,
      responseSchema: preset.geminiSchema,
      timeoutMs: 10000,
    });

    const parsed = preset.schema.safeParse(rawResult);
    const data = parsed.success ? parsed.data : rawResult;
    const summary = preset.toSummary(data);

    console.log('\n--- SUCCESS ---');
    console.log('Latency:', Date.now() - startTime, 'ms');
    console.log('Spoken Summary:', summary);
    console.log('Structured Payload:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('\n--- FAILED ---');
    console.error('Error:', err.message);
  }
}

main();
