import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { along, bearing as turfBearing, length as turfLength } from '@turf/turf';
import { useNavStore } from '../../store/useNavStore';

const VEHICLE_SOURCE_ID = 'vice-vehicle-source';
const VEHICLE_GLOW_LAYER_ID = 'vice-vehicle-glow-layer';
const VEHICLE_ARROW_LAYER_ID = 'vice-vehicle-arrow-layer';
const VEHICLE_ICON_ID = 'vice-vehicle-chevron';

const EMPTY_VEHICLE_FC: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Generates a crisp neon cyan-to-pink vehicle chevron onto an offscreen canvas
 * and registers it as a native MapLibre WebGL sprite (zero DOM parallax on turns).
 */
function ensureVehicleLayers(map: maplibregl.Map): void {
  if (!map.hasImage(VEHICLE_ICON_ID)) {
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const cx = size / 2;
      const cy = size / 2;

      // Soft outer neon halo
      const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
      halo.addColorStop(0, 'rgba(0, 240, 255, 0.55)');
      halo.addColorStop(0.55, 'rgba(255, 0, 127, 0.25)');
      halo.addColorStop(1, 'rgba(255, 0, 127, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.fill();

      // Vehicle chevron centered precisely on (cx, cy) so it tracks the road centerline
      const grad = ctx.createLinearGradient(cx, 16, cx, 78);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(1, '#ff007f');

      ctx.save();
      ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx, 16);
      ctx.lineTo(74, 74);
      ctx.lineTo(cx, 60);
      ctx.lineTo(22, 74);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      const imageData = ctx.getImageData(0, 0, size, size);
      map.addImage(VEHICLE_ICON_ID, imageData, { pixelRatio: 2 });
    }
  }

  if (!map.getSource(VEHICLE_SOURCE_ID)) {
    map.addSource(VEHICLE_SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_VEHICLE_FC,
    });
  }

  if (!map.getLayer(VEHICLE_GLOW_LAYER_ID)) {
    map.addLayer({
      id: VEHICLE_GLOW_LAYER_ID,
      type: 'circle',
      source: VEHICLE_SOURCE_ID,
      paint: {
        'circle-radius': 18,
        'circle-color': '#00f0ff',
        'circle-blur': 0.9,
        'circle-opacity': 0.35,
        'circle-pitch-alignment': 'map',
      },
    });
  }

  if (!map.getLayer(VEHICLE_ARROW_LAYER_ID)) {
    map.addLayer({
      id: VEHICLE_ARROW_LAYER_ID,
      type: 'symbol',
      source: VEHICLE_SOURCE_ID,
      layout: {
        'icon-image': VEHICLE_ICON_ID,
        'icon-size': 0.88,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }
}

function setVehiclePoint(
  map: maplibregl.Map,
  coords: [number, number] | null,
  bearing = 0
): void {
  if (!coords) {
    const src = map.getSource(VEHICLE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(EMPTY_VEHICLE_FC);
    return;
  }

  // Re-attach WebGL vehicle sprite/layers if map.setStyle() wiped them (e.g. theme switch)
  if (!map.getSource(VEHICLE_SOURCE_ID) || !map.getLayer(VEHICLE_ARROW_LAYER_ID)) {
    if (!map.isStyleLoaded()) return;
    ensureVehicleLayers(map);
  }

  const src = map.getSource(VEHICLE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;

  src.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { bearing },
        geometry: {
          type: 'Point',
          coordinates: coords,
        },
      },
    ],
  });
}

function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let diff = ((toDeg - fromDeg + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

interface SimRefs {
  rafId: number | null;
  lastFrameTime: number;
  lastHudSyncTime: number;
  distanceTraveledKm: number;
  totalLengthKm: number;
  currentSpeedKmh: number;
  vehicleBearing: number;
  cameraBearing: number;
  smoothZoom: number;
  cameraTransitionEnd: number;
}

/**
 * 60 FPS Demo Drive simulation hook.
 * Strictly isolates requestAnimationFrame, Turf.js geospatial math, native WebGL
 * vehicle rendering, and MapLibre 3D chase camera inside refs so React never re-renders per frame.
 */
export function useDriveSimulation(
  mapRef: React.RefObject<maplibregl.Map | null>,
  userMarkerRef: React.RefObject<maplibregl.Marker | null>
) {
  const simRef = useRef<SimRefs>({
    rafId: null,
    lastFrameTime: 0,
    lastHudSyncTime: 0,
    distanceTraveledKm: 0,
    totalLengthKm: 0,
    currentSpeedKmh: 0,
    vehicleBearing: 0,
    cameraBearing: 0,
    smoothZoom: 17,
    cameraTransitionEnd: 0,
  });

  const simulationStatus = useNavStore((s) => s.simulationStatus);
  const route = useNavStore((s) => s.route);

  // Reset distance when route changes
  useEffect(() => {
    const sim = simRef.current;
    sim.distanceTraveledKm = 0;
    sim.currentSpeedKmh = 0;
    sim.totalLengthKm = route ? turfLength(route.geometry, { units: 'kilometers' }) : 0;

    if (!route && mapRef.current) {
      setVehiclePoint(mapRef.current, null);
      if (userMarkerRef.current) {
        userMarkerRef.current.getElement().style.opacity = '1';
      }
    }
  }, [route, mapRef, userMarkerRef]);

  useEffect(() => {
    const map = mapRef.current;
    const sim = simRef.current;

    // Re-draw paused/completed vehicle marker if theme style reloads
    const handleStyleLoad = () => {
      const state = useNavStore.getState();
      if (state.route && (state.simulationStatus === 'paused' || state.simulationStatus === 'completed')) {
        const pt = along(state.route.geometry, sim.distanceTraveledKm, { units: 'kilometers' });
        setVehiclePoint(map!, pt.geometry.coordinates as [number, number], sim.vehicleBearing);
      }
    };
    map?.on('style.load', handleStyleLoad);

    const stopLoop = () => {
      if (sim.rafId !== null) {
        cancelAnimationFrame(sim.rafId);
        sim.rafId = null;
      }
    };

    // Idle or no route -> hide WebGL vehicle & restore static user marker
    if (!map || !route || simulationStatus === 'idle') {
      stopLoop();
      sim.distanceTraveledKm = 0;
      sim.currentSpeedKmh = 0;
      if (map) {
        setVehiclePoint(map, null);
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.getElement().style.opacity = '1';
      }
      return;
    }

    // Paused or completed -> freeze loop, keep vehicle on road
    if (simulationStatus === 'paused' || simulationStatus === 'completed') {
      stopLoop();
      return;
    }

    const totalKm = turfLength(route.geometry, { units: 'kilometers' });
    sim.totalLengthKm = totalKm;
    if (totalKm <= 0.001) {
      useNavStore.getState().setSimulationStatus('completed');
      return;
    }

    if (sim.distanceTraveledKm >= totalKm - 0.002) {
      sim.distanceTraveledKm = 0;
    }

    ensureVehicleLayers(map);

    const startPt = along(route.geometry, sim.distanceTraveledKm, { units: 'kilometers' });
    const startLookAhead = along(
      route.geometry,
      Math.min(totalKm, sim.distanceTraveledKm + 0.008),
      { units: 'kilometers' }
    );
    const initialBearing = normalizeBearing(turfBearing(startPt, startLookAhead));

    if (sim.distanceTraveledKm === 0) {
      sim.vehicleBearing = initialBearing;
      sim.cameraBearing = initialBearing;
      sim.smoothZoom = 17;
      sim.currentSpeedKmh = 26;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.getElement().style.opacity = '0';
    }

    const startCoords = startPt.geometry.coordinates as [number, number];
    setVehiclePoint(map, startCoords, sim.vehicleBearing);

    // Smooth cinematic camera transition into 3D chase view
    const transitionDurationMs = 850;
    sim.cameraTransitionEnd = performance.now() + transitionDurationMs;

    map.easeTo({
      center: startCoords,
      zoom: 17,
      pitch: 65,
      bearing: sim.cameraBearing,
      duration: transitionDurationMs,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

    sim.lastFrameTime = performance.now();
    sim.lastHudSyncTime = 0;

    const tick = (now: number) => {
      const state = useNavStore.getState();
      if (state.simulationStatus !== 'playing' || !state.route) {
        stopLoop();
        return;
      }

      const dtSec = Math.min(0.05, Math.max(0.001, (now - sim.lastFrameTime) / 1000));
      sim.lastFrameTime = now;

      const distKm = sim.distanceTraveledKm;
      const currPt = along(state.route.geometry, distKm, { units: 'kilometers' });
      const nearPt = along(state.route.geometry, Math.min(totalKm, distKm + 0.015), {
        units: 'kilometers',
      });
      const farPt = along(state.route.geometry, Math.min(totalKm, distKm + 0.075), {
        units: 'kilometers',
      });

      const currHeading = normalizeBearing(turfBearing(currPt, nearPt));
      const upcomingHeading = normalizeBearing(turfBearing(nearPt, farPt));
      const turnSeverity = Math.abs(shortestAngleDelta(currHeading, upcomingHeading));

      const remainingKm = Math.max(0, totalKm - distKm);
      const trafficFactor = state.trafficAlertActive ? 0.58 : 1;

      // Dynamic Vice City speed curve: brake earlier for tight turns
      let targetSpeedKmh = 92 * trafficFactor;
      if (turnSeverity > 40) {
        targetSpeedKmh = 34 * trafficFactor;
      } else if (turnSeverity > 20) {
        targetSpeedKmh = 56 * trafficFactor;
      } else if (turnSeverity > 9) {
        targetSpeedKmh = 76 * trafficFactor;
      }

      if (remainingKm < 0.07) {
        targetSpeedKmh = Math.max(20, (remainingKm / 0.07) * 55);
      }

      const accelLerp = 1 - Math.exp(-dtSec * 3.0);
      sim.currentSpeedKmh += (targetSpeedKmh - sim.currentSpeedKmh) * accelLerp;

      // Advance strictly along the exact route geometry
      const kmPerSec = (sim.currentSpeedKmh / 3600) * 1.25;
      sim.distanceTraveledKm = Math.min(totalKm, sim.distanceTraveledKm + kmPerSec * dtSec);

      const newPt = along(state.route.geometry, sim.distanceTraveledKm, {
        units: 'kilometers',
      });
      const newCoords = newPt.geometry.coordinates as [number, number];

      // Tight 6-meter tangent lookahead keeps vehicle chevron locked to exact road direction
      const tightAheadPt = along(
        state.route.geometry,
        Math.min(totalKm, sim.distanceTraveledKm + 0.006),
        { units: 'kilometers' }
      );
      const exactRoadBearing =
        sim.distanceTraveledKm < totalKm - 0.002
          ? normalizeBearing(turfBearing(newPt, tightAheadPt))
          : sim.vehicleBearing;

      // Fast responsive rotation for the vehicle icon; smoother cinematic rotation for camera
      const vehicleRotLerp = 1 - Math.exp(-dtSec * 14);
      sim.vehicleBearing = normalizeBearing(
        sim.vehicleBearing +
          shortestAngleDelta(sim.vehicleBearing, exactRoadBearing) * vehicleRotLerp
      );

      const cameraRotLerp = 1 - Math.exp(-dtSec * 4.5);
      sim.cameraBearing = normalizeBearing(
        sim.cameraBearing +
          shortestAngleDelta(sim.cameraBearing, exactRoadBearing) * cameraRotLerp
      );

      // Update native WebGL vehicle layer (same frame & projection as the route line)
      setVehiclePoint(map, newCoords, sim.vehicleBearing);

      // Speed-reactive chase zoom
      const speedNorm = Math.min(1, Math.max(0, (sim.currentSpeedKmh - 28) / 70));
      const targetZoom = 17.35 - speedNorm * 0.6;
      sim.smoothZoom += (targetZoom - sim.smoothZoom) * (1 - Math.exp(-dtSec * 3.2));

      if (now >= sim.cameraTransitionEnd) {
        map.jumpTo({
          center: newCoords,
          bearing: sim.cameraBearing,
          pitch: 65,
          zoom: sim.smoothZoom,
        });
      }

      // Throttled HUD telemetry sync (~7 Hz)
      if (now - sim.lastHudSyncTime >= 140 || sim.distanceTraveledKm >= totalKm) {
        sim.lastHudSyncTime = now;
        const traveledMeters = sim.distanceTraveledKm * 1000;
        const totalMeters = state.route.distance;
        const remMeters = Math.max(0, totalMeters - traveledMeters);
        const progressRatio = totalMeters > 0 ? remMeters / totalMeters : 0;
        const remDuration = state.route.duration * progressRatio;

        const steps = state.route.steps;
        let stepIdx = 0;
        for (let i = 0; i < steps.length; i++) {
          if (traveledMeters >= steps[i].cumulativeDistance) {
            stepIdx = i;
          } else {
            break;
          }
        }

        const nextStepIdx = Math.min(steps.length - 1, stepIdx + 1);
        const distToNext =
          nextStepIdx > stepIdx
            ? Math.max(0, steps[nextStepIdx].cumulativeDistance - traveledMeters)
            : remMeters;

        state.updateSimulationTelemetry({
          speedKmh: Math.round(sim.currentSpeedKmh),
          currentStepIndex: nextStepIdx,
          distanceToNextTurn: distToNext,
          remainingDistance: remMeters,
          remainingDuration: remDuration,
        });
      }

      if (sim.distanceTraveledKm >= totalKm - 0.0005) {
        stopLoop();
        state.updateSimulationTelemetry({
          speedKmh: 0,
          currentStepIndex: Math.max(0, state.route.steps.length - 1),
          distanceToNextTurn: 0,
          remainingDistance: 0,
          remainingDuration: 0,
        });
        state.setSimulationStatus('completed');
        state.showAlert('info', `Arrived at ${state.destination?.name ?? 'destination'}!`);
        return;
      }

      sim.rafId = requestAnimationFrame(tick);
    };

    sim.rafId = requestAnimationFrame(tick);

    return () => {
      map?.off('style.load', handleStyleLoad);
      stopLoop();
    };
  }, [simulationStatus, route, mapRef, userMarkerRef]);
}
