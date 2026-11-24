import type { Feature, LineString } from 'geojson';

export type LngLatTuple = [number, number]; // [lng, lat]

export type MapMode = '2D' | '3D';

export type SimulationStatus = 'idle' | 'playing' | 'paused' | 'completed';

export interface Destination {
  name: string;
  displayName: string;
  coordinates: LngLatTuple;
}

export interface RouteStep {
  instruction: string;
  maneuverType: string;
  maneuverModifier?: string;
  streetName: string;
  distance: number; // meters
  duration: number; // seconds
  location: LngLatTuple;
  cumulativeDistance: number; // meters from start of route to this maneuver
}

export interface RouteData {
  geometry: Feature<LineString>;
  distance: number; // total meters
  duration: number; // total seconds
  steps: RouteStep[];
}

export interface UIAlert {
  id: number;
  type: 'info' | 'warning' | 'error';
  message: string;
}
