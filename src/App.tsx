import { ViceMap } from './components/Map/ViceMap';
import { AlertToast, MapControls } from './components/HUD/MapControls';
import { SearchBar } from './components/HUD/SearchBar';
import { TurnByTurnCard } from './components/HUD/TurnByTurnCard';
import { Speedometer } from './components/HUD/Speedometer';

export default function App() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a16]">
      <ViceMap />
      <SearchBar />
      <TurnByTurnCard />
      <MapControls />
      <Speedometer />
      <AlertToast />
    </main>
  );
}
