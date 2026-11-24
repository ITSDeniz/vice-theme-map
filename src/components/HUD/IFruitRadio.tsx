import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const barCount = 10;
    const heights = new Array<number>(barCount).fill(2);

    const draw = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barWidth = 2.5;
      const gap = (w - barCount * barWidth) / (barCount - 1);

      for (let i = 0; i < barCount; i++) {
        const target = isPlaying
          ? 3 +
            Math.abs(Math.sin(now * 0.006 + i * 0.85)) *
              (h - 5) *
              (0.65 + 0.35 * Math.cos(now * 0.003 + i))
          : 2;

        heights[i] += (target - heights[i]) * 0.22;

        const x = i * (barWidth + gap);
        const barH = Math.max(2, heights[i]);
        const y = h - barH;

        ctx.fillStyle = isPlaying ? '#ff1f7a' : 'rgba(148, 163, 184, 0.45)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

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
    <div className="hud-surface rounded-xl px-3 py-2 flex items-center gap-2.5 w-[244px] sm:w-[264px]">
      <button
        type="button"
        onClick={handleTogglePlay}
        aria-label={isPlaying ? 'Pause radio' : 'Play radio'}
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          isPlaying
            ? 'bg-[var(--accent-pink)] text-white'
            : 'bg-[var(--hud-hover)] hover:opacity-85'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-[var(--font-display)] text-[11px] font-semibold uppercase tracking-wider text-[var(--hud-text-muted)]">
            iFruit Radio
          </span>
          <canvas
            ref={canvasRef}
            width={48}
            height={12}
            className="shrink-0"
            aria-hidden="true"
          />
        </div>
        <p className="text-xs font-semibold truncate">{station.name}</p>
        <p className="text-[10px] text-[var(--hud-text-muted)] truncate">
          {station.genre}
        </p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handlePrevStation}
          aria-label="Previous station"
          className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNextStation}
          aria-label="Next station"
          className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Unmute radio' : 'Mute radio'}
          className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-500" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
