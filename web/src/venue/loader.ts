import { VenuePack } from './types';

/**
 * Loads a venue pack from JSON.
 * TODO: Support caching in IndexedDB for offline campus navigation.
 */
export async function loadVenuePack(venueId = 'sample-venue'): Promise<VenuePack | null> {
  try {
    const res = await fetch(`/venues/${venueId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to load venue pack:', err);
    return null;
  }
}
