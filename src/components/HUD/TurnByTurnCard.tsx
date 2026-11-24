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
  const cls = 'w-6 h-6';

  if (type === 'arrive') {
    return <Flag className="w-6 h-6 text-[var(--accent-pink)]" />;
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
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.24 }}
          className="fixed top-16 sm:top-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-1.5rem)] sm:w-auto sm:min-w-[330px] max-w-md pointer-events-auto"
        >
          <div className="hud-surface-elevated rounded-xl overflow-hidden">
            <div className="p-3.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-[var(--hud-hover)] border border-[var(--hud-divider)] flex items-center justify-center shrink-0">
                <ManeuverIcon
                  type={activeStep.maneuverType}
                  modifier={activeStep.maneuverModifier}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-bold tabular-nums tracking-tight">
                    {simulationStatus === 'completed'
                      ? 'Arrived'
                      : formatDistance(distanceToNextTurn)}
                  </span>
                  {activeStep.streetName && (
                    <span className="text-[11px] font-medium text-[var(--hud-text-muted)] truncate">
                      {activeStep.streetName}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2 mt-0.5">
                  {activeStep.instruction}
                </p>
              </div>
            </div>

            {followingStep && simulationStatus !== 'completed' && (
              <div className="px-3.5 py-2 border-t border-[var(--hud-divider)] flex items-center justify-between text-xs text-[var(--hud-text-muted)]">
                <span className="font-mono text-[10px] uppercase tracking-wider shrink-0">
                  Next
                </span>
                <span className="truncate ml-3">{followingStep.instruction}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
