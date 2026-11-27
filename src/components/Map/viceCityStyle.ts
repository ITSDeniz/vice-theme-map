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
  let transportSourceId: string | undefined;
  let transportSourceLayer: string | undefined;

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();

    if (!firstSymbolLayerId && layer.type === 'symbol') {
      firstSymbolLayerId = layer.id;
    }

    if (
      'source' in layer &&
      typeof layer.source === 'string' &&
      'source-layer' in layer &&
      typeof layer['source-layer'] === 'string'
    ) {
      if (layer['source-layer'].includes('building')) {
        buildingSourceId = layer.source;
        buildingSourceLayer = layer['source-layer'];
      } else if (layer['source-layer'] === 'transportation') {
        transportSourceId = layer.source;
        transportSourceLayer = layer['source-layer'];
      }
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
          safeSetPaint(layer.id, 'line-color', '#0a0714');
        } else if (id.includes('motorway') || id.includes('trunk')) {
          safeSetPaint(layer.id, 'line-color', '#3a245c');
        } else if (id.includes('primary') || id.includes('secondary')) {
          safeSetPaint(layer.id, 'line-color', '#29214a');
        } else {
          safeSetPaint(layer.id, 'line-color', '#1a1a34');
        }
      }
      continue;
    }

    // 6. Flat 2D building footprints & hide any pre-existing 3D building layer so ours is authoritative
    if (id.includes('building') && layer.type === 'fill-extrusion' && layer.id !== 'vice-3d-buildings') {
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      } catch {
        // ignore
      }
      continue;
    }

    if (id.includes('building') && layer.type === 'fill') {
      safeSetPaint(
        layer.id,
        'fill-color',
        isLight ? '#cfdbe8' : '#121226'
      );
      safeSetPaint(layer.id, 'fill-opacity', isLight ? 0.55 : 0.45);
      continue;
    }

    // 7. Labels (hide noisy POI / transit / parking / highway shield icons in light mode)
    if (layer.type === 'symbol') {
      if (
        isLight &&
        (id.includes('poi') ||
          id.includes('shield') ||
          id.includes('transit') ||
          id.includes('airport') ||
          id.includes('aerodrome') ||
          id.includes('housenumber'))
      ) {
        try {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch {
          // ignore
        }
        continue;
      }

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

  // 8. Elevated Bridges & Overpasses (3D shadow, deck thickness, edge rails & surface)
  const tSourceId = transportSourceId ?? 'openmaptiles';
  const tSourceLayer = transportSourceLayer ?? 'transportation';

  if (map.getSource(tSourceId) && !map.getLayer('vice-bridge-shadow')) {
    const bridgeFilter: maplibregl.FilterSpecification = [
      'all',
      ['==', ['get', 'brunnel'], 'bridge'],
      [
        'in',
        ['get', 'class'],
        ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']],
      ],
    ];

    const widthScale = (extra: number): maplibregl.ExpressionSpecification => [
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      10,
      ['match', ['get', 'class'], ['motorway', 'trunk'], 2.5 + extra, 1.5 + extra],
      14,
      ['match', ['get', 'class'], ['motorway', 'trunk'], 8 + extra, ['primary', 'secondary'], 6 + extra, 4 + extra],
      18,
      ['match', ['get', 'class'], ['motorway', 'trunk'], 20 + extra, ['primary', 'secondary'], 15 + extra, 10 + extra],
    ];

    // Drop shadow cast onto water/ground below elevated bridges
    map.addLayer(
      {
        id: 'vice-bridge-shadow',
        type: 'line',
        source: tSourceId,
        'source-layer': tSourceLayer,
        minzoom: 11,
        filter: bridgeFilter,
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': isLight ? 'rgba(15, 23, 42, 0.30)' : 'rgba(0, 0, 0, 0.75)',
          'line-width': widthScale(4),
          'line-blur': 4,
          'line-translate': [5, 9],
          'line-translate-anchor': 'viewport',
        },
      },
      firstSymbolLayerId
    );

    // Structural concrete/steel deck edge
    map.addLayer(
      {
        id: 'vice-bridge-deck',
        type: 'line',
        source: tSourceId,
        'source-layer': tSourceLayer,
        minzoom: 11,
        filter: bridgeFilter,
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': isLight ? '#64748b' : '#2e1065',
          'line-width': widthScale(4.5),
        },
      },
      firstSymbolLayerId
    );

    // Crisp illuminated bridge guardrails
    map.addLayer(
      {
        id: 'vice-bridge-rails',
        type: 'line',
        source: tSourceId,
        'source-layer': tSourceLayer,
        minzoom: 12,
        filter: bridgeFilter,
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': isLight ? '#38bdf8' : '#00f0ff',
          'line-opacity': isLight ? 0.65 : 0.55,
          'line-width': widthScale(2),
        },
      },
      firstSymbolLayerId
    );

    // Clean top asphalt surface
    map.addLayer(
      {
        id: 'vice-bridge-surface',
        type: 'line',
        source: tSourceId,
        'source-layer': tSourceLayer,
        minzoom: 11,
        filter: bridgeFilter,
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': isLight ? '#ffffff' : '#352559',
          'line-width': widthScale(0),
        },
      },
      firstSymbolLayerId
    );
  }

  // 9. Add 3D Vice City Buildings (fill-extrusion)
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
                  '#e5ecf3',
                  18,
                  '#cedce9',
                  45,
                  '#adc3da',
                  95,
                  '#86a5c6',
                  170,
                  '#6386ad',
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
            'fill-extrusion-opacity': isLight ? 0.98 : 0.95,
          },
        },
        firstSymbolLayerId
      );
    }
  }

  // 10. Atmospheric lighting for 3D buildings
  try {
    map.setLight(
      isLight
        ? {
            anchor: 'viewport',
            color: '#eef6ff',
            intensity: 0.42,
            position: [1.2, 210, 42],
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
