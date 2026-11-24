import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  IFRUIT_STATIONS,
  playUiClick,
  setRadioMuted,
  startRadioSynth,
  stopRadioSynth,
} from '../../utils/audio';

export function IFruitRadio() {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const station = IFRUIT_STATIONS[stationIndex];

  // Sync Web Audio synth loop with play/station state
  useEffect(() => {
    if (isPlaying) {
      startRadioSynth(station, isMuted);
    } else {
      stopRadioSynth();
    }
    return () => {
      stopRadioSynth();
    };
  }, [isPlaying, station, isMuted]);

  // Ref-isolated Canvas audio equalizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const barCount = 12;
    const heights = new Array<number>(barCount).fill(3);

    const draw = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barWidth = 3;
      const gap = (w - barCount * barWidth) / (barCount - 1);

      for (let i = 0; i < barCount; i++) {
        const target = isPlaying
          ? 4 +
            Math.abs(Math.sin(now * 0.0065 + i * 0.85)) * (h - 7) *
              (0.65 + 0.35 * Math.cos(now * 0.003 + i))
          : 3;

        heights[i] += (target - heights[i]) * 0.22;

        const x = i * (barWidth + gap);
        const barH = Math.max(2, heights[i]);
        const y = h - barH;

        const grad = ctx.createLinearGradient(0, y, 0, h);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(1, station.accentColor);
        ctx.fillStyle = isPlaying ? grad : 'rgba(148, 163, 184, 0.35)';

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1.5);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, station.accentColor]);

  const handleTogglePlay = () => {
    playUiClick();
    setIsPlaying((prev) => !prev);
  };

  const handlePrevStation = () => {
    playUiClick();
    setStationIndex((prev) => (prev - 1 + IFRUIT_STATIONS.length) % IFRUIT_STATIONS.length);
  };

  const handleNextStation = () => {
    playUiClick();
    setStationIndex((prev) => (prev + 1) % IFRUIT_STATIONS.length);
  };

  const handleToggleMute = () => {
    playUiClick();
    setIsMuted((prev) => {
      const next = !prev;
      setRadioMuted(next);
      return next;
    });
  };

  return (
    <div className="vice-glass rounded-2xl px-3 py-2.5 flex items-center gap-3 w-[252px] sm:w-[276px]">
      {/* Station Disc / Icon */}
      <button
        type="button"
        onClick={handleTogglePlay}
        aria-label={isPlaying ? 'Pause iFruit Radio' : 'Play iFruit Radio'}
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all cursor-pointer active:scale-95"
        style={{
          backgroundColor: `${station.accentColor}22`,
          borderColor: `${station.accentColor}66`,
          boxShadow: isPlaying ? `0 0 16px ${station.accentColor}55` : 'none',
        }}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-white" />
        ) : (
          <Play className="w-4 h-4 text-white fill-current ml-0.5" />
        )}
      </button>

      {/* Station Info & Equalizer */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-[#00f0ff]">
            <Radio className="w-2.5 h-2.5" />
            iFruit Radio
          </span>
          <canvas
            ref={canvasRef}
            width={62}
            height={16}
            className="shrink-0"
            aria-hidden="true"
          />
        </div>

        <p className="text-xs font-semibold text-white truncate mt-0.5">
          {station.name}
        </p>
        <p className="text-[10px] text-slate-400 truncate">{station.genre}</p>
      </div>

      {/* Station Switcher & Mute */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handlePrevStation}
          aria-label="Previous station"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNextStation}
          aria-label="Next station"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Unmute radio' : 'Mute radio'}
          className="p-1 rounded-lg text-slate-400 hover:text-[#00f0ff] hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
