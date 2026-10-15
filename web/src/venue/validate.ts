import fs from 'node:fs';
import path from 'node:path';
import { VenuePackSchema } from './types';

export function validateVenueFile(filePath: string): boolean {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = VenuePackSchema.safeParse(parsed);

    if (!result.success) {
      console.error(`❌ Validation failed for ${filePath}:`);
      console.error(JSON.stringify(result.error.format(), null, 2));
      return false;
    }

    const data = result.data;
    const landmarkIds = new Set(data.landmarks.map((l) => l.id));
    let hasReferentialError = false;

    // Check route endpoints and checkpoints
    data.routes.forEach((route, idx) => {
      if (!landmarkIds.has(route.from)) {
        console.error(`❌ Route #${idx + 1} 'from' landmark '${route.from}' is not defined in landmarks.`);
        hasReferentialError = true;
      }
      if (!landmarkIds.has(route.to)) {
        console.error(`❌ Route #${idx + 1} 'to' landmark '${route.to}' is not defined in landmarks.`);
        hasReferentialError = true;
      }
      route.steps.forEach((step, sIdx) => {
        if (step.checkpoint && !landmarkIds.has(step.checkpoint.landmarkId)) {
          console.error(
            `❌ Route #${idx + 1} step #${sIdx + 1} checkpoint landmark '${step.checkpoint.landmarkId}' is not defined.`
          );
          hasReferentialError = true;
        }
      });
    });

    if (hasReferentialError) return false;

    console.log(
      `✅ Venue pack '${data.venue.name}' (${data.venue.id}) is valid: ${data.landmarks.length} landmarks, ${data.routes.length} routes.`
    );
    return true;
  } catch (err) {
    console.error(`❌ Error reading or parsing ${filePath}:`, err);
    return false;
  }
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('validate.ts') || process.argv[1].endsWith('validate.js'));

if (isMain) {
  const target = process.argv[2] || path.resolve(process.cwd(), 'public/venues/amc-hackattack.json');
  const ok = validateVenueFile(target);
  process.exit(ok ? 0 : 1);
}
