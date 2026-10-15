import { VenuePack, VenuePackSchema } from './types';

let cachedVenue: VenuePack | null = null;

/**
 * Loads and validates a venue pack from public/venues/{venueId}.json.
 * Caches in memory and localStorage for reliable offline usage.
 */
export async function loadVenuePack(venueId = 'amc-hackattack'): Promise<VenuePack | null> {
  if (cachedVenue && cachedVenue.venue.id === venueId) {
    return cachedVenue;
  }

  // Check localStorage offline cache
  const storageKey = `andhadhun_venue_${venueId}`;
  const legacyKey = `sightline_venue_${venueId}`;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(legacyKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const result = VenuePackSchema.safeParse(parsed);
        if (result.success) {
          cachedVenue = result.data;
        }
      }
    } catch (e) {
      console.warn('LocalStorage venue read error:', e);
    }
  }

  try {
    const res = await fetch(`/venues/${venueId}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const validated = VenuePackSchema.parse(json);
    cachedVenue = validated;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(validated));
      } catch (err) {
        console.warn('Could not cache venue pack in localStorage:', err);
      }
    }

    return validated;
  } catch (err) {
    console.warn(`Failed to fetch venue pack '${venueId}' from network:`, err);
    return cachedVenue;
  }
}
