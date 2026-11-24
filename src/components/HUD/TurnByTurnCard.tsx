import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitFork,
  RotateCw,
  TrendingUp,
} from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import { formatDistance } from '../../utils/format';

function ManeuverIcon({
  type,
  modifier,
}: {
  type: string;
  modifier?: string;
}) {
  const cls = 'w-7 h-7 text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.75)]';

  if (type === 'arrive') {
    return <Flag className="w-7 h-7 text-[#ff007f] drop-shadow-[0_0_8px_rgba(255,0,127,0.8)]" />;
  }
  if (type === 'roundabout' || type === 'rotary') {
    return <RotateCw className={cls} />;
  }
  if (type === 'fork') {
    return <GitFork className={cls} />;
  }
  if (modifier?.includes('left')) {
    return <CornerUpLeft className={cls} />;
  }
  if (modifier?.includes('right')) {
    return <CornerUpRight className={cls} />;
  }
  if (type === 'merge' || type === 'on ramp' || type === 'off ramp') {
    return <TrendingUp className={cls} />;
  }
  return <ArrowUp className={cls} />;
}

export function TurnByTurnCard() {
  const route = useNavStore((s) => s.route);
  const simulationStatus = useNavStore((s) => s.simulationStatus);
  const currentStepIndex = useNavStore((s) => s.currentStepIndex);
  const distanceToNextTurn = useNavStore((s) => s.distanceToNextTurn);

  const isVisible = Boolean(route && simulationStatus !== 'idle');
  const activeStep = route?.steps[currentStepIndex] ?? route?.steps[0];
  const followingStep = route?.steps[currentStepIndex + 1];

  return (
    <AnimatePresence>
      {isVisible && activeStep && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.28 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[340px] max-w-md pointer-events-auto"
        >
          <div className="vice-glass-cyan rounded-2xl p-3.5 shadow-[0_0_32px_rgba(0,240,255,0.16)]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/35 flex items-center justify-center shrink-0">
                <ManeuverIcon
                  type={activeStep.maneuverType}
                  modifier={activeStep.maneuverModifier}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-bold text-[#00f0ff] tracking-tight">
                    {simulationStatus === 'completed'
                      ? 'ARRIVED'
                      : `In ${formatDistance(distanceToNextTurn)}`}
                  </span>
                  {activeStep.streetName && (
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 truncate">
                      {activeStep.streetName}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-white leading-snug line-clamp-2 mt-0.5">
                  {activeStep.instruction}
                </p>
              </div>
            </div>

            {followingStep && simulationStatus !== 'completed' && (
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="uppercase font-mono tracking-wider text-[#ff007f]">
                  Then
                </span>
                <span className="truncate ml-2 text-slate-300">
                  {followingStep.instruction}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
