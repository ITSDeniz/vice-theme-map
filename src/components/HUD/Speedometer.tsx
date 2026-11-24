import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import { formatDistance, formatDuration } from '../../utils/format';

export function Speedometer() {
  const route = useNavStore((s) => s.route);
  const simulationStatus = useNavStore((s) => s.simulationStatus);
  const speedKmh = useNavStore((s) => s.simulationSpeedKmh);
  const remainingDistance = useNavStore((s) => s.remainingDistance);
  const remainingDuration = useNavStore((s) => s.remainingDuration);
  const setSimulationStatus = useNavStore((s) => s.setSimulationStatus);
  const resetSimulation = useNavStore((s) => s.resetSimulation);

  const isVisible = Boolean(route && simulationStatus !== 'idle');
  const maxSpeed = 130;
  const speedPct = Math.min(100, Math.max(0, (speedKmh / maxSpeed) * 100));

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.24 }}
          className="fixed bottom-4 left-3 right-3 sm:right-auto sm:bottom-5 sm:left-4 z-30"
        >
          <div className="hud-surface-elevated rounded-xl px-4 py-3 flex items-center justify-between sm:justify-start gap-4">
            {/* Digital Automotive Speed Readout */}
            <div className="w-20 flex flex-col">
              <div className="flex items-baseline gap-1 leading-none">
                <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">
                  {speedKmh}
                </span>
                <span className="text-[10px] font-mono uppercase text-[var(--hud-text-muted)]">
                  km/h
                </span>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-[var(--hud-divider)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-pink)] transition-[width] duration-150 ease-linear"
                  style={{ width: `${speedPct}%` }}
                />
              </div>
            </div>

            {/* Remaining Distance, ETA & Controls */}
            <div className="flex items-center gap-4 border-l border-[var(--hud-divider)] pl-4">
              <div className="flex items-center gap-3.5 text-xs tabular-nums">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--hud-text-muted)] block">
                    Rem
                  </span>
                  <span className="font-semibold">
                    {formatDistance(remainingDistance)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--hud-text-muted)] block">
                    ETA
                  </span>
                  <span className="font-semibold">
                    {formatDuration(remainingDuration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {simulationStatus === 'playing' ? (
                  <button
                    type="button"
                    onClick={() => setSimulationStatus('paused')}
                    aria-label="Pause demo drive"
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--hud-hover)] border border-[var(--hud-border)] text-xs font-medium flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSimulationStatus('playing')}
                    aria-label={
                      simulationStatus === 'completed'
                        ? 'Replay demo drive'
                        : 'Resume demo drive'
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-pink)] text-white text-xs font-medium flex items-center gap-1.5 hover:bg-[var(--accent-pink-hover)] transition-colors cursor-pointer"
                  >
                    {simulationStatus === 'completed' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Replay
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Resume
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetSimulation}
                  aria-label="Stop demo drive"
                  title="Stop Demo Drive"
                  className="p-1.5 rounded-lg hover:bg-[var(--hud-hover)] border border-[var(--hud-border)] text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
