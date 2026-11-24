import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { along, bearing as turfBearing, length as turfLength } from '@turf/turf';
import { useNavStore } from '../../store/useNavStore';

/**
 * Computes the shortest signed angular difference in degrees [-180, 180].
 */
function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let diff = ((toDeg - fromDeg + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Normalizes any bearing to [0, 360).
 */
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
  smoothBearing: number;
  smoothZoom: number;
  isTransitioningCamera: boolean;
  cameraTransitionEnd: number;
}

/**
 * 60 FPS Demo Drive simulation hook.
 * Strictly isolates requestAnimationFrame, Turf.js geospatial math, vehicle marker,
 * and MapLibre 3D chase camera inside refs so React never re-renders per frame.
 */
export function useDriveSimulation(
  mapRef: React.RefObject<maplibregl.Map | null>,
  userMarkerRef: React.RefObject<maplibregl.Marker | null>
) {
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const simRef = useRef<SimRefs>({
    rafId: null,
    lastFrameTime: 0,
    lastHudSyncTime: 0,
    distanceTraveledKm: 0,
    totalLengthKm: 0,
    currentSpeedKmh: 0,
    smoothBearing: 0,
    smoothZoom: 17,
    isTransitioningCamera: false,
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

    if (!route && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
      if (userMarkerRef.current) {
        userMarkerRef.current.getElement().style.opacity = '1';
      }
    }
  }, [route, userMarkerRef]);

  useEffect(() => {
    const map = mapRef.current;
    const sim = simRef.current;

    const stopLoop = () => {
      if (sim.rafId !== null) {
        cancelAnimationFrame(sim.rafId);
        sim.rafId = null;
      }
    };

    // Idle or no route -> remove vehicle marker & show static user marker
    if (!map || !route || simulationStatus === 'idle') {
      stopLoop();
      sim.distanceTraveledKm = 0;
      sim.currentSpeedKmh = 0;
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.getElement().style.opacity = '1';
      }
      return;
    }

    // Paused or completed -> freeze loop, keep marker visible
    if (simulationStatus === 'paused' || simulationStatus === 'completed') {
      stopLoop();
      return;
    }

    // Ensure total length is computed
    const totalKm = turfLength(route.geometry, { units: 'kilometers' });
    sim.totalLengthKm = totalKm;
    if (totalKm <= 0.001) {
      useNavStore.getState().setSimulationStatus('completed');
      return;
    }

    // If restarting from completed/end, reset to start
    if (sim.distanceTraveledKm >= totalKm - 0.002) {
      sim.distanceTraveledKm = 0;
    }

    // Compute initial point and bearing
    const startPt = along(route.geometry, sim.distanceTraveledKm, { units: 'kilometers' });
    const lookAheadPt = along(
      route.geometry,
      Math.min(totalKm, sim.distanceTraveledKm + 0.025),
      { units: 'kilometers' }
    );
    const initialBearing = normalizeBearing(turfBearing(startPt, lookAheadPt));

    if (sim.distanceTraveledKm === 0) {
      sim.smoothBearing = initialBearing;
      sim.smoothZoom = 17;
      sim.currentSpeedKmh = 28;
    }

    // Hide static user marker while vehicle marker is active
    if (userMarkerRef.current) {
      userMarkerRef.current.getElement().style.opacity = '0';
    }

    // Create custom neon vehicle marker if not present
    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'vice-vehicle-marker';
      el.innerHTML = `
        <div class="vice-vehicle-glow"></div>
        <svg viewBox="0 0 36 36" width="36" height="36" class="vice-vehicle-arrow">
          <defs>
            <linearGradient id="viceCarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00f0ff" />
              <stop offset="100%" stop-color="#ff007f" />
            </linearGradient>
          </defs>
          <path d="M18 3 L30 29 L18 23.5 L6 29 Z" fill="url(#viceCarGrad)" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
        </svg>
      `;

      vehicleMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        rotationAlignment: 'map',
        pitchAlignment: 'map',
      })
        .setLngLat(startPt.geometry.coordinates as [number, number])
        .setRotation(sim.smoothBearing)
        .addTo(map);
    }

    // Smooth cinematic camera transition into 3D chase view
    sim.isTransitioningCamera = true;
    const transitionDurationMs = 900;
    sim.cameraTransitionEnd = performance.now() + transitionDurationMs;

    map.easeTo({
      center: startPt.geometry.coordinates as [number, number],
      zoom: 17,
      pitch: 65,
      bearing: sim.smoothBearing,
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

      const dtSec = Math.min(0.08, Math.max(0.001, (now - sim.lastFrameTime) / 1000));
      sim.lastFrameTime = now;

      // Look ahead to sense upcoming corners and adjust target speed realistically
      const distKm = sim.distanceTraveledKm;
      const currPt = along(state.route.geometry, distKm, { units: 'kilometers' });
      const nearPt = along(state.route.geometry, Math.min(totalKm, distKm + 0.025), {
        units: 'kilometers',
      });
      const farPt = along(state.route.geometry, Math.min(totalKm, distKm + 0.09), {
        units: 'kilometers',
      });

      const instantBearing = normalizeBearing(turfBearing(currPt, nearPt));
      const upcomingBearing = normalizeBearing(turfBearing(nearPt, farPt));
      const turnSeverity = Math.abs(shortestAngleDelta(instantBearing, upcomingBearing));

      const remainingKm = Math.max(0, totalKm - distKm);
      const trafficFactor = state.trafficAlertActive ? 0.58 : 1;

      // Dynamic Vice City driving speed profile (km/h)
      let targetSpeedKmh = 96 * trafficFactor;
      if (turnSeverity > 45) {
        targetSpeedKmh = 42 * trafficFactor;
      } else if (turnSeverity > 22) {
        targetSpeedKmh = 64 * trafficFactor;
      } else if (turnSeverity > 10) {
        targetSpeedKmh = 80 * trafficFactor;
      }

      // Smoothly decelerate on final approach
      if (remainingKm < 0.08) {
        targetSpeedKmh = Math.max(24, (remainingKm / 0.08) * 60);
      }

      // Smooth acceleration/braking
      const accelLerp = 1 - Math.exp(-dtSec * 2.6);
      sim.currentSpeedKmh += (targetSpeedKmh - sim.currentSpeedKmh) * accelLerp;

      // Advance vehicle along route (slight 1.35x demo pacing factor so portfolio trips feel lively)
      const kmPerSec = (sim.currentSpeedKmh / 3600) * 1.35;
      sim.distanceTraveledKm = Math.min(totalKm, sim.distanceTraveledKm + kmPerSec * dtSec);

      const newPt = along(state.route.geometry, sim.distanceTraveledKm, {
        units: 'kilometers',
      });
      const newCoords = newPt.geometry.coordinates as [number, number];

      // Smooth bearing interpolation
      const bearingLerp = 1 - Math.exp(-dtSec * 5.2);
      const bearingDelta = shortestAngleDelta(sim.smoothBearing, instantBearing);
      sim.smoothBearing = normalizeBearing(sim.smoothBearing + bearingDelta * bearingLerp);

      // Update vehicle marker at 60 FPS directly in DOM/MapLibre
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLngLat(newCoords);
        vehicleMarkerRef.current.setRotation(sim.smoothBearing);
      }

      // Dynamic speed-sensitive zoom (zooms out slightly at high speed, tighter on turns)
      const speedNorm = Math.min(1, Math.max(0, (sim.currentSpeedKmh - 30) / 75));
      const targetZoom = 17.3 - speedNorm * 0.65;
      sim.smoothZoom += (targetZoom - sim.smoothZoom) * (1 - Math.exp(-dtSec * 3.0));

      // Lock 3D chase camera after initial easeTo transition finishes
      if (now >= sim.cameraTransitionEnd) {
        sim.isTransitioningCamera = false;
        map.jumpTo({
          center: newCoords,
          bearing: sim.smoothBearing,
          pitch: 65,
          zoom: sim.smoothZoom,
        });
      }

      // Throttled HUD telemetry sync (~7 Hz) to keep React ultra-fast
      if (now - sim.lastHudSyncTime >= 140 || sim.distanceTraveledKm >= totalKm) {
        sim.lastHudSyncTime = now;
        const traveledMeters = sim.distanceTraveledKm * 1000;
        const totalMeters = state.route.distance;
        const remMeters = Math.max(0, totalMeters - traveledMeters);
        const progressRatio = totalMeters > 0 ? remMeters / totalMeters : 0;
        const remDuration = state.route.duration * progressRatio;

        // Find active OSRM step
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

      // Check arrival
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
      stopLoop();
    };
  }, [simulationStatus, route, mapRef, userMarkerRef]);
}
