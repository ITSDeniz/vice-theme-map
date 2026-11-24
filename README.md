# VICE NAV — Leonida 3D Navigation Web App

A high-performance, GTA 6 (Vice City / Leonida) inspired 3D navigation web application built with **React, TypeScript, MapLibre GL, and Turf.js**. Designed to run **100% free with zero API keys required**, ready for instant deployment to Vercel or Netlify.

---

## Features

- **3D Vice City Midnight Map**
  - Programmatically restyled OpenFreeMap dark vector tiles (`#0a0a16` midnight base, glowing cyan water, desaturated indigo roads, neon pink atmospheric lighting).
  - Real-time 3D `fill-extrusion` buildings with height-interpolated twilight purple gradients and smooth 2D/3D camera transitions.
- **Zero-Key Geocoding & Point-to-Point Routing**
  - Debounced **OpenStreetMap Nominatim** autocomplete search + curated **Leonida Hotspots** presets.
  - Custom **Start (A) → Destination (B)** routing: type any address, click directly on the map to drop start/end pins, swap points, or use browser Geolocation (**Locate Me**).
  - Multi-layered **Neon Pink (`#ff007f`)** route rendering with outer bloom, mid halo, and crisp core, plus automatic validation against overseas/water snaps.
- **60 FPS Demo Drive & 3D Chase Camera**
  - Ref-isolated `requestAnimationFrame` simulation powered by `@turf/turf` (`along`, `bearing`, `length`).
  - Native **WebGL GeoJSON vehicle layer** locked to the road centerline with turn-aware braking, speed-reactive zoom, and `pitch: 65` chase camera.
  - Live **Turn-by-Turn** maneuver HUD synchronized with OSRM route steps and a neon arc **Speedometer (km/h)**.
- **iFruit Radio, Web Audio & Dynamic HUD**
  - Built-in **iFruit Radio** widget with 4 synthwave stations, animated `<canvas>` equalizer, and zero-asset **Web Audio API** synthesized UI clicks, chimes, and synth loops.
  - **Traffic / Alert Simulation** toggle with red/blue neon viewport edge glow, scanner tone, and simulated speed reduction.
  - **Auto-Hide HUD** during active driving inactivity, fading out secondary controls via Framer Motion and revealing them on pointer/touch/key input.

---

## Zero-Cost Tech Stack (No API Keys)

| Layer | Technology |
| :--- | :--- |
| **Framework** | Vite + React 19 + TypeScript |
| **Styling & Motion** | Tailwind CSS v4 + Framer Motion + Lucide React |
| **State Management** | Zustand |
| **Map Engine** | `maplibre-gl` + OpenFreeMap Vector Tiles |
| **Routing** | OSRM Public API (`router.project-osrm.org`) |
| **Geocoding** | OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) |
| **Geospatial Math** | `@turf/turf` |
| **Audio** | Native Web Audio API (zero external audio files) |

---

## Architecture & Performance

- **Render-Loop Isolation:** The `maplibre-gl.Map` instance, `requestAnimationFrame` simulation loop, and `<canvas>` equalizer run strictly inside `useRef` hooks outside React's state cycle.
- **Throttled HUD Sync:** React/Zustand telemetry (speedometer, remaining distance/ETA, next turn) is synced at ~7 Hz while the WebGL map camera and vehicle chevron update at 60 FPS.
- **Modular Structure:**
  - `src/components/Map/` — `ViceMap.tsx`, `viceCityStyle.ts`, `useDriveSimulation.ts`
  - `src/components/HUD/` — `SearchBar.tsx`, `MapControls.tsx`, `TurnByTurnCard.tsx`, `Speedometer.tsx`, `IFruitRadio.tsx`, `TrafficAlertOverlay.tsx`
  - `src/services/` — `geocoding.ts`, `routing.ts`
  - `src/store/` — `useNavStore.ts`
  - `src/utils/` — `audio.ts`, `format.ts`
  - `src/hooks/` — `useAutoHideHud.ts`

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Quick Demo Instructions
1. Open the app (defaults to **Downtown Miami / Vice City** in 3D).
2. Click **Demo Drive** on the search bar for an instant trip to **Ocean Drive, South Beach** — or search/click any two points on land.
3. Toggle **Alert** in the top-right to simulate high-traffic speed adjustments, or press Play on **iFruit Radio** in the bottom-right.
