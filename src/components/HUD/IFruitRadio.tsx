import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playUiClick } from '../../utils/audio';

export interface YouTubeRadioStation {
  id: string;
  name: string;
  genre: string;
  videoId: string;
  playlistId: string;
}

const RADIO_STATIONS: YouTubeRadioStation[] = [
  {
    id: 'flash-fm',
    name: 'Flash FM',
    genre: '80s Pop & Synth',
    videoId: 'L_KAQMND_5w',
    playlistId: 'PLMo-S-vkafg0',
  },
  {
    id: 'vcrr',
    name: 'VCRR',
    genre: 'Vice City Rock Radio',
    videoId: 'yi4WypSJr2U',
    playlistId: 'PLTFuoiI4cFGM',
  },
];

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  mute: () => void;
  unMute: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  loadPlaylist: (opts: {
    list: string;
    listType: 'playlist';
    index?: number;
  }) => void;
  cuePlaylist: (opts: {
    list: string;
    listType: 'playlist';
    index?: number;
  }) => void;
  getVideoData: () => { title?: string; video_id?: string };
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        config: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayer;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
}

export function IFruitRadio() {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [trackTitle, setTrackTitle] = useState<string>('');

  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const wantPlayRef = useRef(false);
  const stationRef = useRef<YouTubeRadioStation>(RADIO_STATIONS[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const station = RADIO_STATIONS[stationIndex];
  stationRef.current = station;

  // Initialize keyless YouTube IFrame Player
  useEffect(() => {
    let mounted = true;

    void loadYouTubeIframeApi().then(() => {
      if (!mounted || !playerMountRef.current || !window.YT?.Player) return;

      const initial = stationRef.current;
      playerRef.current = new window.YT.Player(playerMountRef.current, {
        height: '112',
        width: '200',
        videoId: initial.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          listType: 'playlist',
          list: initial.playlistId,
        },
        events: {
          onReady: () => {
            if (!mounted) return;
            playerReadyRef.current = true;
            if (wantPlayRef.current) {
              playerRef.current?.playVideo();
            }
          },
          onStateChange: (event) => {
            if (!mounted) return;
            const code = event.data;
            // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED
            if (code === 1) {
              setIsPlaying(true);
              setIsBuffering(false);
              const title = playerRef.current?.getVideoData()?.title?.trim();
              if (title) setTrackTitle(title);
            } else if (code === 3) {
              setIsBuffering(true);
            } else if (code === 2 || code === 0) {
              setIsPlaying(false);
              setIsBuffering(false);
            }
          },
          onError: () => {
            if (!mounted || !playerRef.current) return;
            // Fallback directly to the station's primary videoId if playlist lookup fails
            setIsBuffering(false);
            const curr = stationRef.current;
            if (wantPlayRef.current) {
              playerRef.current.loadVideoById(curr.videoId);
            } else {
              playerRef.current.cueVideoById(curr.videoId);
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
      playerReadyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  // Load new station playlist when user switches stations
  const switchStation = (nextIndex: number) => {
    const nextStation = RADIO_STATIONS[nextIndex];
    setStationIndex(nextIndex);
    setTrackTitle('');

    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    if (wantPlayRef.current) {
      setIsBuffering(true);
      player.loadPlaylist({
        list: nextStation.playlistId,
        listType: 'playlist',
        index: 0,
      });
    } else {
      player.cuePlaylist({
        list: nextStation.playlistId,
        listType: 'playlist',
        index: 0,
      });
    }
  };

  // Equalizer animation
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
    const nextPlay = !isPlaying;
    wantPlayRef.current = nextPlay;

    const player = playerRef.current;
    if (!player || !playerReadyRef.current) {
      setIsBuffering(nextPlay);
      return;
    }

    if (nextPlay) {
      setIsBuffering(true);
      player.playVideo();
    } else {
      player.pauseVideo();
      setIsPlaying(false);
      setIsBuffering(false);
    }
  };

  const handlePrevStation = () => {
    playUiClick();
    const next = (stationIndex - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    switchStation(next);
  };

  const handleNextStation = () => {
    playUiClick();
    const next = (stationIndex + 1) % RADIO_STATIONS.length;
    switchStation(next);
  };

  const handleSkipTrack = () => {
    playUiClick();
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    wantPlayRef.current = true;
    setIsBuffering(true);
    player.nextVideo();
  };

  const handleToggleMute = () => {
    playUiClick();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (nextMuted) {
      player.mute();
    } else {
      player.unMute();
    }
  };

  return (
    <>
      {/* Hidden YouTube IFrame host (off-viewport for reliable audio playback) */}
      <div
        className="fixed -left-[9999px] bottom-0 w-[200px] h-[112px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={playerMountRef} />
      </div>

      <div className="hud-surface rounded-xl px-3 py-2 flex items-center gap-2.5 w-[264px] sm:w-[292px]">
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
          {isBuffering ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPlaying ? (
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
            {trackTitle || station.genre}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handlePrevStation}
            aria-label="Previous station"
            title="Previous station"
            className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextStation}
            aria-label="Next station"
            title="Next station"
            className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSkipTrack}
            aria-label="Next track"
            title="Skip track"
            className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute radio' : 'Mute radio'}
            title={isMuted ? 'Unmute' : 'Mute'}
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
    </>
  );
}
