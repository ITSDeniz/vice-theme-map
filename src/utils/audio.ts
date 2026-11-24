/**
 * Zero-dependency Web Audio API synthesizer for Vice Nav UI feedback
 * and atmospheric iFruit Radio synthwave loops (no external MP3s required).
 */

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  rootHz: number;
  accentColor: string;
  scale: number[];
}

export const IFRUIT_STATIONS: RadioStation[] = [
  {
    id: 'vice-fm',
    name: 'Vice City FM',
    genre: '80s Synthwave',
    bpm: 108,
    rootHz: 110, // A2
    accentColor: '#ff007f',
    scale: [1, 1.189, 1.335, 1.498, 1.782],
  },
  {
    id: 'leonida-nights',
    name: 'Leonida Nights',
    genre: 'Midnight Chill',
    bpm: 92,
    rootHz: 98, // G2
    accentColor: '#00f0ff',
    scale: [1, 1.189, 1.498, 1.682, 1.888],
  },
  {
    id: 'ocean-drive',
    name: 'Ocean Drive 104.5',
    genre: 'Outrun Electro',
    bpm: 120,
    rootHz: 130.81, // C3
    accentColor: '#ff6b00',
    scale: [1, 1.122, 1.335, 1.498, 1.782],
  },
  {
    id: '808-miami',
    name: '808 Vice Bass',
    genre: 'Night Bass',
    bpm: 114,
    rootHz: 82.41, // E2
    accentColor: '#a855f7',
    scale: [1, 1.189, 1.335, 1.498, 1.587],
  },
];

let audioCtx: AudioContext | null = null;
let radioTimerId: number | null = null;
let radioMasterGain: GainNode | null = null;
let stepCounter = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Crisp futuristic glass UI click.
 */
export function playUiClick(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Subtle neon chime for route lock or Demo Drive launch.
 */
export function playNavChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Dual-tone scanner alert for Traffic / Rerouting simulation.
 */
export function playAlertTone(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [680, 510];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.11;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, start);

      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Starts a lightweight Web Audio synthwave groove for the selected iFruit station.
 */
export function startRadioSynth(station: RadioStation, muted: boolean): void {
  stopRadioSynth();

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    radioMasterGain = ctx.createGain();
    radioMasterGain.gain.setValueAtTime(muted ? 0 : 0.14, ctx.currentTime);
    radioMasterGain.connect(ctx.destination);

    const stepMs = (60 / station.bpm / 2) * 1000; // eighth-note pulse
    stepCounter = 0;

    const triggerStep = () => {
      if (!audioCtx || !radioMasterGain) return;
      const now = audioCtx.currentTime;
      const step = stepCounter++;

      // Driving synthwave bass on every eighth note
      const bassOsc = audioCtx.createOscillator();
      const bassFilter = audioCtx.createBiquadFilter();
      const bassGain = audioCtx.createGain();

      const bassMult = step % 8 < 4 ? 1 : step % 8 < 6 ? 1.189 : 1.335;
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(station.rootHz * bassMult, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(520, now);
      bassFilter.frequency.exponentialRampToValueAtTime(180, now + 0.16);

      bassGain.gain.setValueAtTime(0.45, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(radioMasterGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.19);

      // Shimmering arpeggio lead on off-beats
      if (step % 2 === 1) {
        const arpOsc = audioCtx.createOscillator();
        const arpGain = audioCtx.createGain();
        const noteMult = station.scale[(step >> 1) % station.scale.length];

        arpOsc.type = 'triangle';
        arpOsc.frequency.setValueAtTime(station.rootHz * 4 * noteMult, now);

        arpGain.gain.setValueAtTime(0.18, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        arpOsc.connect(arpGain);
        arpGain.connect(radioMasterGain);
        arpOsc.start(now);
        arpOsc.stop(now + 0.23);
      }
    };

    triggerStep();
    radioTimerId = window.setInterval(triggerStep, stepMs);
  } catch {
    // Ignore autoplay restrictions
  }
}

export function setRadioMuted(muted: boolean): void {
  if (!audioCtx || !radioMasterGain) return;
  radioMasterGain.gain.setTargetAtTime(muted ? 0 : 0.14, audioCtx.currentTime, 0.04);
}

export function stopRadioSynth(): void {
  if (radioTimerId !== null) {
    window.clearInterval(radioTimerId);
    radioTimerId = null;
  }
  if (radioMasterGain) {
    try {
      radioMasterGain.disconnect();
    } catch {
      // ignore
    }
    radioMasterGain = null;
  }
}
