import { motion } from 'framer-motion';
import { ViceMap } from './components/Map/ViceMap';
import { AlertToast, MapControls } from './components/HUD/MapControls';
import { SearchBar } from './components/HUD/SearchBar';
import { TurnByTurnCard } from './components/HUD/TurnByTurnCard';
import { Speedometer } from './components/HUD/Speedometer';
import { IFruitRadio } from './components/HUD/IFruitRadio';
import { TrafficAlertOverlay } from './components/HUD/TrafficAlertOverlay';
import { useNavStore } from './store/useNavStore';
import { useAutoHideHud } from './hooks/useAutoHideHud';

export default function App() {
  const theme = useNavStore((s) => s.theme);
  const simulationStatus = useNavStore((s) => s.simulationStatus);
  const isDriving = simulationStatus === 'playing';
  const isHudIdle = useAutoHideHud(isDriving, 4200);

  return (
    <main
      className={`relative w-screen h-screen overflow-hidden ${
        theme === 'light' ? 'bg-[#cbd5e1]' : 'bg-[#0a0a16]'
      }`}
    >
      <ViceMap />
      <TrafficAlertOverlay />

      {/* Secondary Controls (Auto-hide during active driving inactivity) */}
      <motion.div
        animate={{ opacity: isHudIdle ? 0.08 : 1 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className={isHudIdle ? 'pointer-events-none' : 'pointer-events-auto'}
      >
        <SearchBar />
        <MapControls />
        <div
          className={`fixed right-3 sm:right-4 z-30 transition-all ${
            simulationStatus !== 'idle'
              ? 'bottom-28 sm:bottom-7'
              : 'bottom-7'
          }`}
        >
          <IFruitRadio />
        </div>
      </motion.div>

      {/* Primary Driving Telemetry (Always visible during navigation) */}
      <TurnByTurnCard />
      <Speedometer />
      <AlertToast />
    </main>
  );
}
