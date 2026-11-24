import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useNavStore, MIAMI_DEFAULT_COORDS } from '../../store/useNavStore';
import { applyViceCityTheme, OPENFREEMAP_DARK_STYLE } from './viceCityStyle';

export function ViceMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const mapMode = useNavStore((s) => s.mapMode);
  const userLocation = useNavStore((s) => s.userLocation);
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
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync user marker position when userLocation updates
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userLocation);
    }
  }, [userLocation]);

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

  // Recenter camera on user location when requested (e.g., Locate Me)
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
