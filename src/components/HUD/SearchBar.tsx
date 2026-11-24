import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search,
  Sparkles,
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

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const userLocation = useNavStore((s) => s.userLocation);
  const destination = useNavStore((s) => s.destination);
  const route = useNavStore((s) => s.route);
  const isRouting = useNavStore((s) => s.isRouting);
  const remainingDistance = useNavStore((s) => s.remainingDistance);
  const remainingDuration = useNavStore((s) => s.remainingDuration);

  const setDestination = useNavStore((s) => s.setDestination);
  const setRoute = useNavStore((s) => s.setRoute);
  const setIsRouting = useNavStore((s) => s.setIsRouting);
  const clearRoute = useNavStore((s) => s.clearRoute);
  const resetSimulation = useNavStore((s) => s.resetSimulation);
  const showAlert = useNavStore((s) => s.showAlert);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Nominatim search (450ms)
  useEffect(() => {
    const trimmed = query.trim();
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
        const items = await searchPlaces(trimmed, userLocation, controller.signal);
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
  }, [query, userLocation, showAlert]);

  const handleSelectPlace = async (place: GeocodingResult) => {
    setQuery(place.name);
    setIsFocused(false);
    resetSimulation();
    setDestination({
      name: place.name,
      displayName: place.displayName,
      coordinates: place.coordinates,
    });

    setIsRouting(true);
    try {
      const routeData = await fetchRoute(userLocation, place.coordinates);
      setRoute(routeData);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to calculate route right now.';
      showAlert('error', msg);
      setRoute(null);
    } finally {
      setIsRouting(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    clearRoute();
  };

  const showDropdown = isFocused && (query.trim().length >= 2 || !destination);

  return (
    <div
      ref={containerRef}
      className="fixed top-4 left-4 z-30 w-[calc(100vw-2rem)] sm:w-96 max-w-md flex flex-col gap-2.5"
    >
      {/* Search Input Card */}
      <div className="vice-glass rounded-2xl p-2 transition-all focus-within:border-[#ff007f]/70 focus-within:shadow-[0_0_24px_rgba(255,0,127,0.25)]">
        <div className="flex items-center gap-2.5 px-2 py-1">
          {isSearching || isRouting ? (
            <Loader2 className="w-4 h-4 text-[#ff007f] animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-[#ff007f] shrink-0" />
          )}

          <input
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Vice City or click map..."
            aria-label="Search destination"
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
          />

          {(query || destination) && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search and route"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hint bar when idle */}
        {!destination && !isFocused && (
          <div className="px-2 pb-1 pt-0.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#00f0ff]" />
              Click anywhere on map to drop a waypoint
            </span>
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
            {query.trim().length < 2 ? (
              <div>
                <div className="px-3.5 py-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#00f0ff]">
                  <Sparkles className="w-3 h-3" />
                  Leonida Hotspots
                </div>
                {VICE_CITY_PRESETS.map((preset) => (
                  <button
                    key={preset.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(preset)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#ff007f]/15 transition-colors flex items-start gap-2.5 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-[#ff007f] shrink-0 mt-0.5" />
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
                  <MapPin className="w-4 h-4 text-[#00f0ff] shrink-0 mt-0.5" />
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
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
