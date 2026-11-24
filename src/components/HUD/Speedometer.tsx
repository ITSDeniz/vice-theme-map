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
  const maxSpeed = 140;
  const speedRatio = Math.min(1, Math.max(0, speedKmh / maxSpeed));
  const arcRadius = 38;
  const arcCircumference = Math.PI * arcRadius; // half-circle gauge
  const strokeDashoffset = arcCircumference * (1 - speedRatio);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.94 }}
          transition={{ duration: 0.28 }}
          className="fixed bottom-5 left-4 z-30 flex items-end gap-3"
        >
          <div className="vice-glass rounded-2xl px-4 py-3 flex items-center gap-4">
            {/* Neon Arc Speed Gauge */}
            <div className="relative w-24 h-14 flex items-end justify-center">
              <svg
                viewBox="0 0 96 54"
                className="w-24 h-14 overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="viceSpeedGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00f0ff" />
                    <stop offset="55%" stopColor="#ff007f" />
                    <stop offset="100%" stopColor="#ff6b00" />
                  </linearGradient>
                </defs>
                {/* Track */}
                <path
                  d="M 10 46 A 38 38 0 0 1 86 46"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Active Neon Arc */}
                <path
                  d="M 10 46 A 38 38 0 0 1 86 46"
                  fill="none"
                  stroke="url(#viceSpeedGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={arcCircumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transition: 'stroke-dashoffset 140ms linear',
                    filter: 'drop-shadow(0 0 6px rgba(255,0,127,0.75))',
                  }}
                />
              </svg>

              <div className="absolute bottom-0 inset-x-0 flex flex-col items-center leading-none">
                <span className="font-mono text-2xl font-bold text-white tracking-tight">
                  {speedKmh}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#00f0ff]">
                  KM/H
                </span>
              </div>
            </div>

            {/* Telemetry & Playback Controls */}
            <div className="flex flex-col gap-2 border-l border-white/10 pl-3.5">
              <div className="flex items-center gap-3 text-xs font-mono">
                <div>
                  <span className="text-[9px] uppercase text-slate-400 block">
                    REM
                  </span>
                  <span className="text-slate-100 font-semibold">
                    {formatDistance(remainingDistance)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-slate-400 block">
                    ETA
                  </span>
                  <span className="text-[#ff6b00] font-semibold">
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
                    className="px-2.5 py-1.5 rounded-lg bg-[#ff007f]/20 hover:bg-[#ff007f]/35 border border-[#ff007f]/50 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 text-[#ff007f]" />
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
                    className="px-2.5 py-1.5 rounded-lg bg-[#00f0ff]/20 hover:bg-[#00f0ff]/35 border border-[#00f0ff]/50 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {simulationStatus === 'completed' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-[#00f0ff]" />
                        Replay
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-[#00f0ff]" />
                        Resume
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetSimulation}
                  aria-label="Stop demo drive"
                  title="Exit Demo Drive"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
