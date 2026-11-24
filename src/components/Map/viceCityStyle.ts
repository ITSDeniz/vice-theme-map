import type maplibregl from 'maplibre-gl';

export const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

/**
 * Programmatically transforms the OpenFreeMap dark vector style into a
 * GTA 6 (Vice City / Leonida) midnight palette and injects a 3D building
 * fill-extrusion layer.
 */
export function applyViceCityTheme(map: maplibregl.Map): void {
  const style = map.getStyle();
  if (!style || !style.layers) return;

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

    // 1. Background -> deep midnight indigo
    if (layer.type === 'background') {
      safeSetPaint(layer.id, 'background-color', '#0a0a16');
      continue;
    }

    // 2. Water -> glowing midnight cyan-blue
    if (id.includes('water')) {
      if (layer.type === 'fill') {
        safeSetPaint(layer.id, 'fill-color', '#091833');
        safeSetPaint(layer.id, 'fill-outline-color', '#00f0ff');
      } else if (layer.type === 'line') {
        safeSetPaint(layer.id, 'line-color', '#0e3c66');
      }
      continue;
    }

    // 3. Parks / landcover / landuse -> subtle dark purple-slate
    if (
      id.includes('park') ||
      id.includes('landuse') ||
      id.includes('landcover') ||
      id.includes('grass') ||
      id.includes('wood') ||
      id.includes('forest')
    ) {
      if (layer.type === 'fill') {
        safeSetPaint(layer.id, 'fill-color', '#0e1124');
        safeSetPaint(layer.id, 'fill-opacity', 0.75);
      }
      continue;
    }

    // 4. Roads -> desaturated dark indigo with subtle magenta-violet highways
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
      if (id.includes('casing')) {
        safeSetPaint(layer.id, 'line-color', '#0d091a');
      } else if (id.includes('motorway') || id.includes('trunk')) {
        safeSetPaint(layer.id, 'line-color', '#2d1c45');
      } else if (id.includes('primary') || id.includes('secondary')) {
        safeSetPaint(layer.id, 'line-color', '#211c3a');
      } else {
        safeSetPaint(layer.id, 'line-color', '#17172e');
      }
      continue;
    }

    // 5. Flat 2D building footprints -> tone down so 3D extrusion shines
    if (id.includes('building') && layer.type === 'fill') {
      safeSetPaint(layer.id, 'fill-color', '#121226');
      safeSetPaint(layer.id, 'fill-opacity', 0.45);
      continue;
    }

    // 6. Labels -> crisp neon-tinted cool white with deep midnight halo
    if (layer.type === 'symbol') {
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

  // 7. Add 3D Vice City Buildings (fill-extrusion)
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
            'fill-extrusion-color': [
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
            'fill-extrusion-opacity': 0.88,
          },
        },
        firstSymbolLayerId
      );
    }
  }

  // 8. Subtle neon atmospheric lighting for 3D buildings
  try {
    map.setLight({
      anchor: 'viewport',
      color: '#ff66b2',
      intensity: 0.35,
      position: [1.2, 210, 35],
    });
  } catch {
    // Some MapLibre versions may handle light differently
  }
}
