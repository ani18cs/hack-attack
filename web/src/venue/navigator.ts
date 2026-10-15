import { VenuePack } from './types';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  direction: 'straight' | 'left' | 'right';
}

/**
 * Computes simple step-by-step guidance between landmarks.
 * TODO: A* shortest path calculation on venue node graph.
 */
export function calculateRoute(
  startId: string,
  targetId: string,
  _venue: VenuePack
): RouteStep[] {
  return [
    { instruction: `Walk straight from ${startId} toward ${targetId}`, distanceMeters: 10, direction: 'straight' },
    { instruction: `Arrived near ${targetId}`, distanceMeters: 0, direction: 'straight' },
  ];
}
