import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Layers,
  Loader2,
  Moon,
  RotateCcw,
  RotateCw,
  Sun,
  X,
} from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import { playAlertTone, playUiClick } from '../../utils/audio';

export function MapControls() {
  const theme = useNavStore((s) => s.theme);
  const toggleTheme = useNavStore((s) => s.toggleTheme);
  const mapMode = useNavStore((s) => s.mapMode);
  const toggleMapMode = useNavStore((s) => s.toggleMapMode);
  const isLocating = useNavStore((s) => s.isLocating);
  const setIsLocating = useNavStore((s) => s.setIsLocating);
  const setUserLocation = useNavStore((s) => s.setUserLocation);
  const triggerCameraRecenter = useNavStore((s) => s.triggerCameraRecenter);
  const requestMapRotate = useNavStore((s) => s.requestMapRotate);
  const trafficAlertActive = useNavStore((s) => s.trafficAlertActive);
  const toggleTrafficAlert = useNavStore((s) => s.toggleTrafficAlert);
  const showAlert = useNavStore((s) => s.showAlert);

  const rotateHoldIntervalRef = useRef<number | null>(null);

  const stopHoldRotate = () => {
    if (rotateHoldIntervalRef.current !== null) {
      window.clearInterval(rotateHoldIntervalRef.current);
      rotateHoldIntervalRef.current = null;
    }
  };

  const startHoldRotate = (deltaDeg: number) => {
    stopHoldRotate();
    playUiClick();
    requestMapRotate(deltaDeg);
    rotateHoldIntervalRef.current = window.setInterval(() => {
      requestMapRotate(deltaDeg * 0.5);
    }, 120);
  };

  useEffect(() => {
    return () => stopHoldRotate();
  }, []);

  const handleToggleMode = () => {
    playUiClick();
    toggleMapMode();
  };

  const handleToggleTheme = () => {
    playUiClick();
    toggleTheme();
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
        showAlert('info', 'Centered on your current location.');
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          showAlert('warning', 'Location permission denied. Staying in Miami.');
        } else {
          showAlert('warning', 'Unable to get GPS position. Staying in Miami.');
        }
        triggerCameraRecenter();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  const btnBase =
    'px-2.5 py-2 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors hover:bg-[var(--hud-hover)] active:opacity-75 cursor-pointer';

  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-30 flex items-center gap-2">
      {/* Unified Segmented Control Rail */}
      <div className="hud-surface rounded-xl flex items-center divide-x divide-[var(--hud-divider)] overflow-hidden">
        <button
          type="button"
          onClick={handleToggleTraffic}
          aria-label="Toggle traffic alert simulation"
          title="Simulate traffic delay"
          className={`${btnBase} ${
            trafficAlertActive ? 'bg-rose-500/15 text-rose-500' : ''
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className={btnBase}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleMode}
          aria-label={`Switch to ${mapMode === '3D' ? '2D' : '3D'} view`}
          title="Toggle 3D buildings"
          className={btnBase}
        >
          <Layers className="w-4 h-4" />
          <span className="font-mono text-[11px] font-semibold">{mapMode}</span>
        </button>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          aria-label="Locate Me"
          title="Center on my GPS location"
          className={`${btnBase} disabled:opacity-50`}
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onPointerDown={() => startHoldRotate(-45)}
          onPointerUp={stopHoldRotate}
          onPointerLeave={stopHoldRotate}
          onPointerCancel={stopHoldRotate}
          aria-label="Rotate map left"
          title="Rotate left (hold for 360°)"
          className={`${btnBase} hidden sm:flex`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onPointerDown={() => startHoldRotate(45)}
          onPointerUp={stopHoldRotate}
          onPointerLeave={stopHoldRotate}
          onPointerCancel={stopHoldRotate}
          aria-label="Rotate map right"
          title="Rotate right (hold for 360°)"
          className={`${btnBase} hidden sm:flex`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Reset north and recenter"
          title="Reset camera & bearing"
          className={btnBase}
        >
          <Compass
            className="w-4 h-4"
            style={{ transform: 'rotate(var(--map-bearing, 0deg))' }}
          />
        </button>
      </div>

      {/* Minimal Editorial Wordmark */}
      <div className="hud-surface rounded-xl px-3 py-2 hidden lg:flex items-baseline gap-1.5">
        <span className="font-[var(--font-display)] text-sm font-bold tracking-[0.16em] uppercase">
          VICE
        </span>
        <span className="font-[var(--font-display)] text-xs font-medium tracking-[0.12em] uppercase text-[var(--hud-text-muted)]">
          NAV
        </span>
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

  const indicatorColor =
    uiAlert?.type === 'error'
      ? 'bg-rose-500'
      : uiAlert?.type === 'warning'
        ? 'bg-amber-500'
        : 'bg-sky-500';

  return (
    <AnimatePresence>
      {uiAlert && (
        <motion.div
          key={uiAlert.id}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] sm:max-w-md px-3.5 py-2.5 rounded-xl hud-surface-elevated flex items-center gap-2.5 text-xs sm:text-sm"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${indicatorColor}`} />
          <span className="flex-1 leading-snug">{uiAlert.message}</span>
          <button
            type="button"
            onClick={clearAlert}
            aria-label="Dismiss notification"
            className="text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
