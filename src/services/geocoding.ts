import type { LngLatTuple } from '../types/nav';

export interface GeocodingResult {
  placeId: string;
  name: string;
  displayName: string;
  coordinates: LngLatTuple;
  category?: string;
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const REQUEST_TIMEOUT_MS = 9000;

export const VICE_CITY_PRESETS: GeocodingResult[] = [
  {
    placeId: 'preset-ocean-drive',
    name: 'Ocean Drive, South Beach',
    displayName: 'Ocean Drive, Miami Beach, FL (Vice Beach)',
    coordinates: [-80.1304, 25.7809],
    category: 'Landmark',
  },
  {
    placeId: 'preset-wynwood',
    name: 'Wynwood Walls',
    displayName: 'Wynwood Arts District, Miami, FL',
    coordinates: [-80.1994, 25.8011],
    category: 'District',
  },
  {
    placeId: 'preset-bayside',
    name: 'Bayside Marketplace',
    displayName: '401 Biscayne Blvd, Downtown Miami, FL',
    coordinates: [-80.1867, 25.7782],
    category: 'Waterfront',
  },
  {
    placeId: 'preset-mia',
    name: 'Miami International Airport',
    displayName: '2100 NW 42nd Ave, Miami, FL (Escobar Intl)',
    coordinates: [-80.287, 25.7959],
    category: 'Airport',
  },
];

/**
 * Search destinations using OpenStreetMap Nominatim (zero API keys).
 * Biases results slightly toward the user's current viewbox when provided.
 */
export async function searchPlaces(
  query: string,
  near?: LngLatTuple,
  signal?: AbortSignal
): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    format: 'json',
    q: trimmed,
    limit: '6',
    addressdetails: '1',
  });

  if (near) {
    const [lng, lat] = near;
    const delta = 0.45;
    params.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim search failed (${res.status})`);
    }

    const data: NominatimItem[] = await res.json();
    return data.map((item) => {
      const shortName = item.name?.trim() || item.display_name.split(',')[0].trim();
      return {
        placeId: String(item.place_id),
        name: shortName,
        displayName: item.display_name,
        coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
        category: item.type || item.class,
      };
    });
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Reverse geocode a clicked map coordinate into a readable place name.
 */
export async function reverseGeocode(
  coords: LngLatTuple,
  signal?: AbortSignal
): Promise<{ name: string; displayName: string }> {
  const [lng, lat] = coords;
  const fallback = {
    name: `Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
    });

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return fallback;
    const data: { name?: string; display_name?: string } = await res.json();
    if (!data.display_name) return fallback;

    const shortName = data.name?.trim() || data.display_name.split(',')[0].trim();
    return {
      name: shortName || fallback.name,
      displayName: data.display_name,
    };
  } catch {
    return fallback;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
