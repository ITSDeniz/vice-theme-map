import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Layers,
  Loader2,
  X,
} from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import { playAlertTone, playUiClick } from '../../utils/audio';

export function MapControls() {
  const mapMode = useNavStore((s) => s.mapMode);
  const toggleMapMode = useNavStore((s) => s.toggleMapMode);
  const isLocating = useNavStore((s) => s.isLocating);
  const setIsLocating = useNavStore((s) => s.setIsLocating);
  const setUserLocation = useNavStore((s) => s.setUserLocation);
  const triggerCameraRecenter = useNavStore((s) => s.triggerCameraRecenter);
  const trafficAlertActive = useNavStore((s) => s.trafficAlertActive);
  const toggleTrafficAlert = useNavStore((s) => s.toggleTrafficAlert);
  const showAlert = useNavStore((s) => s.showAlert);

  const handleToggleMode = () => {
    playUiClick();
    toggleMapMode();
  };

  const handleRecenter = () => {
    playUiClick();
    triggerCameraRecenter();
  };

  const handleToggleTraffic = () => {
    if (!trafficAlertActive) {
      playAlertTone();
    } else {
      playUiClick();
    }
    toggleTrafficAlert();
  };

  const handleLocateMe = () => {
    playUiClick();
    if (!('geolocation' in navigator)) {
      showAlert('error', 'Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        triggerCameraRecenter();
        setIsLocating(false);
        showAlert('info', 'GPS lock acquired. Centered on your position.');
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          showAlert('warning', 'Location permission denied. Staying in Vice City (Miami).');
        } else {
          showAlert('warning', 'Unable to determine GPS position. Staying in Vice City.');
        }
        triggerCameraRecenter();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-30 flex sm:flex-col items-center sm:items-end gap-2 sm:gap-2.5">
      {/* Vice Nav Identity Pill */}
      <div className="vice-glass rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff007f] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff007f]" />
        </span>
        <div className="leading-none">
          <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold tracking-widest uppercase bg-gradient-to-r from-[#ff007f] via-[#ff6b00] to-[#00f0ff] bg-clip-text text-transparent">
            VICE NAV
          </span>
          <span className="ml-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase hidden lg:inline">
            LEONIDA OS
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleTraffic}
          aria-label="Toggle Traffic Alert Simulation"
          title="Simulate High Traffic / Alert"
          className={`active:scale-95 transition-all rounded-xl px-2.5 py-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider cursor-pointer ${
            trafficAlertActive
              ? 'bg-rose-500/25 border border-rose-500/70 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.4)]'
              : 'vice-glass hover:border-rose-400/60 text-slate-200'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 ${
              trafficAlertActive ? 'text-rose-400 animate-pulse' : 'text-[#ff6b00]'
            }`}
          />
          <span className="hidden md:inline font-mono">Alert</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMode}
          aria-label={`Switch to ${mapMode === '3D' ? '2D' : '3D'} view`}
          className="vice-glass-cyan hover:border-[#00f0ff]/70 active:scale-95 transition-all rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-100 cursor-pointer"
        >
          <Layers className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-mono">{mapMode}</span>
        </button>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          aria-label="Locate Me"
          className="vice-glass hover:border-[#ff007f]/70 active:scale-95 transition-all rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-100 cursor-pointer disabled:opacity-60"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 text-[#ff007f] animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4 text-[#ff007f]" />
          )}
          <span className="hidden sm:inline">Locate Me</span>
        </button>

        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Recenter camera"
          title="Recenter on active position"
          className="vice-glass hover:border-[#00f0ff]/60 active:scale-95 transition-all rounded-xl p-2.5 text-slate-200 cursor-pointer"
        >
          <Compass className="w-4 h-4 text-[#00f0ff]" />
        </button>
      </div>
    </div>
  );
}

export function AlertToast() {
  const uiAlert = useNavStore((s) => s.uiAlert);
  const clearAlert = useNavStore((s) => s.clearAlert);

  useEffect(() => {
    if (!uiAlert) return;
    const timer = window.setTimeout(() => {
      clearAlert();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [uiAlert, clearAlert]);

  const borderClass =
    uiAlert?.type === 'error'
      ? 'border-rose-500/60 text-rose-200'
      : uiAlert?.type === 'warning'
        ? 'border-[#ff6b00]/60 text-amber-100'
        : 'border-[#00f0ff]/50 text-cyan-100';

  return (
    <AnimatePresence>
      {uiAlert && (
        <motion.div
          key={uiAlert.id}
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] sm:max-w-md px-4 py-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border shadow-2xl flex items-center gap-3 text-xs sm:text-sm ${borderClass}`}
        >
          <span className="flex-1 leading-snug">{uiAlert.message}</span>
          <button
            type="button"
            onClick={clearAlert}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
