import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import { useNavStore, MIAMI_DEFAULT_COORDS } from '../../store/useNavStore';
import { applyViceCityTheme, OPENFREEMAP_DARK_STYLE } from './viceCityStyle';
import { reverseGeocode } from '../../services/geocoding';
import { fetchRoute } from '../../services/routing';

const ROUTE_SOURCE_ID = 'vice-route-source';
const ROUTE_BLOOM_LAYER_ID = 'vice-route-bloom';
const ROUTE_GLOW_LAYER_ID = 'vice-route-glow';
const ROUTE_CORE_LAYER_ID = 'vice-route-core';

const EMPTY_ROUTE_GEOJSON: Feature<LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [],
  },
};

function ensureRouteLayers(map: maplibregl.Map) {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_ROUTE_GEOJSON,
    });
  }

  // Outer wide neon bloom
  if (!map.getLayer(ROUTE_BLOOM_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_BLOOM_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#ff007f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 14, 16, 26],
        'line-blur': 14,
        'line-opacity': 0.42,
      },
    });
  }

  // Mid neon halo
  if (!map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_GLOW_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#ff2a95',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 16, 12],
        'line-blur': 4,
        'line-opacity': 0.85,
      },
    });
  }

  // Crisp glowing neon pink core
  if (!map.getLayer(ROUTE_CORE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CORE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#ffd6eb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 16, 4.5],
        'line-opacity': 0.98,
      },
    });
  }
}

export function ViceMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const styleLoadedRef = useRef<boolean>(false);

  const mapMode = useNavStore((s) => s.mapMode);
  const userLocation = useNavStore((s) => s.userLocation);
  const destination = useNavStore((s) => s.destination);
  const route = useNavStore((s) => s.route);
  const cameraRecenterNonce = useNavStore((s) => s.cameraRecenterNonce);

  // Initialize MapLibre instance once (strictly isolated outside React render cycle)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialMode = useNavStore.getState().mapMode;
    const initialLocation = useNavStore.getState().userLocation;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_DARK_STYLE,
      center: initialLocation ?? MIAMI_DEFAULT_COORDS,
      zoom: 15.2,
      pitch: initialMode === '3D' ? 58 : 0,
      bearing: initialMode === '3D' ? -17 : 0,
      maxPitch: 75,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on('style.load', () => {
      applyViceCityTheme(map);
      ensureRouteLayers(map);
      styleLoadedRef.current = true;

      // Render any route that was set before style finished loading
      const currentRoute = useNavStore.getState().route;
      const src = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (src && currentRoute) {
        src.setData(currentRoute.geometry);
      }
    });

    // Click on map to drop a destination pin and calculate route
    map.on('click', async (e) => {
      const store = useNavStore.getState();
      if (store.simulationStatus === 'playing') return;

      const clickedCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      store.resetSimulation();
      store.setDestination({
        name: 'Dropped Waypoint',
        displayName: `${clickedCoords[1].toFixed(5)}, ${clickedCoords[0].toFixed(5)}`,
        coordinates: clickedCoords,
      });
      store.setIsRouting(true);

      // Run reverse geocode and OSRM route in parallel
      const [placeInfo, routeResult] = await Promise.allSettled([
        reverseGeocode(clickedCoords),
        fetchRoute(store.userLocation, clickedCoords),
      ]);

      if (placeInfo.status === 'fulfilled') {
        useNavStore.getState().setDestination({
          name: placeInfo.value.name,
          displayName: placeInfo.value.displayName,
          coordinates: clickedCoords,
        });
      }

      if (routeResult.status === 'fulfilled') {
        useNavStore.getState().setRoute(routeResult.value);
      } else {
        const msg =
          routeResult.reason instanceof Error
            ? routeResult.reason.message
            : 'Unable to calculate route to that point.';
        useNavStore.getState().showAlert('error', msg);
        useNavStore.getState().setRoute(null);
      }

      useNavStore.getState().setIsRouting(false);
    });

    // Create custom pulsing Neon Cyan user marker
    const markerEl = document.createElement('div');
    markerEl.className = 'vice-user-marker';
    markerEl.innerHTML = `
      <div class="vice-user-marker-pulse"></div>
      <div class="vice-user-marker-core"></div>
    `;

    userMarkerRef.current = new maplibregl.Marker({
      element: markerEl,
      anchor: 'center',
    })
      .setLngLat(initialLocation)
      .addTo(map);

    return () => {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync user marker position
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userLocation);
    }
  }, [userLocation]);

  // Sync destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!destination) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      return;
    }

    if (!destMarkerRef.current) {
      const destEl = document.createElement('div');
      destEl.className = 'vice-dest-marker';
      destEl.innerHTML = `
        <div class="vice-dest-marker-ring"></div>
        <div class="vice-dest-marker-core"></div>
      `;
      destMarkerRef.current = new maplibregl.Marker({
        element: destEl,
        anchor: 'center',
      })
        .setLngLat(destination.coordinates)
        .addTo(map);
    } else {
      destMarkerRef.current.setLngLat(destination.coordinates);
    }
  }, [destination]);

  // Sync Neon Pink route GeoJSON and fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    ensureRouteLayers(map);
    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (!route) {
      source.setData(EMPTY_ROUTE_GEOJSON);
      return;
    }

    source.setData(route.geometry);

    const coords = route.geometry.geometry.coordinates;
    if (coords.length >= 2) {
      const bounds = new maplibregl.LngLatBounds(
        coords[0] as [number, number],
        coords[0] as [number, number]
      );
      for (const coord of coords) {
        bounds.extend(coord as [number, number]);
      }
      map.fitBounds(bounds, {
        padding: { top: 110, bottom: 130, left: 60, right: 60 },
        pitch: useNavStore.getState().mapMode === '3D' ? 45 : 0,
        duration: 950,
        maxZoom: 16,
      });
    }
  }, [route]);

  // Smoothly transition between 2D and 3D map perspectives
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: mapMode === '3D' ? 58 : 0,
      bearing: mapMode === '3D' ? -17 : 0,
      duration: 850,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  }, [mapMode]);

  // Recenter camera on user location when requested
  useEffect(() => {
    if (cameraRecenterNonce === 0) return;
    const map = mapRef.current;
    if (!map) return;

    const currentMode = useNavStore.getState().mapMode;
    map.flyTo({
      center: userLocation,
      zoom: 15.6,
      pitch: currentMode === '3D' ? 58 : 0,
      bearing: currentMode === '3D' ? -17 : 0,
      speed: 1.4,
      curve: 1.3,
      essential: true,
    });
  }, [cameraRecenterNonce, userLocation]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="vice-scanlines absolute inset-0 z-10" />
    </div>
  );
}
