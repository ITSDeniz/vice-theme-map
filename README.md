# VICE NAV — 3D Navigation Web App

A high-performance, GTA 6 (Vice City / Leonida) inspired 3D navigation web application built with **React, TypeScript, MapLibre GL, and Turf.js**. Runs **100% free with zero API keys required**, deployed directly on Vercel.

---

## Features

- **Dual Light & Dark 3D Vice City Map**
  - **System-Aware Theme:** Starts in **Daylight (Light)** mode by default, or **Midnight (Dark)** mode automatically when the OS/browser uses `prefers-color-scheme: dark`, with a manual Sun/Moon toggle in the HUD.
  - **Vice City Daylight:** OpenFreeMap `liberty` vector tiles restyled with cool coastal concrete, bright Miami turquoise water, sandy beaches, palm-green parks, height-graded slate-blue 3D buildings, and clean street/district-only labeling.
  - **Vice City Midnight:** OpenFreeMap `dark` tiles with `#0a0a16` midnight base, glowing cyan water, magenta-lit 3D buildings, and smooth 2D/3D camera transitions.
- **Zero-Key Geocoding & Point-to-Point Routing**
  - Debounced **OpenStreetMap Nominatim** autocomplete search + popular Miami presets.
  - Custom **Start (A) → Destination (B)** routing: search any address, click directly on the map to pick start/end points, swap origin/destination, or use browser Geolocation (**Locate Me**).
  - Multi-layered **Neon Pink** route rendering with outer bloom and automatic validation against overseas/water clicks.
- **60 FPS Demo Drive & 3D Chase Camera**
  - Ref-isolated `requestAnimationFrame` simulation powered by `@turf/turf` (`along`, `bearing`, `length`).
  - Native **WebGL GeoJSON vehicle layer** locked to the road centerline with turn-aware braking, speed-reactive zoom, and `pitch: 65` chase camera.
  - Live **Turn-by-Turn** maneuver card synchronized with OSRM route steps and a digital automotive **Speedometer (km/h)**.
- **iFruit Radio (Keyless YouTube IFrame Player) & Dynamic HUD**
  - **Flash FM** & **VCRR** stations powered by the keyless **YouTube IFrame Player API** using persistent per-station players for instant switching.
  - **Fisher-Yates No-Repeat Shuffle**, Previous/Next track controls with playback history, Mute toggle, and a `<canvas>` audio equalizer.
  - **Unified Control Rail:** Traffic delay simulation, theme toggle, 2D/3D switch, GPS locate, 360° hold-to-rotate controls, and a live-rotating compass (`--map-bearing`).
  - **Auto-Hide HUD** during active driving inactivity via Framer Motion, plus subtle Web Audio API UI feedback sounds.

---

## Zero-Cost Tech Stack (No API Keys)

| Layer | Technology |
| :--- | :--- |
| **Framework** | Vite + React 19 + TypeScript |
| **Styling & Motion** | Tailwind CSS v4 + Framer Motion + Lucide React |
| **Typography** | Barlow & Barlow Condensed + JetBrains Mono |
| **State Management** | Zustand |
| **Map Engine** | `maplibre-gl` + OpenFreeMap Vector Tiles |
| **Routing** | OSRM Public API (`router.project-osrm.org`) |
| **Geocoding** | OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) |
| **Geospatial Math** | `@turf/turf` |
| **Radio & UI Audio** | YouTube IFrame Player API (keyless) + Web Audio API |

---

## Architecture & Performance

- **Render-Loop Isolation:** The `maplibre-gl.Map` instance, `requestAnimationFrame` simulation loop, live compass CSS variable (`--map-bearing`), and `<canvas>` equalizer run strictly inside `useRef` hooks outside React's state cycle.
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
1. Open the app (defaults to **Downtown Miami** in 3D, matching your system Light/Dark preference).
2. Click **Demo Drive** on the search bar for an instant trip to **Ocean Drive, South Beach** — or search/click any two points on land.
3. Use the top-right rail to toggle **Light/Dark**, **2D/3D**, **360° rotation**, or **Traffic Alert**, and press Play on **iFruit Radio** in the bottom-right.
