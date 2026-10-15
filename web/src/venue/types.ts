import { z } from 'zod';

export const LandmarkCheckpointSchema = z.object({
  landmarkId: z.string(),
  expectSignText: z.array(z.string()).default([]),
});

export const RouteStepSchema = z.object({
  text: z.string(),
  steps: z.number().int().positive().optional(),
  turn: z.enum(['straight', 'left', 'right', 'slight_left', 'slight_right', 'u_turn']).optional(),
  headingChange: z.number().optional(), // In degrees relative to current heading, e.g. -90 for left, +90 for right
  checkpoint: LandmarkCheckpointSchema.optional(),
});

export const LandmarkSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  signText: z.array(z.string()).default([]),
  qr: z.string().optional(),
  type: z.string().default('general'),
  names: z
    .object({
      hi: z.string().optional(),
      kn: z.string().optional(),
    })
    .optional(),
});

export const RouteSchema = z.object({
  from: z.string(),
  to: z.string(),
  steps: z.array(RouteStepSchema),
});

export const VenueMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultLang: z.string().default('en'),
});

export const VenuePackSchema = z.object({
  venue: VenueMetaSchema,
  landmarks: z.array(LandmarkSchema),
  routes: z.array(RouteSchema),
});

export type LandmarkCheckpoint = z.infer<typeof LandmarkCheckpointSchema>;
export type RouteStep = z.infer<typeof RouteStepSchema>;
export type Landmark = z.infer<typeof LandmarkSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type VenueMeta = z.infer<typeof VenueMetaSchema>;
export type VenuePack = z.infer<typeof VenuePackSchema>;

export interface LocalizationResult {
  landmarkId: string | null;
  landmark: Landmark | null;
  confidence: number;
  method: 'voice' | 'qr' | 'visual_sign' | 'manual';
  evidence?: string;
}

export type NavigatorState =
  | 'IDLE'
  | 'LOCATING'
  | 'SELECTING_DESTINATION'
  | 'ROUTING'
  | 'STEP_WALKING'
  | 'STEP_TURN'
  | 'CHECKPOINT_VERIFYING'
  | 'ARRIVED'
  | 'ROUTE_NOT_FOUND'
  | 'CANCELLED';
