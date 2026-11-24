import { create } from 'zustand';
import type {
  Destination,
  LngLatTuple,
  MapMode,
  RouteData,
  SimulationStatus,
  ThemeMode,
  UIAlert,
} from '../types/nav';

export const MIAMI_DEFAULT_COORDS: LngLatTuple = [-80.1918, 25.7617];

function getInitialTheme(): ThemeMode {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

interface NavState {
  theme: ThemeMode;
  mapMode: MapMode;
  userLocation: LngLatTuple;
  isLocating: boolean;
  cameraRecenterNonce: number;
  rotateRequest: { id: number; deltaDeg: number } | null;

  origin: Destination | null;
  pickingMode: 'origin' | 'destination';
  destination: Destination | null;
  route: RouteData | null;
  isRouting: boolean;

  simulationStatus: SimulationStatus;
  simulationSpeedKmh: number;
  currentStepIndex: number;
  distanceToNextTurn: number;
  remainingDistance: number;
  remainingDuration: number;

  trafficAlertActive: boolean;
  uiAlert: UIAlert | null;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setMapMode: (mode: MapMode) => void;
  toggleMapMode: () => void;
  setUserLocation: (coords: LngLatTuple) => void;
  setIsLocating: (isLocating: boolean) => void;
  triggerCameraRecenter: () => void;
  requestMapRotate: (deltaDeg: number) => void;

  setOrigin: (origin: Destination | null) => void;
  setPickingMode: (mode: 'origin' | 'destination') => void;
  setDestination: (destination: Destination | null) => void;
  setRoute: (route: RouteData | null) => void;
  setIsRouting: (isRouting: boolean) => void;
  clearRoute: () => void;

  setSimulationStatus: (status: SimulationStatus) => void;
  updateSimulationTelemetry: (telemetry: {
    speedKmh: number;
    currentStepIndex: number;
    distanceToNextTurn: number;
    remainingDistance: number;
    remainingDuration: number;
  }) => void;
  resetSimulation: () => void;

  setTrafficAlertActive: (active: boolean) => void;
  toggleTrafficAlert: () => void;
  showAlert: (type: UIAlert['type'], message: string) => void;
  clearAlert: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  theme: getInitialTheme(),
  mapMode: '3D',
  userLocation: MIAMI_DEFAULT_COORDS,
  isLocating: false,
  cameraRecenterNonce: 0,
  rotateRequest: null,

  origin: null,
  pickingMode: 'destination',
  destination: null,
  route: null,
  isRouting: false,

  simulationStatus: 'idle',
  simulationSpeedKmh: 0,
  currentStepIndex: 0,
  distanceToNextTurn: 0,
  remainingDistance: 0,
  remainingDuration: 0,

  trafficAlertActive: false,
  uiAlert: null,

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setMapMode: (mapMode) => set({ mapMode }),
  toggleMapMode: () =>
    set((state) => ({ mapMode: state.mapMode === '3D' ? '2D' : '3D' })),
  setUserLocation: (userLocation) => set({ userLocation }),
  setIsLocating: (isLocating) => set({ isLocating }),
  triggerCameraRecenter: () =>
    set((state) => ({ cameraRecenterNonce: state.cameraRecenterNonce + 1 })),
  requestMapRotate: (deltaDeg) =>
    set({ rotateRequest: { id: Date.now() + Math.random(), deltaDeg } }),

  setOrigin: (origin) => set({ origin }),
  setPickingMode: (pickingMode) => set({ pickingMode }),
  setDestination: (destination) => set({ destination }),
  setRoute: (route) =>
    set({
      route,
      remainingDistance: route ? route.distance : 0,
      remainingDuration: route ? route.duration : 0,
      currentStepIndex: 0,
      distanceToNextTurn: route?.steps[0]?.distance ?? 0,
    }),
  setIsRouting: (isRouting) => set({ isRouting }),
  clearRoute: () =>
    set({
      destination: null,
      route: null,
      simulationStatus: 'idle',
      simulationSpeedKmh: 0,
      currentStepIndex: 0,
      distanceToNextTurn: 0,
      remainingDistance: 0,
      remainingDuration: 0,
    }),

  setSimulationStatus: (simulationStatus) => set({ simulationStatus }),
  updateSimulationTelemetry: ({
    speedKmh,
    currentStepIndex,
    distanceToNextTurn,
    remainingDistance,
    remainingDuration,
  }) =>
    set({
      simulationSpeedKmh: speedKmh,
      currentStepIndex,
      distanceToNextTurn,
      remainingDistance,
      remainingDuration,
    }),
  resetSimulation: () =>
    set((state) => ({
      simulationStatus: 'idle',
      simulationSpeedKmh: 0,
      currentStepIndex: 0,
      distanceToNextTurn: state.route?.steps[0]?.distance ?? 0,
      remainingDistance: state.route?.distance ?? 0,
      remainingDuration: state.route?.duration ?? 0,
    })),

  setTrafficAlertActive: (trafficAlertActive) => set({ trafficAlertActive }),
  toggleTrafficAlert: () =>
    set((state) => ({ trafficAlertActive: !state.trafficAlertActive })),
  showAlert: (type, message) =>
    set({
      uiAlert: {
        id: Date.now(),
        type,
        message,
      },
    }),
  clearAlert: () => set({ uiAlert: null }),
}));
