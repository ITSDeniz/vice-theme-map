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
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:top-4 sm:right-4 z-30 flex items-center justify-between sm:justify-end gap-2">
      {/* Wordmark with subtle VI + palm trees emblem behind text */}
      <div className="hud-surface relative overflow-hidden rounded-xl px-3 sm:px-4 py-2 flex sm:hidden lg:flex items-baseline gap-1.5 order-1 sm:order-2">
        <svg
          viewBox="0 0 88 40"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-35 dark:opacity-45"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="viSunsetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8a3d" />
              <stop offset="52%" stopColor="#ff1f7a" />
              <stop offset="100%" stopColor="#6d28d9" />
            </linearGradient>
            <clipPath id="viPalmClip">
              {/* Bold geometric V */}
              <polygon points="10,4 23,4 32,27 41,4 54,4 37,36 27,36" />
              {/* Bold geometric I */}
              <rect x="60" y="4" width="14" height="32" rx="1" />
            </clipPath>
          </defs>

          <g clipPath="url(#viPalmClip)">
            <rect x="0" y="0" width="88" height="40" fill="url(#viSunsetGrad)" />
            {/* Left palm silhouette */}
            <path
              d="M27,38 Q29,28 26,20 M26,20 Q20,17 15,21 M26,20 Q21,14 16,14 M26,20 Q28,13 33,14 M26,20 Q32,17 36,21"
              stroke="#0f172a"
              strokeWidth="1.9"
              strokeLinecap="round"
              fill="none"
              opacity="0.78"
            />
            {/* Right palm silhouette */}
            <path
              d="M66,38 Q65,27 68,18 M68,18 Q62,15 58,19 M68,18 Q63,12 59,12 M68,18 Q70,11 75,13 M68,18 Q74,16 77,20"
              stroke="#0f172a"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
              opacity="0.78"
            />
          </g>
        </svg>

        <span className="relative z-10 font-[var(--font-display)] text-xs sm:text-sm font-bold tracking-[0.16em] uppercase">
          VICE
        </span>
        <span className="relative z-10 font-[var(--font-display)] text-[11px] sm:text-xs font-medium tracking-[0.12em] uppercase text-[var(--hud-text-muted)]">
          NAV
        </span>
      </div>

      {/* Unified Segmented Control Rail */}
      <div className="hud-surface rounded-xl flex items-center divide-x divide-[var(--hud-divider)] overflow-hidden order-2 sm:order-1">
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
