import type maplibregl from 'maplibre-gl';
import type { ThemeMode } from '../../types/nav';

export const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
export const OPENFREEMAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Programmatically transforms OpenFreeMap vector styles into either:
 * - 'light': GTA 6 Vice City / Leonida daylight satellite-vector look (cool concrete,
 *   bright Miami turquoise water, lush palm-green parks, white highways, 3D slate buildings)
 * - 'dark': Vice City midnight neon palette
 */
export function applyViceCityTheme(
  map: maplibregl.Map,
  theme: ThemeMode = 'light'
): void {
  const style = map.getStyle();
  if (!style || !style.layers) return;

  const isLight = theme === 'light';

  const safeSetPaint = (layerId: string, prop: string, value: unknown) => {
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, prop, value);
      }
    } catch {
      // Ignore paint properties unsupported on specific layer types
    }
  };

  let firstSymbolLayerId: string | undefined;
  let buildingSourceId: string | undefined;
  let buildingSourceLayer: string | undefined;

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();

    if (!firstSymbolLayerId && layer.type === 'symbol') {
      firstSymbolLayerId = layer.id;
    }

    if (
      'source' in layer &&
      typeof layer.source === 'string' &&
      'source-layer' in layer &&
      typeof layer['source-layer'] === 'string' &&
      layer['source-layer'].includes('building')
    ) {
      buildingSourceId = layer.source;
      buildingSourceLayer = layer['source-layer'];
    }

    // 1. Background
    if (layer.type === 'background') {
      safeSetPaint(
        layer.id,
        'background-color',
        isLight ? '#cbd5e1' : '#0a0a16'
      );
      continue;
    }

    // 2. Water
    if (id.includes('water')) {
      if (layer.type === 'fill') {
        safeSetPaint(layer.id, 'fill-color', isLight ? '#43badb' : '#091833');
        safeSetPaint(
          layer.id,
          'fill-outline-color',
          isLight ? '#2ca0c4' : '#00f0ff'
        );
      } else if (layer.type === 'line') {
        safeSetPaint(layer.id, 'line-color', isLight ? '#2c9ec2' : '#0e3c66');
      }
      continue;
    }

    // 3. Beaches / sand (light mode coastal detail)
    if (isLight && (id.includes('sand') || id.includes('beach'))) {
      if (layer.type === 'fill') {
        safeSetPaint(layer.id, 'fill-color', '#ede0b6');
      }
      continue;
    }

    // 4. Parks / landcover / landuse
    if (
      id.includes('park') ||
      id.includes('landuse') ||
      id.includes('landcover') ||
      id.includes('grass') ||
      id.includes('wood') ||
      id.includes('forest')
    ) {
      if (layer.type === 'fill') {
        safeSetPaint(
          layer.id,
          'fill-color',
          isLight ? '#72ad69' : '#0e1124'
        );
        safeSetPaint(layer.id, 'fill-opacity', isLight ? 0.85 : 0.75);
      }
      continue;
    }

    // 5. Roads
    if (
      layer.type === 'line' &&
      (id.includes('road') ||
        id.includes('highway') ||
        id.includes('motorway') ||
        id.includes('trunk') ||
        id.includes('street') ||
        id.includes('bridge') ||
        id.includes('tunnel') ||
        id.includes('path'))
    ) {
      if (isLight) {
        if (id.includes('casing')) {
          safeSetPaint(layer.id, 'line-color', '#a9b8ca');
        } else if (
          id.includes('motorway') ||
          id.includes('trunk') ||
          id.includes('primary') ||
          id.includes('secondary')
        ) {
          safeSetPaint(layer.id, 'line-color', '#ffffff');
        } else {
          safeSetPaint(layer.id, 'line-color', '#eef3f8');
        }
      } else {
        if (id.includes('casing')) {
          safeSetPaint(layer.id, 'line-color', '#0d091a');
        } else if (id.includes('motorway') || id.includes('trunk')) {
          safeSetPaint(layer.id, 'line-color', '#2d1c45');
        } else if (id.includes('primary') || id.includes('secondary')) {
          safeSetPaint(layer.id, 'line-color', '#211c3a');
        } else {
          safeSetPaint(layer.id, 'line-color', '#17172e');
        }
      }
      continue;
    }

    // 6. Flat 2D building footprints
    if (id.includes('building') && layer.type === 'fill') {
      safeSetPaint(
        layer.id,
        'fill-color',
        isLight ? '#9fb1c8' : '#121226'
      );
      safeSetPaint(layer.id, 'fill-opacity', isLight ? 0.5 : 0.45);
      continue;
    }

    // 7. Labels
    if (layer.type === 'symbol') {
      if (isLight) {
        if (id.includes('water')) {
          safeSetPaint(layer.id, 'text-color', '#0e5a78');
          safeSetPaint(layer.id, 'text-halo-color', '#bce9f7');
        } else if (
          id.includes('place') ||
          id.includes('city') ||
          id.includes('town') ||
          id.includes('suburb') ||
          id.includes('neighbourhood')
        ) {
          safeSetPaint(layer.id, 'text-color', '#ffffff');
          safeSetPaint(layer.id, 'text-halo-color', '#334155');
        } else {
          safeSetPaint(layer.id, 'text-color', '#334155');
          safeSetPaint(layer.id, 'text-halo-color', '#f8fafc');
        }
        safeSetPaint(layer.id, 'text-halo-width', 1.6);
      } else {
        if (id.includes('water')) {
          safeSetPaint(layer.id, 'text-color', '#38bdf8');
        } else if (id.includes('place') || id.includes('city') || id.includes('town')) {
          safeSetPaint(layer.id, 'text-color', '#f8fafc');
        } else {
          safeSetPaint(layer.id, 'text-color', '#94a3b8');
        }
        safeSetPaint(layer.id, 'text-halo-color', '#0a0a16');
        safeSetPaint(layer.id, 'text-halo-width', 1.4);
      }
    }
  }

  // 8. Add 3D Vice City Buildings (fill-extrusion)
  const extrusionLayerId = 'vice-3d-buildings';
  if (!map.getLayer(extrusionLayerId)) {
    const sourceId = buildingSourceId ?? 'openmaptiles';
    const sourceLayer = buildingSourceLayer ?? 'building';

    if (map.getSource(sourceId)) {
      map.addLayer(
        {
          id: extrusionLayerId,
          source: sourceId,
          'source-layer': sourceLayer,
          type: 'fill-extrusion',
          minzoom: 13.5,
          filter: ['!=', ['get', 'hide_3d'], true],
          paint: {
            'fill-extrusion-color': isLight
              ? [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
                  0,
                  '#b2c1d4',
                  25,
                  '#9db0c7',
                  60,
                  '#899eb8',
                  120,
                  '#758ba8',
                  200,
                  '#617896',
                ]
              : [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
                  0,
                  '#131329',
                  25,
                  '#1b1738',
                  60,
                  '#271c4a',
                  120,
                  '#3b1d5e',
                  200,
                  '#4c1d6e',
                ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13.5,
              0,
              14.5,
              ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
            ],
            'fill-extrusion-base': [
              'coalesce',
              ['get', 'render_min_height'],
              ['get', 'min_height'],
              0,
            ],
            'fill-extrusion-opacity': isLight ? 0.9 : 0.88,
          },
        },
        firstSymbolLayerId
      );
    }
  }

  // 9. Atmospheric lighting for 3D buildings
  try {
    map.setLight(
      isLight
        ? {
            anchor: 'viewport',
            color: '#fff8ed',
            intensity: 0.45,
            position: [1.2, 210, 40],
          }
        : {
            anchor: 'viewport',
            color: '#ff66b2',
            intensity: 0.35,
            position: [1.2, 210, 35],
          }
    );
  } catch {
    // Ignore light errors on unsupported styles
  }
}
