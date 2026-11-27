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
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playUiClick } from '../../utils/audio';

export interface YouTubeRadioStation {
  id: string;
  name: string;
  genre: string;
  tracks: string[];
  playlistId: string;
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
    tracks: ['IXJTaHySW8I', 'yi4WypSJr2U', '_5J0KGotyMk', 'SRwrg0db_zY'],
    playlistId: 'PLW26fgEAwt_s',
  },
];

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
  getIframe?: () => HTMLIFrameElement;
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
            onError?: (event: { data: number }) => void;
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
  hadError: boolean;
  lastPlaylistIdx: number;
  trackIdx: number;
  errorStreak: number;
  blockedIndices: Set<number>;
  shuffleQueue: number[];
  shuffleCursor: number;
  history: number[];
}

function buildShuffledIndices(
  count: number,
  excludeIndex?: number,
  blockedIndices?: Set<number>
): number[] {
  const arr = Array.from({ length: count }, (_, i) => i).filter(
    (i) => !blockedIndices?.has(i)
  );
  if (arr.length === 0) {
    return Array.from({ length: count }, (_, i) => i);
  }
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
  while (slot.shuffleCursor < slot.shuffleQueue.length) {
    const candidate = slot.shuffleQueue[slot.shuffleCursor++];
    if (!slot.blockedIndices.has(candidate)) {
      return candidate;
    }
  }
  slot.shuffleQueue = buildShuffledIndices(
    total,
    currentIndex,
    slot.blockedIndices
  );
  slot.shuffleCursor = 1;
  return slot.shuffleQueue[0] ?? 0;
}

function nextPlayableSequentialIndex(
  total: number,
  fromIndex: number,
  blockedIndices: Set<number>
): number {
  for (let offset = 1; offset <= total; offset++) {
    const candidate = (fromIndex + offset) % total;
    if (!blockedIndices.has(candidate)) {
      return candidate;
    }
  }
  return (fromIndex + 1) % total;
}

export function IFruitRadio() {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [trackTitle, setTrackTitle] = useState<string>('');
  const [embedBlocked, setEmbedBlocked] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<Record<string, StationSlot>>({});
  const activeStationIdRef = useRef<string>(RADIO_STATIONS[0].id);
  const wantPlayRef = useRef(false);
  const mutedRef = useRef(false);
  const shuffleRef = useRef(false);
  const bufferTimeoutRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const station = RADIO_STATIONS[stationIndex];
  activeStationIdRef.current = station.id;
  shuffleRef.current = isShuffle;
  mutedRef.current = isMuted;

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
          hadError: false,
          lastPlaylistIdx: 0,
          trackIdx: 0,
          errorStreak: 0,
          blockedIndices: new Set<number>(),
          shuffleQueue: [],
          shuffleCursor: 0,
          history: [],
        };
        slotsRef.current[st.id] = slot;

        const player = new YTPlayerCtor(container, {
          height: '200',
          width: '240',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            listType: 'playlist',
            list: st.playlistId,
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
              if (activeStationIdRef.current === st.id && wantPlayRef.current) {
                player.playVideo();
              }
            },
            onStateChange: (event) => {
              if (!mounted || activeStationIdRef.current !== st.id) return;
              const code = event.data;
              if (code === 1) {
                if (bufferTimeoutRef.current !== null) {
                  window.clearTimeout(bufferTimeoutRef.current);
                  bufferTimeoutRef.current = null;
                }
                slot.hadError = false;
                slot.errorStreak = 0;
                if (activeStationIdRef.current === st.id) {
                  setEmbedBlocked(false);
                }
                const plIdx = player.getPlaylistIndex?.();
                if (typeof plIdx === 'number' && plIdx >= 0) {
                  slot.lastPlaylistIdx = plIdx;
                }
                setIsPlaying(true);
                setIsBuffering(false);
                const title = player.getVideoData()?.title?.trim();
                if (title) setTrackTitle(title);
              } else if (code === 3) {
                setIsBuffering(true);
                if (bufferTimeoutRef.current !== null) {
                  window.clearTimeout(bufferTimeoutRef.current);
                }
                bufferTimeoutRef.current = window.setTimeout(() => {
                  bufferTimeoutRef.current = null;
                  setIsBuffering(false);
                }, 5000);
              } else if (code === 2 || code === 5) {
                if (bufferTimeoutRef.current !== null) {
                  window.clearTimeout(bufferTimeoutRef.current);
                  bufferTimeoutRef.current = null;
                }
                setIsPlaying(false);
                setIsBuffering(false);
              }
            },
            onError: (event) => {
              if (!mounted) return;
              console.warn(`[iFruitRadio] YouTube error (${st.name}):`, event?.data);
              slot.hadError = true;
              slot.errorStreak += 1;

              const ytPlaylist = player.getPlaylist?.();
              if (ytPlaylist && ytPlaylist.length > 1) {
                const reportedIdx = player.getPlaylistIndex?.();
                const badIdx =
                  typeof reportedIdx === 'number' && reportedIdx >= 0
                    ? reportedIdx
                    : slot.lastPlaylistIdx;
                slot.blockedIndices.add(badIdx);

                // Cap consecutive skips at 5 per attempt so we don't spam YouTube and trigger anti-bot
                if (slot.errorStreak >= Math.min(5, ytPlaylist.length)) {
                  if (activeStationIdRef.current === st.id) {
                    setIsBuffering(false);
                    setIsPlaying(false);
                    setEmbedBlocked(true);
                    setTrackTitle('Click Next or open player');
                  }
                  return;
                }

                const nextIdx = shuffleRef.current
                  ? nextFromShuffleBag(slot, ytPlaylist.length, badIdx)
                  : nextPlayableSequentialIndex(
                      ytPlaylist.length,
                      badIdx,
                      slot.blockedIndices
                    );
                slot.lastPlaylistIdx = nextIdx;

                if (activeStationIdRef.current === st.id && wantPlayRef.current) {
                  setIsBuffering(true);
                  player.playVideoAt(nextIdx);
                }
                return;
              }

              if (slot.errorStreak > st.tracks.length) {
                if (activeStationIdRef.current === st.id) {
                  setIsBuffering(false);
                  setIsPlaying(false);
                  setEmbedBlocked(true);
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

  const startSlotPlayback = (slot: StationSlot) => {
    if (!slot.player || !slot.ready) return;
    if (mutedRef.current) slot.player.mute();
    else slot.player.unMute();

    // If the currently cued track previously errored (e.g. Error 150), jump past it
    // instead of calling playVideo() on the errored item.
    if (slot.hadError) {
      const ytPlaylist = slot.player.getPlaylist?.();
      if (ytPlaylist && ytPlaylist.length > 1) {
        const nextIdx = shuffleRef.current
          ? nextFromShuffleBag(slot, ytPlaylist.length, slot.lastPlaylistIdx)
          : nextPlayableSequentialIndex(
              ytPlaylist.length,
              slot.lastPlaylistIdx,
              slot.blockedIndices
            );
        slot.lastPlaylistIdx = nextIdx;
        slot.errorStreak = 0;
        slot.player.playVideoAt(nextIdx);
        return;
      }
    }
    slot.errorStreak = 0;
    slot.player.playVideo();
  };

  const switchStation = (nextIndex: number) => {
    const prevSlot = getActiveSlot();
    if (prevSlot?.player && prevSlot.ready) {
      prevSlot.player.pauseVideo();
    }

    const nextStation = RADIO_STATIONS[nextIndex];
    setEmbedBlocked(false);
    activeStationIdRef.current = nextStation.id;
    setStationIndex(nextIndex);

    const nextSlot = slotsRef.current[nextStation.id];
    const cachedTitle = nextSlot?.player?.getVideoData?.()?.title?.trim() ?? '';
    setTrackTitle(cachedTitle);

    if (wantPlayRef.current) {
      setIsBuffering(true);
      if (nextSlot?.player && nextSlot.ready) {
        startSlotPlayback(nextSlot);
      }
    }
  };

  const handleTogglePlay = () => {
    playUiClick();
    const nextPlay = !isPlaying;
    wantPlayRef.current = nextPlay;
    setEmbedBlocked(false);

    const slot = getActiveSlot();
    if (!slot?.player || !slot.ready) {
      setIsBuffering(nextPlay);
      return;
    }

    if (nextPlay) {
      setIsBuffering(true);
      startSlotPlayback(slot);
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

    const prevIdx =
      isShuffle && slot.history.length > 0
        ? slot.history.pop()!
        : (slot.trackIdx - 1 + station.tracks.length) % station.tracks.length;
    slot.trackIdx = prevIdx;
    setTrackTitle('');
    slot.player.loadVideoById(station.tracks[prevIdx]);
    slot.player.playVideo();
  };

  const handleSkipTrack = () => {
    playUiClick();
    const slot = getActiveSlot();
    if (!slot?.player || !slot.ready) return;

    wantPlayRef.current = true;
    setIsBuffering(true);

    const ytPlaylist = slot.player.getPlaylist?.();
    if (ytPlaylist && ytPlaylist.length > 1) {
      const currentIdx = slot.player.getPlaylistIndex?.() ?? slot.lastPlaylistIdx;
      slot.errorStreak = 0;
      if (isShuffle) {
        slot.history.push(currentIdx);
        const nextIdx = nextFromShuffleBag(slot, ytPlaylist.length, currentIdx);
        slot.lastPlaylistIdx = nextIdx;
        slot.player.playVideoAt(nextIdx);
      } else {
        const nextIdx = nextPlayableSequentialIndex(
          ytPlaylist.length,
          currentIdx,
          slot.blockedIndices
        );
        slot.lastPlaylistIdx = nextIdx;
        slot.player.playVideoAt(nextIdx);
      }
      return;
    }

    slot.history.push(slot.trackIdx);
    const nextIdx = isShuffle
      ? nextFromShuffleBag(slot, station.tracks.length, slot.trackIdx)
      : (slot.trackIdx + 1) % station.tracks.length;
    slot.trackIdx = nextIdx;
    setTrackTitle('');
    slot.player.loadVideoById(station.tracks[nextIdx]);
    slot.player.playVideo();
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

  // Show only the active station's iframe when mini-player preview is expanded
  useEffect(() => {
    RADIO_STATIONS.forEach((st) => {
      const iframe = slotsRef.current[st.id]?.player?.getIframe?.();
      if (!iframe) return;
      iframe.style.display =
        showVideo && st.id !== station.id ? 'none' : 'block';
    });
  }, [showVideo, station.id]);

  return (
    <div className="relative flex flex-col items-end gap-2 w-full sm:w-auto">
      {/* YouTube IFrame pool: hidden at 1% opacity by default, or visible mini-player when toggled */}
      <div
        ref={hostRef}
        className={
          showVideo
            ? 'hud-surface rounded-xl overflow-hidden w-[240px] h-[200px] shadow-xl'
            : 'fixed bottom-0 right-0 flex w-[480px] h-[200px] overflow-hidden opacity-[0.01] pointer-events-none z-0'
        }
      />

      <div className="hud-surface rounded-xl px-3 py-2 flex items-center gap-2.5 w-full sm:w-[364px]">
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
          {embedBlocked && (
            <a
              href={`https://www.youtube.com/playlist?list=${station.playlistId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[var(--accent-pink)] hover:underline"
            >
              Open playlist on YouTube
            </a>
          )}
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
            onClick={() => {
              playUiClick();
              setShowVideo((prev) => !prev);
            }}
            aria-label={showVideo ? 'Hide player' : 'Show player'}
            title={showVideo ? 'Hide YouTube player' : 'Show YouTube player'}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              showVideo
                ? 'text-[var(--accent-pink)] bg-[var(--accent-pink)]/12'
                : 'text-[var(--hud-text-muted)] hover:text-[var(--hud-text)] hover:bg-[var(--hud-hover)]'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
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
    </div>
  );
}
