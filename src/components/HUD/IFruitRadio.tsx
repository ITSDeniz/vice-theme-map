import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Shuffle,
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
    tracks: [
      'L_KAQMND_5w',
      'D00M2KZH1J0',
      'Zi_XLOBDo_Y',
      'pUBu57EdwjM',
    ],
    playlistId: 'PLMo-S-vkafg0',
  },
  {
    id: 'vcrr',
    name: 'VCRR',
    genre: 'Vice City Rock & Rap Radio',
    tracks: [
      'yi4WypSJr2U',
      '_5J0KGotyMk',
      'SRwrg0db_zY',
      'LplPi2CxNHI',
      'KzWYzsaL83k',
    ],
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
  const [isShuffle, setIsShuffle] = useState(false);
  const [trackTitle, setTrackTitle] = useState<string>('');

  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const wantPlayRef = useRef(false);
  const shuffleRef = useRef(false);
  const trackIndexRef = useRef(0);
  const errorStreakRef = useRef(0);
  const stationRef = useRef<YouTubeRadioStation>(RADIO_STATIONS[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const station = RADIO_STATIONS[stationIndex];
  stationRef.current = station;
  shuffleRef.current = isShuffle;

  // Initialize keyless YouTube IFrame Player
  useEffect(() => {
    let mounted = true;

    void loadYouTubeIframeApi().then(() => {
      if (!mounted || !playerMountRef.current || !window.YT?.Player) return;

      const initial = stationRef.current;
      const usePlaylist = isFullPlaylistId(initial.playlistId);

      playerRef.current = new window.YT.Player(playerMountRef.current, {
        height: '112',
        width: '200',
        ...(usePlaylist ? {} : { videoId: initial.tracks[0] }),
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          ...(usePlaylist
            ? { listType: 'playlist', list: initial.playlistId! }
            : {}),
        },
        events: {
          onReady: () => {
            if (!mounted) return;
            playerReadyRef.current = true;
            if (usePlaylist) {
              playerRef.current?.setShuffle(shuffleRef.current);
            }
            if (wantPlayRef.current) {
              playerRef.current?.playVideo();
            }
          },
          onStateChange: (event) => {
            if (!mounted) return;
            const code = event.data;
            // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED
            if (code === 1) {
              errorStreakRef.current = 0;
              setIsPlaying(true);
              setIsBuffering(false);
              const title = playerRef.current?.getVideoData()?.title?.trim();
              if (title) setTrackTitle(title);
            } else if (code === 3) {
              setIsBuffering(true);
            } else if (code === 2) {
              if (!wantPlayRef.current) {
                setIsPlaying(false);
                setIsBuffering(false);
              }
            } else if (code === 0) {
              // Auto-advance on track end
              const curr = stationRef.current;
              if (curr.tracks.length > 1) {
                const nextIdx = shuffleRef.current
                  ? Math.floor(Math.random() * curr.tracks.length)
                  : (trackIndexRef.current + 1) % curr.tracks.length;
                trackIndexRef.current = nextIdx;
                playerRef.current?.loadVideoById(curr.tracks[nextIdx]);
              } else {
                playerRef.current?.seekTo(0, true);
                playerRef.current?.playVideo();
              }
            }
          },
          onError: () => {
            if (!mounted || !playerRef.current) return;
            const curr = stationRef.current;
            errorStreakRef.current += 1;
            if (errorStreakRef.current > curr.tracks.length) {
              setIsBuffering(false);
              setIsPlaying(false);
              return;
            }
            const nextIdx = (trackIndexRef.current + 1) % curr.tracks.length;
            trackIndexRef.current = nextIdx;
            const fallbackId = curr.tracks[nextIdx];
            if (wantPlayRef.current) {
              playerRef.current.loadVideoById(fallbackId);
            } else {
              playerRef.current.cueVideoById(fallbackId);
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

  const loadStationMedia = (targetStation: YouTubeRadioStation) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    const usePlaylist = isFullPlaylistId(targetStation.playlistId);
    trackIndexRef.current = 0;

    if (usePlaylist) {
      if (wantPlayRef.current) {
        setIsBuffering(true);
        player.loadPlaylist({
          list: targetStation.playlistId!,
          listType: 'playlist',
          index: 0,
        });
        player.setShuffle(shuffleRef.current);
      } else {
        player.cuePlaylist({
          list: targetStation.playlistId!,
          listType: 'playlist',
          index: 0,
        });
      }
      return;
    }

    const startTrackIdx =
      shuffleRef.current && targetStation.tracks.length > 1
        ? Math.floor(Math.random() * targetStation.tracks.length)
        : 0;
    trackIndexRef.current = startTrackIdx;
    const videoId = targetStation.tracks[startTrackIdx];

    if (wantPlayRef.current) {
      setIsBuffering(true);
      player.loadVideoById(videoId);
      player.playVideo();
    } else {
      player.cueVideoById(videoId);
    }
  };

  const switchStation = (nextIndex: number) => {
    const nextStation = RADIO_STATIONS[nextIndex];
    errorStreakRef.current = 0;
    stationRef.current = nextStation;
    setStationIndex(nextIndex);
    setTrackTitle('');
    loadStationMedia(nextStation);
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

    // 1. If a full YouTube playlist is loaded, use native playlist navigation
    const ytPlaylist = player.getPlaylist?.();
    if (ytPlaylist && ytPlaylist.length > 1) {
      if (isShuffle) {
        const currentIdx = player.getPlaylistIndex?.() ?? 0;
        let randIdx = Math.floor(Math.random() * ytPlaylist.length);
        if (randIdx === currentIdx) {
          randIdx = (currentIdx + 1) % ytPlaylist.length;
        }
        player.playVideoAt(randIdx);
      } else {
        player.nextVideo();
      }
      return;
    }

    // 2. If station has multiple track IDs, cycle or shuffle through them
    const curr = stationRef.current;
    if (curr.tracks.length > 1) {
      let nextIdx = (trackIndexRef.current + 1) % curr.tracks.length;
      if (isShuffle) {
        nextIdx = Math.floor(Math.random() * curr.tracks.length);
        if (nextIdx === trackIndexRef.current) {
          nextIdx = (trackIndexRef.current + 1) % curr.tracks.length;
        }
      }
      trackIndexRef.current = nextIdx;
      setTrackTitle('');
      player.loadVideoById(curr.tracks[nextIdx]);
      player.playVideo();
      return;
    }

    // 3. Single continuous radio mix video: jump to next song segment (or random segment in Shuffle)
    const duration = player.getDuration?.() ?? 0;
    const currentTime = player.getCurrentTime?.() ?? 0;
    if (duration > 180) {
      const targetSec = isShuffle
        ? Math.floor(Math.random() * Math.max(60, duration - 120))
        : (currentTime + 210) % Math.max(210, duration - 60);
      player.seekTo(targetSec, true);
    } else {
      player.seekTo(0, true);
    }
    player.playVideo();
    setIsBuffering(false);
  };

  const handleToggleShuffle = () => {
    playUiClick();
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    shuffleRef.current = nextShuffle;

    const player = playerRef.current;
    if (player && playerReadyRef.current) {
      player.setShuffle?.(nextShuffle);
    }
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
      {/* Hidden YouTube IFrame host */}
      <div
        className="fixed -left-[9999px] bottom-0 w-[200px] h-[112px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={playerMountRef} />
      </div>

      <div className="hud-surface rounded-xl px-3 py-2 flex items-center gap-2.5 w-[286px] sm:w-[316px]">
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
            onClick={handleSkipTrack}
            aria-label="Next track"
            title="Skip song / segment"
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
