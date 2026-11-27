import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { playUiClick } from '../../utils/audio';
import { useNavStore } from '../../store/useNavStore';

const STORAGE_KEY = 'vice_nav_disclaimer_seen_v1';

export function WelcomeDisclaimer() {
  const [isOpen, setIsOpen] = useState(false);
  const simulationStatus = useNavStore((s) => s.simulationStatus);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setIsOpen(true);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const handleClose = () => {
    playUiClick();
    setIsOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Ignore storage restrictions
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Subtle bottom-left info trigger to reopen notice when not driving */}
      {!isOpen && simulationStatus === 'idle' && (
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setIsOpen(true);
          }}
          aria-label="Open info & disclaimer"
          title="Info & Radio Notice"
          className="fixed bottom-2.5 left-3 sm:bottom-5 sm:left-4 z-30 hud-surface hover:bg-[var(--hud-hover)] active:scale-95 transition-all rounded-full w-8 h-8 flex items-center justify-center text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] cursor-pointer"
        >
          <Info className="w-4 h-4" />
        </button>
      )}

      <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vice-disclaimer-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="hud-surface-elevated rounded-2xl max-w-md w-full p-5 flex flex-col gap-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-pink)]/15 text-[var(--accent-pink)] flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="vice-disclaimer-title"
                    className="font-[var(--font-display)] text-base font-bold uppercase tracking-wider"
                  >
                    Welcome to VICE NAV
                  </h2>
                  <p className="text-[11px] text-[var(--hud-text-muted)]">
                    Interactive 3D Navigation Portfolio Demo
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close notice"
                className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs leading-relaxed text-[var(--hud-text-muted)] space-y-2.5 border-y border-[var(--hud-divider)] py-3">
              <p>
                This is an unofficial, fan-made frontend portfolio project
                inspired by GTA VI&apos;s Vice City aesthetic. It is not
                affiliated with Rockstar Games and runs 100% free with open map
                data.
              </p>
              <div className="rounded-lg bg-[var(--accent-pink)]/10 border border-[var(--accent-pink)]/25 px-3 py-2 text-[var(--hud-text)]">
                <strong className="font-semibold text-[var(--accent-pink)]">
                  iFruit Radio Notice:
                </strong>{' '}
                Stations stream embedded YouTube playlists. Depending on your
                browser or network, some tracks may require skipping or a
                YouTube sign-in check.
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent-pink)] hover:bg-[var(--accent-pink-hover)] active:scale-[0.99] font-[var(--font-display)] text-sm font-semibold uppercase tracking-wider text-white transition-all cursor-pointer"
            >
              Enter Map
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
