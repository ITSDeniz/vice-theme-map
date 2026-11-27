import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playUiClick } from '../../utils/audio';

export interface YouTubeRadioStation {
  id: string;
  name: string;
  genre: string;
  tracks: string[];
  playlistId?: string;
}

const RADIO_STATIONS: YouTubeRadioStation[] = [
  {
    id: 'flash-fm',
    name: 'Flash FM',
    genre: '80s Pop & Synth',
    tracks: ['L_KAQMND_5w', 'D00M2KZH1J0', 'Zi_XLOBDo_Y', 'pUBu57EdwjM'],
    playlistId: 'PLMo-S-vkafg0',
  },
  {
    id: 'vcrr',
    name: 'VCRR',
    genre: 'Vice City Rock & Rap Radio',
    tracks: ['yi4WypSJr2U', '_5J0KGotyMk', 'SRwrg0db_zY', 'LplPi2CxNHI', 'KzWYzsaL83k'],
    playlistId: 'PLW26fgEAwt_s',
  },
];

function isFullPlaylistId(id?: string): id is string {
  return Boolean(id && id.length >= 10);
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  playVideoAt: (index: number) => void;
  setShuffle: (shufflePlaylist: boolean) => void;
  mute: () => void;
  unMute: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlaylist: () => string[] | null;
  getPlaylistIndex: () => number;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
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

interface StationSlot {
  player: YTPlayer | null;
  ready: boolean;
  trackIdx: number;
  errorStreak: number;
  shuffleQueue: number[];
  shuffleCursor: number;
  history: number[];
}

function buildShuffledIndices(count: number, excludeIndex?: number): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (
    excludeIndex !== undefined &&
    arr.length > 1 &&
    arr[0] === excludeIndex
  ) {
    const swapIdx = 1 + Math.floor(Math.random() * (arr.length - 1));
    [arr[0], arr[swapIdx]] = [arr[swapIdx], arr[0]];
  }
  return arr;
}

function nextFromShuffleBag(
  slot: StationSlot,
  total: number,
  currentIndex: number
): number {
  if (
    slot.shuffleQueue.length !== total ||
    slot.shuffleCursor >= slot.shuffleQueue.length
  ) {
    slot.shuffleQueue = buildShuffledIndices(total, currentIndex);
    slot.shuffleCursor = 0;
  }
  const next = slot.shuffleQueue[slot.shuffleCursor];
  slot.shuffleCursor += 1;
  return next;
}

export function IFruitRadio() {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [trackTitle, setTrackTitle] = useState<string>('');

  const hostRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<Record<string, StationSlot>>({});
  const activeStationIdRef = useRef<string>(RADIO_STATIONS[0].id);
  const wantPlayRef = useRef(false);
  const mutedRef = useRef(false);
  const shuffleRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const station = RADIO_STATIONS[stationIndex];
  activeStationIdRef.current = station.id;
  shuffleRef.current = isShuffle;
  mutedRef.current = isMuted;

  // Mount one persistent isolated YT.Player per station upfront.
  // This ensures zero cross-station playlist leaks AND lets switchStation()
  // call playVideo() synchronously inside the user's click gesture (required by Safari HTTPS).
  useEffect(() => {
    let mounted = true;
    const host = hostRef.current;
    if (!host) return;

    void loadYouTubeIframeApi().then(() => {
      const YTPlayerCtor = window.YT?.Player;
      if (!mounted || !YTPlayerCtor || !hostRef.current) return;
      hostRef.current.innerHTML = '';

      RADIO_STATIONS.forEach((st) => {
        const container = document.createElement('div');
        hostRef.current!.appendChild(container);

        const slot: StationSlot = {
          player: null,
          ready: false,
          trackIdx: 0,
          errorStreak: 0,
          shuffleQueue: [],
          shuffleCursor: 0,
          history: [],
        };
        slotsRef.current[st.id] = slot;

        const usePlaylist = isFullPlaylistId(st.playlistId);

        const player = new YTPlayerCtor(container, {
          height: '112',
          width: '200',
          ...(usePlaylist ? {} : { videoId: st.tracks[0] }),
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
            ...(usePlaylist
              ? { listType: 'playlist', list: st.playlistId! }
              : {}),
          },
          events: {
            onReady: () => {
              if (!mounted) return;
              slot.ready = true;
              if (mutedRef.current) {
                player.mute();
              } else {
                player.unMute();
              }
              if (usePlaylist) {
                player.setShuffle(shuffleRef.current);
              }
              if (activeStationIdRef.current === st.id && wantPlayRef.current) {
                player.playVideo();
              }
            },
            onStateChange: (event) => {
              if (!mounted || activeStationIdRef.current !== st.id) return;
              const code = event.data;
              if (code === 1) {
                slot.errorStreak = 0;
                setIsPlaying(true);
                setIsBuffering(false);
                const title = player.getVideoData()?.title?.trim();
                if (title) setTrackTitle(title);
              } else if (code === 3) {
                setIsBuffering(true);
              } else if (code === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
              } else if (code === 5) {
                // Video cued and ready
                setIsBuffering(false);
              } else if (code === 0 && !usePlaylist && st.tracks.length > 1) {
                slot.history.push(slot.trackIdx);
                const nextIdx = shuffleRef.current
                  ? nextFromShuffleBag(slot, st.tracks.length, slot.trackIdx)
                  : (slot.trackIdx + 1) % st.tracks.length;
                slot.trackIdx = nextIdx;
                player.loadVideoById(st.tracks[nextIdx]);
              }
            },
            onError: () => {
              if (!mounted) return;
              slot.errorStreak += 1;

              const ytPlaylist = player.getPlaylist?.();
              if (ytPlaylist && ytPlaylist.length > 1) {
                if (slot.errorStreak > Math.min(10, ytPlaylist.length)) {
                  if (activeStationIdRef.current === st.id) {
                    setIsBuffering(false);
                    setIsPlaying(false);
                  }
                  return;
                }
                if (activeStationIdRef.current === st.id && wantPlayRef.current) {
                  player.nextVideo();
                }
                return;
              }

              if (slot.errorStreak > st.tracks.length) {
                if (activeStationIdRef.current === st.id) {
                  setIsBuffering(false);
                  setIsPlaying(false);
                }
                return;
              }
              const nextIdx = (slot.trackIdx + 1) % st.tracks.length;
              slot.trackIdx = nextIdx;
              const fallbackId = st.tracks[nextIdx];
              if (activeStationIdRef.current === st.id && wantPlayRef.current) {
                player.loadVideoById(fallbackId);
              } else {
                player.cueVideoById(fallbackId);
              }
            },
          },
        });

        slot.player = player;
      });
    });

    return () => {
      mounted = false;
      Object.values(slotsRef.current).forEach((slot) => {
        try {
          slot.player?.destroy();
        } catch {
          // ignore
        }
      });
      slotsRef.current = {};
    };
  }, []);

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

  const getActiveSlot = () => slotsRef.current[activeStationIdRef.current];

  const switchStation = (nextIndex: number) => {
    const prevSlot = getActiveSlot();
    if (prevSlot?.player && prevSlot.ready) {
      prevSlot.player.pauseVideo();
    }

    const nextStation = RADIO_STATIONS[nextIndex];
    activeStationIdRef.current = nextStation.id;
    setStationIndex(nextIndex);

    const nextSlot = slotsRef.current[nextStation.id];
    const cachedTitle = nextSlot?.player?.getVideoData?.()?.title?.trim() ?? '';
    setTrackTitle(cachedTitle);

    if (wantPlayRef.current) {
      setIsBuffering(true);
      if (nextSlot?.player && nextSlot.ready) {
        if (mutedRef.current) {
          nextSlot.player.mute();
        } else {
          nextSlot.player.unMute();
        }
        nextSlot.player.setShuffle?.(shuffleRef.current);
        nextSlot.player.playVideo();
      }
    }
  };

  const handleTogglePlay = () => {
    playUiClick();
    const nextPlay = !isPlaying;
    wantPlayRef.current = nextPlay;

    const slot = getActiveSlot();
    if (!slot?.player || !slot.ready) {
      setIsBuffering(nextPlay);
      return;
    }

    if (nextPlay) {
      setIsBuffering(true);
      slot.player.playVideo();
    } else {
      slot.player.pauseVideo();
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

  const handlePrevTrack = () => {
    playUiClick();
    const slot = getActiveSlot();
    if (!slot?.player || !slot.ready) return;

    wantPlayRef.current = true;
    setIsBuffering(true);

    const ytPlaylist = slot.player.getPlaylist?.();
    if (ytPlaylist && ytPlaylist.length > 1) {
      if (isShuffle && slot.history.length > 0) {
        const prevIdx = slot.history.pop()!;
        slot.player.playVideoAt(prevIdx);
      } else {
        slot.player.previousVideo();
      }
      return;
    }

    if (station.tracks.length > 1) {
      const prevIdx =
        isShuffle && slot.history.length > 0
          ? slot.history.pop()!
          : (slot.trackIdx - 1 + station.tracks.length) % station.tracks.length;
      slot.trackIdx = prevIdx;
      setTrackTitle('');
      slot.player.loadVideoById(station.tracks[prevIdx]);
      slot.player.playVideo();
      return;
    }

    const currentTime = slot.player.getCurrentTime?.() ?? 0;
    slot.player.seekTo(Math.max(0, currentTime - 210), true);
    slot.player.playVideo();
    setIsBuffering(false);
  };

  const handleSkipTrack = () => {
    playUiClick();
    const slot = getActiveSlot();
    if (!slot?.player || !slot.ready) return;

    wantPlayRef.current = true;
    setIsBuffering(true);

    const ytPlaylist = slot.player.getPlaylist?.();
    if (ytPlaylist && ytPlaylist.length > 1) {
      const currentIdx = slot.player.getPlaylistIndex?.() ?? 0;
      if (isShuffle) {
        slot.history.push(currentIdx);
        const nextIdx = nextFromShuffleBag(slot, ytPlaylist.length, currentIdx);
        slot.player.playVideoAt(nextIdx);
      } else {
        slot.player.nextVideo();
      }
      return;
    }

    if (station.tracks.length > 1) {
      slot.history.push(slot.trackIdx);
      const nextIdx = isShuffle
        ? nextFromShuffleBag(slot, station.tracks.length, slot.trackIdx)
        : (slot.trackIdx + 1) % station.tracks.length;
      slot.trackIdx = nextIdx;
      setTrackTitle('');
      slot.player.loadVideoById(station.tracks[nextIdx]);
      slot.player.playVideo();
      return;
    }

    const duration = slot.player.getDuration?.() ?? 0;
    const currentTime = slot.player.getCurrentTime?.() ?? 0;
    if (duration > 180) {
      const targetSec = isShuffle
        ? Math.floor(Math.random() * Math.max(60, duration - 120))
        : (currentTime + 210) % Math.max(210, duration - 60);
      slot.player.seekTo(targetSec, true);
    } else {
      slot.player.seekTo(0, true);
    }
    slot.player.playVideo();
    setIsBuffering(false);
  };

  const handleToggleShuffle = () => {
    playUiClick();
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    shuffleRef.current = nextShuffle;

    Object.values(slotsRef.current).forEach((slot) => {
      slot.shuffleQueue = [];
      slot.shuffleCursor = 0;
      if (slot.player && slot.ready) {
        slot.player.setShuffle?.(nextShuffle);
      }
    });
  };

  const handleToggleMute = () => {
    playUiClick();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    mutedRef.current = nextMuted;

    Object.values(slotsRef.current).forEach((slot) => {
      if (slot.player && slot.ready) {
        if (nextMuted) {
          slot.player.mute();
        } else {
          slot.player.unMute();
        }
      }
    });
  };

  return (
    <>
      {/* In-viewport ultra-low-opacity YouTube IFrame pool so Safari/iOS allows audio playback */}
      <div
        ref={hostRef}
        className="fixed bottom-0 right-0 w-[200px] h-[112px] overflow-hidden opacity-[0.01] pointer-events-none z-0"
        aria-hidden="true"
      />

      <div className="hud-surface rounded-xl px-3 py-2 flex items-center gap-2.5 w-full sm:w-[344px]">
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
            <span className="font-[var(--font-display)] text-[11px] font-semibold uppercase tracking-wider text-[var(--hud-text-muted)] whitespace-nowrap">
              iFruit Radio
            </span>
            <canvas
              ref={canvasRef}
              width={44}
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
            onClick={handlePrevTrack}
            aria-label="Previous track"
            title="Previous song"
            className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSkipTrack}
            aria-label="Next track"
            title="Next song"
            className="p-1 rounded-md text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)] transition-colors cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleShuffle}
            aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
            title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isShuffle
                ? 'text-[var(--accent-pink)] bg-[var(--accent-pink)]/12'
                : 'text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)]'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
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
