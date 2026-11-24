import { ViceMap } from './components/Map/ViceMap';
import { AlertToast, MapControls } from './components/HUD/MapControls';

export default function App() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a16]">
      <ViceMap />
      <MapControls />
      <AlertToast />
    </main>
  );
}
