import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  Crosshair,
  Loader2,
  MapPin,
  Play,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import {
  searchPlaces,
  VICE_CITY_PRESETS,
  type GeocodingResult,
} from '../../services/geocoding';
import { fetchRoute } from '../../services/routing';
import { formatDistance, formatDuration, formatEtaClock } from '../../utils/format';
import { playNavChime, playUiClick } from '../../utils/audio';

type ActiveField = 'origin' | 'destination' | null;

export function SearchBar() {
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const userLocation = useNavStore((s) => s.userLocation);
  const origin = useNavStore((s) => s.origin);
  const pickingMode = useNavStore((s) => s.pickingMode);
  const destination = useNavStore((s) => s.destination);
  const route = useNavStore((s) => s.route);
  const isRouting = useNavStore((s) => s.isRouting);
  const simulationStatus = useNavStore((s) => s.simulationStatus);
  const remainingDistance = useNavStore((s) => s.remainingDistance);
  const remainingDuration = useNavStore((s) => s.remainingDuration);

  const setOrigin = useNavStore((s) => s.setOrigin);
  const setPickingMode = useNavStore((s) => s.setPickingMode);
  const setDestination = useNavStore((s) => s.setDestination);
  const setRoute = useNavStore((s) => s.setRoute);
  const setIsRouting = useNavStore((s) => s.setIsRouting);
  const setSimulationStatus = useNavStore((s) => s.setSimulationStatus);
  const clearRoute = useNavStore((s) => s.clearRoute);
  const resetSimulation = useNavStore((s) => s.resetSimulation);
  const showAlert = useNavStore((s) => s.showAlert);

  useEffect(() => {
    if (activeField !== 'origin') {
      setOriginQuery(origin ? origin.name : '');
    }
  }, [origin, activeField]);

  useEffect(() => {
    if (activeField !== 'destination') {
      setDestQuery(destination ? destination.name : '');
    }
  }, [destination, activeField]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentQuery = activeField === 'origin' ? originQuery : destQuery;

  useEffect(() => {
    if (!activeField) return;
    const trimmed = currentQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSearching(true);
      try {
        const items = await searchPlaces(
          trimmed,
          origin?.coordinates ?? userLocation,
          controller.signal
        );
        setResults(items);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          showAlert('warning', 'Search timed out. Try again or click on the map.');
        }
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [currentQuery, activeField, origin, userLocation, showAlert]);

  const calculateAndSetRoute = async (
    startCoords: [number, number],
    endCoords: [number, number],
    autoStartDemo = false
  ) => {
    setIsRouting(true);
    try {
      const routeData = await fetchRoute(startCoords, endCoords);
      setRoute(routeData);
      if (autoStartDemo) {
        playNavChime();
        setSimulationStatus('playing');
      } else {
        playUiClick();
      }
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to calculate route right now.';
      showAlert('error', msg);
      setRoute(null);
      return false;
    } finally {
      setIsRouting(false);
    }
  };

  const handleSelectPlace = async (
    place: GeocodingResult,
    autoStartDemo = false
  ) => {
    const targetField = activeField ?? 'destination';
    setActiveField(null);
    resetSimulation();

    if (targetField === 'origin') {
      setOriginQuery(place.name);
      setOrigin({
        name: place.name,
        displayName: place.displayName,
        coordinates: place.coordinates,
      });

      if (destination) {
        const ok = await calculateAndSetRoute(
          place.coordinates,
          destination.coordinates,
          autoStartDemo
        );
        if (!ok) {
          setOrigin(null);
          setOriginQuery('');
        }
      }
      return;
    }

    setDestQuery(place.name);
    setDestination({
      name: place.name,
      displayName: place.displayName,
      coordinates: place.coordinates,
    });

    const startCoords = origin?.coordinates ?? userLocation;
    const ok = await calculateAndSetRoute(
      startCoords,
      place.coordinates,
      autoStartDemo
    );
    if (!ok) {
      setDestination(null);
      setDestQuery('');
    }
  };

  const handleUseCurrentLocation = async () => {
    setOrigin(null);
    setOriginQuery('');
    setPickingMode('destination');
    if (destination) {
      resetSimulation();
      await calculateAndSetRoute(userLocation, destination.coordinates);
    }
  };

  const handleSwapPoints = async () => {
    if (!destination) return;
    resetSimulation();

    const prevOrigin = origin ?? {
      name: 'Current Location',
      displayName: 'Current Location',
      coordinates: userLocation,
    };
    const prevDest = destination;

    setOrigin(prevDest);
    setOriginQuery(prevDest.name);
    setDestination(prevOrigin);
    setDestQuery(prevOrigin.name);

    await calculateAndSetRoute(prevDest.coordinates, prevOrigin.coordinates);
  };

  const handleQuickDemoDrive = () => {
    setActiveField('destination');
    const oceanDrive = VICE_CITY_PRESETS[0];
    void handleSelectPlace(oceanDrive, true);
  };

  const handleClear = () => {
    setDestQuery('');
    setResults([]);
    setActiveField(null);
    setPickingMode('destination');
    clearRoute();
  };

  const showDropdown = activeField !== null;

  if (simulationStatus !== 'idle') {
    return (
      <div className="fixed top-16 sm:top-4 left-3 sm:left-4 z-30">
        <button
          type="button"
          onClick={() => {
            playUiClick();
            resetSimulation();
          }}
          className="hud-surface hover:bg-[var(--hud-hover)] active:scale-95 transition-all rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium cursor-pointer"
        >
          <Square className="w-3.5 h-3.5 text-[var(--accent-pink)]" />
          <span className="hidden sm:inline">Exit Drive</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed top-16 sm:top-4 left-3 right-3 sm:right-auto sm:left-4 z-30 sm:w-[356px] max-w-md flex flex-col gap-2"
    >
      {/* Dual From / To Search Panel */}
      <div className="hud-surface rounded-xl p-2.5">
        {/* Origin Row */}
        <div className="flex items-center gap-2.5 px-1.5 pb-2 border-b border-[var(--hud-divider)]">
          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
          <input
            type="text"
            value={originQuery}
            onFocus={() => setActiveField('origin')}
            onChange={(e) => setOriginQuery(e.target.value)}
            placeholder="Start: Current Location"
            aria-label="Starting point"
            className="w-full bg-transparent text-xs text-[var(--hud-text)] placeholder-[var(--hud-text-muted)] focus:outline-none"
          />

          {origin ? (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              title="Reset start to current location"
              aria-label="Reset start to current location"
              className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setPickingMode(pickingMode === 'origin' ? 'destination' : 'origin')
              }
              title="Click map to pick starting point"
              aria-label="Pick start point on map"
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                pickingMode === 'origin'
                  ? 'bg-sky-500/15 text-sky-500'
                  : 'text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)]'
              }`}
            >
              {pickingMode === 'origin' ? 'Click map' : 'Pick start'}
            </button>
          )}

          {destination && (
            <button
              type="button"
              onClick={handleSwapPoints}
              title="Swap start and destination"
              aria-label="Swap start and destination"
              className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Destination Row */}
        <div className="flex items-center gap-2.5 px-1.5 pt-2">
          {isSearching || isRouting ? (
            <Loader2 className="w-4 h-4 text-[var(--accent-pink)] animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-[var(--hud-text-muted)] shrink-0" />
          )}

          <input
            type="text"
            value={destQuery}
            onFocus={() => setActiveField('destination')}
            onChange={(e) => setDestQuery(e.target.value)}
            placeholder="Search destination or click map"
            aria-label="Search destination"
            className="w-full bg-transparent text-sm text-[var(--hud-text)] placeholder-[var(--hud-text-muted)] focus:outline-none"
          />

          {(destQuery || destination) && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear destination and route"
              className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Subtle Footer Action */}
        {!destination && !activeField && (
          <div className="px-1.5 pt-2 mt-2 border-t border-[var(--hud-divider)] flex items-center justify-between gap-2 text-[11px] text-[var(--hud-text-muted)]">
            <span className="truncate">
              {pickingMode === 'origin'
                ? 'Click anywhere on map to set start'
                : 'Click map to set destination'}
            </span>
            <button
              type="button"
              onClick={handleQuickDemoDrive}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-[var(--accent-pink)] hover:bg-[var(--accent-pink-hover)] active:scale-95 text-[11px] font-semibold text-white flex items-center gap-1 transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              Demo Drive
            </button>
          </div>
        )}
      </div>

      {/* Autocomplete / Presets Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="hud-surface-elevated rounded-xl overflow-hidden divide-y divide-[var(--hud-divider)] max-h-72 overflow-y-auto"
          >
            {currentQuery.trim().length < 2 ? (
              <div>
                <div className="px-3.5 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--hud-text-muted)]">
                  <span>
                    {activeField === 'origin'
                      ? 'Choose starting point'
                      : 'Popular destinations'}
                  </span>
                  {activeField === 'origin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveField(null);
                        void handleUseCurrentLocation();
                      }}
                      className="text-[11px] font-sans font-medium text-[var(--accent-pink)] hover:underline cursor-pointer normal-case"
                    >
                      Use my location
                    </button>
                  )}
                </div>
                {VICE_CITY_PRESETS.map((preset) => (
                  <button
                    key={preset.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(preset)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--hud-hover)] transition-colors flex items-start gap-2.5 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-[var(--hud-text-muted)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{preset.name}</p>
                      <p className="text-xs text-[var(--hud-text-muted)] truncate">
                        {preset.displayName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : isSearching ? (
              <div className="px-4 py-3.5 flex items-center gap-2 text-xs text-[var(--hud-text-muted)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching...
              </div>
            ) : results.length > 0 ? (
              results.map((item) => (
                <button
                  key={item.placeId}
                  type="button"
                  onClick={() => handleSelectPlace(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--hud-hover)] transition-colors flex items-start gap-2.5 cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-[var(--hud-text-muted)] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-[var(--hud-text-muted)] truncate">
                      {item.displayName}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-[var(--hud-text-muted)]">
                No results found.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route Summary Card (Flat typographic layout) */}
      <AnimatePresence>
        {destination && (route || isRouting) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="hud-surface rounded-xl p-3.5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--hud-text-muted)]">
                  Destination
                </span>
                <p className="text-sm font-semibold truncate mt-0.5">
                  {destination.name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear route"
                className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isRouting ? (
              <div className="flex items-center gap-2 text-xs text-[var(--hud-text-muted)] py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Calculating route...
              </div>
            ) : (
              route && (
                <>
                  <div className="grid grid-cols-3 divide-x divide-[var(--hud-divider)] pt-2.5 border-t border-[var(--hud-divider)]">
                    <div className="pr-2">
                      <span className="text-[10px] font-mono uppercase text-[var(--hud-text-muted)] block">
                        Time
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatDuration(remainingDuration)}
                      </span>
                    </div>

                    <div className="px-3">
                      <span className="text-[10px] font-mono uppercase text-[var(--hud-text-muted)] block">
                        Distance
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatDistance(remainingDistance)}
                      </span>
                    </div>

                    <div className="pl-3">
                      <span className="text-[10px] font-mono uppercase text-[var(--hud-text-muted)] block">
                        Arrival
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatEtaClock(remainingDuration)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playNavChime();
                      setSimulationStatus('playing');
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent-pink)] hover:bg-[var(--accent-pink-hover)] active:scale-[0.99] text-xs font-semibold tracking-wide text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Demo Drive
                  </button>
                </>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
