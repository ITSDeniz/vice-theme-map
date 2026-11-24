import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Route as RouteIcon,
  Search,
  Sparkles,
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

  // Sync displayed text when origin/destination updated from map click
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

  // Close dropdown on outside click
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

  // Debounced Nominatim search (450ms)
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
          showAlert('warning', 'Search service timed out. Try again or click the map.');
        }
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
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

  return (
    <div
      ref={containerRef}
      className="fixed top-4 left-4 z-30 w-[calc(100vw-2rem)] sm:w-96 max-w-md flex flex-col gap-2.5"
    >
      {/* Dual From / To Glassmorphic Search Card */}
      <div className="vice-glass rounded-2xl p-2.5 transition-all focus-within:border-[#ff007f]/70 focus-within:shadow-[0_0_24px_rgba(255,0,127,0.25)]">
        {/* Origin (From) Row */}
        <div className="flex items-center gap-2 px-1.5 pb-2 border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] shrink-0" />
          <input
            type="text"
            value={originQuery}
            onFocus={() => setActiveField('origin')}
            onChange={(e) => setOriginQuery(e.target.value)}
            placeholder="Start: Current Location (Miami)"
            aria-label="Starting point"
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-400 focus:outline-none"
          />

          {origin ? (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              title="Reset start to Current Location"
              aria-label="Reset start to Current Location"
              className="p-1 rounded-md text-[#00f0ff] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setPickingMode(pickingMode === 'origin' ? 'destination' : 'origin')
              }
              title="Click map to pick Start point"
              aria-label="Pick start point on map"
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                pickingMode === 'origin'
                  ? 'bg-[#00f0ff]/25 text-[#00f0ff] border border-[#00f0ff]/60'
                  : 'text-slate-400 hover:text-[#00f0ff] hover:bg-white/5'
              }`}
            >
              {pickingMode === 'origin' ? 'Click Map' : 'Set Start'}
            </button>
          )}

          {destination && (
            <button
              type="button"
              onClick={handleSwapPoints}
              title="Swap start and destination"
              aria-label="Swap start and destination"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Destination (To) Row */}
        <div className="flex items-center gap-2 px-1.5 pt-2">
          {isSearching || isRouting ? (
            <Loader2 className="w-4 h-4 text-[#ff007f] animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-[#ff007f] shrink-0" />
          )}

          <input
            type="text"
            value={destQuery}
            onFocus={() => setActiveField('destination')}
            onChange={(e) => setDestQuery(e.target.value)}
            placeholder="Search destination or click map..."
            aria-label="Search destination"
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
          />

          {(destQuery || destination) && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear destination and route"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hint bar & Quick Demo Drive button when idle */}
        {!destination && !activeField && (
          <div className="px-1.5 pt-2 mt-1.5 border-t border-white/5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin
                className={`w-3 h-3 shrink-0 ${
                  pickingMode === 'origin' ? 'text-[#00f0ff]' : 'text-[#ff007f]'
                }`}
              />
              <span className="truncate">
                {pickingMode === 'origin'
                  ? 'Click map to set starting point'
                  : 'Click map to drop destination'}
              </span>
            </span>
            <button
              type="button"
              onClick={handleQuickDemoDrive}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#ff007f] to-[#ff6b00] hover:brightness-110 active:scale-95 text-[11px] font-semibold text-white flex items-center gap-1 shadow-[0_0_16px_rgba(255,0,127,0.45)] transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              Demo Drive
            </button>
          </div>
        )}
      </div>

      {/* Autocomplete / Quick Presets Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="vice-glass rounded-2xl overflow-hidden divide-y divide-white/5 max-h-72 overflow-y-auto"
          >
            {currentQuery.trim().length < 2 ? (
              <div>
                <div className="px-3.5 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[#00f0ff]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {activeField === 'origin'
                      ? 'Pick Starting Point'
                      : 'Leonida Hotspots'}
                  </span>
                  {activeField === 'origin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveField(null);
                        void handleUseCurrentLocation();
                      }}
                      className="text-[10px] text-[#ff007f] hover:underline cursor-pointer"
                    >
                      Use My Location
                    </button>
                  )}
                </div>
                {VICE_CITY_PRESETS.map((preset) => (
                  <button
                    key={preset.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(preset)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#ff007f]/15 transition-colors flex items-start gap-2.5 cursor-pointer"
                  >
                    <MapPin
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        activeField === 'origin' ? 'text-[#00f0ff]' : 'text-[#ff007f]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {preset.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {preset.displayName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : isSearching ? (
              <div className="px-4 py-4 flex items-center gap-2.5 text-xs text-slate-300">
                <Loader2 className="w-4 h-4 text-[#00f0ff] animate-spin" />
                Scanning Leonida grid...
              </div>
            ) : results.length > 0 ? (
              results.map((item) => (
                <button
                  key={item.placeId}
                  type="button"
                  onClick={() => handleSelectPlace(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#ff007f]/15 transition-colors flex items-start gap-2.5 cursor-pointer"
                >
                  <MapPin
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      activeField === 'origin' ? 'text-[#00f0ff]' : 'text-[#ff007f]'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {item.displayName}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-slate-400">
                No locations found. Try another search or click on the map.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route Summary Card */}
      <AnimatePresence>
        {destination && (route || isRouting) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="vice-glass rounded-2xl p-3.5 flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#ff007f]">
                  <Navigation className="w-3 h-3" />
                  Active Waypoint
                </div>
                <p className="text-sm font-semibold text-white truncate mt-0.5">
                  {destination.name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear route"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isRouting ? (
              <div className="flex items-center gap-2 text-xs text-[#00f0ff] py-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating optimal neon route...
              </div>
            ) : (
              route && (
                <>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                    <div className="bg-white/5 rounded-xl px-2.5 py-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-mono">
                        <Clock className="w-3 h-3 text-[#00f0ff]" />
                        Duration
                      </div>
                      <p className="text-sm font-bold font-mono text-white mt-0.5">
                        {formatDuration(remainingDuration)}
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-xl px-2.5 py-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-mono">
                        <RouteIcon className="w-3 h-3 text-[#ff007f]" />
                        Distance
                      </div>
                      <p className="text-sm font-bold font-mono text-white mt-0.5">
                        {formatDistance(remainingDistance)}
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-xl px-2.5 py-2">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">
                        ETA
                      </div>
                      <p className="text-sm font-bold font-mono text-[#ff6b00] mt-0.5">
                        {formatEtaClock(remainingDuration)}
                      </p>
                    </div>
                  </div>

                  {simulationStatus === 'idle' ? (
                    <button
                      type="button"
                      onClick={() => {
                        playNavChime();
                        setSimulationStatus('playing');
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ff007f] via-[#ff2a85] to-[#ff6b00] hover:brightness-110 active:scale-[0.98] text-xs font-bold uppercase tracking-widest text-white flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,0,127,0.45)] transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Start Demo Drive
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resetSimulation}
                      className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 text-[#ff007f]" />
                      Exit Demo Drive
                    </button>
                  )}
                </>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
