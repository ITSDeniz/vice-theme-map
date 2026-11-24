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
          {/* Non-intrusive red/blue police/traffic neon edge glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-20 pointer-events-none vice-alert-edge"
            aria-hidden="true"
          />

          {/* High Traffic / Rerouting Banner */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22 }}
            className={`fixed left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-rose-500/60 shadow-[0_0_24px_rgba(244,63,94,0.35)] flex items-center gap-2.5 ${
              isDrivingBannerVisible ? 'top-28 sm:top-32' : 'top-5'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
              <span className="text-rose-300 font-bold">High Traffic</span>
              <span className="text-slate-500">//</span>
              <span className="text-[#00f0ff]">Rerouting Speed</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
