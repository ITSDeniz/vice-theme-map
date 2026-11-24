import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';

export function TrafficAlertOverlay() {
  const trafficAlertActive = useNavStore((s) => s.trafficAlertActive);
  const simulationStatus = useNavStore((s) => s.simulationStatus);
  const route = useNavStore((s) => s.route);

  const isDrivingBannerVisible = Boolean(route && simulationStatus !== 'idle');

  return (
    <AnimatePresence>
      {trafficAlertActive && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-20 pointer-events-none vice-alert-edge"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className={`fixed left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3.5 py-2 rounded-xl hud-surface-elevated border-rose-500/40 flex items-center gap-2 text-xs font-medium ${
              isDrivingBannerVisible ? 'top-28 sm:top-32' : 'top-5'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Traffic delay detected — adjusting speed</span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
