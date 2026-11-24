import type { Feature, LineString } from 'geojson';
import type { LngLatTuple, RouteData, RouteStep } from '../types/nav';

interface OsrmManeuver {
  type: string;
  modifier?: string;
  location: [number, number];
  exit?: number;
}

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: OsrmManeuver;
}

interface OsrmLeg {
  distance: number;
  duration: number;
  steps: OsrmStep[];
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: LineString;
  legs: OsrmLeg[];
}

interface OsrmWaypoint {
  distance: number; // meters from input coordinate to snapped road
  name: string;
  location: [number, number];
}

interface OsrmResponse {
  code: string;
  message?: string;
  waypoints?: OsrmWaypoint[];
  routes?: OsrmRoute[];
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_ROAD_SNAP_METERS = 350;

function formatManeuverInstruction(step: OsrmStep): string {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name?.trim();
  const onRoad = road ? ` onto ${road}` : '';

  switch (type) {
    case 'depart':
      return road ? `Head ${modifier ?? 'forward'} on ${road}` : 'Depart along route';
    case 'arrive':
      return road ? `Arrive at destination on ${road}` : 'Arrive at destination';
    case 'turn':
      return `Turn ${modifier ?? 'ahead'}${onRoad}`;
    case 'new name':
      return road ? `Continue onto ${road}` : 'Continue straight';
    case 'merge':
      return `Merge ${modifier ?? ''}${onRoad}`.replace(/\s+/g, ' ').trim();
    case 'on ramp':
      return `Take the ramp${modifier ? ` ${modifier}` : ''}${onRoad}`;
    case 'off ramp':
      return `Take the exit${modifier ? ` ${modifier}` : ''}${onRoad}`;
    case 'fork':
      return `Keep ${modifier ?? 'straight'} at the fork${onRoad}`;
    case 'roundabout':
    case 'rotary':
      return `Enter roundabout${exit ? `, take exit ${exit}` : ''}${onRoad}`;
    case 'continue':
      return `Continue ${modifier ?? 'straight'}${onRoad}`;
    default:
      return road ? `Continue on ${road}` : 'Continue along route';
  }
}

/**
 * Fetch driving route between two coordinates using the public OSRM API.
 */
export async function fetchRoute(
  origin: LngLatTuple,
  destination: LngLatTuple,
  signal?: AbortSignal
): Promise<RouteData> {
  const [lon1, lat1] = origin;
  const [lon2, lat2] = destination;

  const url = `${OSRM_BASE}/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&steps=true`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Routing service returned HTTP ${res.status}`);
    }

    const data: OsrmResponse = await res.json();
    if (data.code === 'NoRoute' || data.code === 'NoSegment') {
      throw new Error(
        'No drivable route found — destination may be overseas or unreachable by road.'
      );
    }

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'No drivable route found between these points.');
    }

    // Reject origin or destination snapped far across water / off-road
    const originWaypoint = data.waypoints?.[0];
    if (originWaypoint && originWaypoint.distance > MAX_ROAD_SNAP_METERS) {
      throw new Error(
        'Starting point is over water or too far from a drivable road. Pick a location on land.'
      );
    }

    const destWaypoint = data.waypoints?.[1];
    if (destWaypoint && destWaypoint.distance > MAX_ROAD_SNAP_METERS) {
      throw new Error(
        'Destination is over water or too far from a drivable road. Pick a location on land.'
      );
    }

    const primary = data.routes[0];
    const geometry: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: primary.geometry,
    };

    const steps: RouteStep[] = [];
    let cumulative = 0;

    for (const leg of primary.legs) {
      for (const rawStep of leg.steps) {
        steps.push({
          instruction: formatManeuverInstruction(rawStep),
          maneuverType: rawStep.maneuver.type,
          maneuverModifier: rawStep.maneuver.modifier,
          streetName: rawStep.name || '',
          distance: rawStep.distance,
          duration: rawStep.duration,
          location: rawStep.maneuver.location,
          cumulativeDistance: cumulative,
        });
        cumulative += rawStep.distance;
      }
    }

    return {
      geometry,
      distance: primary.distance,
      duration: primary.duration,
      steps,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Route request timed out. Please try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
