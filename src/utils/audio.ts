/**
 * Warm, analog-style Web Audio API synthesizer for Vice Nav UI feedback
 * and lush iFruit Radio synthwave loops (zero external audio files).
 *
 * Uses detuned dual-oscillator pads, triangle sub-bass, synthesized 80s drums,
 * and a stereo feedback delay bus so audio sounds warm rather than harsh/8-bit.
 */

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  accentColor: string;
  /** 4-bar chord progression in MIDI note numbers (root, 3rd, 5th, 7th/9th) */
  chords: number[][];
  hasDrums: boolean;
}

export const IFRUIT_STATIONS: RadioStation[] = [
  {
    id: 'vice-fm',
    name: 'Vice City FM',
    genre: '80s Synthwave',
    bpm: 102,
    accentColor: '#ff007f',
    // Am9 -> Fmaj7 -> Dm9 -> E7sus4
    chords: [
      [45, 52, 55, 59, 60],
      [41, 48, 52, 57, 60],
      [38, 45, 48, 52, 57],
      [40, 47, 50, 55, 59],
    ],
    hasDrums: true,
  },
  {
    id: 'leonida-nights',
    name: 'Leonida Nights',
    genre: 'Midnight Ambient',
    bpm: 84,
    accentColor: '#00f0ff',
    // Gm9 -> EbMaj7 -> Cm9 -> Dsus4
    chords: [
      [43, 50, 53, 57, 58],
      [39, 46, 50, 55, 58],
      [36, 43, 46, 50, 55],
      [38, 45, 50, 55, 57],
    ],
    hasDrums: false,
  },
  {
    id: 'ocean-drive',
    name: 'Ocean Drive 104.5',
    genre: 'Outrun Sunset',
    bpm: 114,
    accentColor: '#ff6b00',
    // Fmaj7 -> G6 -> Em7 -> Am9
    chords: [
      [41, 48, 52, 57, 60],
      [43, 50, 55, 59, 64],
      [40, 47, 52, 55, 59],
      [45, 52, 55, 59, 64],
    ],
    hasDrums: true,
  },
  {
    id: '808-miami',
    name: '808 Vice Bass',
    genre: 'Late Night Cruise',
    bpm: 96,
    accentColor: '#a855f7',
    // Em9 -> Cmaj7 -> Am9 -> Bm7
    chords: [
      [40, 47, 50, 54, 55],
      [36, 43, 47, 52, 55],
      [45, 52, 55, 59, 60],
      [47, 54, 57, 62, 66],
    ],
    hasDrums: true,
  },
];

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let radioTimerId: number | null = null;
let radioMasterGain: GainNode | null = null;
let stepCounter = 0;

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

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

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = ctx.sampleRate * 1.0;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Soft, understated glass tap for HUD buttons.
 */
export function playUiClick(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.032);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.036);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Warm electric-piano style chime for route lock or Demo Drive launch.
 */
export function playNavChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [midiToHz(64), midiToHz(69), midiToHz(73), midiToHz(76)]; // E4, A4, C#5, E5

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const start = now + idx * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.04, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Smooth low-passed radar pulse for Traffic Alert simulation.
 */
export function playAlertTone(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [440, 349.23].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.14;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {
    // Ignore autoplay restrictions
  }
}

function triggerKick(ctx: AudioContext, dest: AudioNode, time: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(125, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

  gain.gain.setValueAtTime(0.55, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.3);
}

function triggerSnare(ctx: AudioContext, dest: AudioNode, time: number): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, time);
  filter.Q.setValueAtTime(0.9, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.16, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(time);
  src.stop(time + 0.2);
}

function triggerHiHat(ctx: AudioContext, dest: AudioNode, time: number): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(7500, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.04, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(time);
  src.stop(time + 0.05);
}

function triggerWarmPad(
  ctx: AudioContext,
  dest: AudioNode,
  chordMidi: number[],
  time: number,
  durationSec: number
): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(620, time);
  filter.frequency.linearRampToValueAtTime(1150, time + durationSec * 0.45);
  filter.frequency.linearRampToValueAtTime(540, time + durationSec);

  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0.001, time);
  padGain.gain.linearRampToValueAtTime(0.09, time + 0.35);
  padGain.gain.setValueAtTime(0.08, time + durationSec - 0.35);
  padGain.gain.exponentialRampToValueAtTime(0.001, time + durationSec);

  filter.connect(padGain);
  padGain.connect(dest);

  // Use upper 4 chord voices with subtle +/-7 cent detune for warm analog chorus
  const padNotes = chordMidi.slice(1);
  for (const midi of padNotes) {
    const freq = midiToHz(midi + 12);
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(detune, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + durationSec + 0.05);
    }
  }
}

function triggerSubBass(
  ctx: AudioContext,
  dest: AudioNode,
  rootMidi: number,
  time: number,
  stepSec: number
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(midiToHz(rootMidi), time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(340, time);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.28, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, time + stepSec * 0.92);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + stepSec);
}

function triggerPluck(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  time: number
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(midiToHz(midi + 24), time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, time);
  filter.frequency.exponentialRampToValueAtTime(480, time + 0.25);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.09, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.34);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.36);
}

/**
 * Starts a lush, warm synthwave groove for the selected iFruit station.
 */
export function startRadioSynth(station: RadioStation, muted: boolean): void {
  stopRadioSynth();

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Master bus: warm lowpass -> compressor -> master gain
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, ctx.currentTime);
    compressor.ratio.setValueAtTime(4, ctx.currentTime);

    radioMasterGain = ctx.createGain();
    radioMasterGain.gain.setValueAtTime(muted ? 0 : 0.28, ctx.currentTime);

    // Warm stereo-style echo bus
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime((60 / station.bpm) * 0.75, ctx.currentTime); // dotted eighth
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.32, ctx.currentTime);
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(1500, ctx.currentTime);
    const delayWet = ctx.createGain();
    delayWet.gain.setValueAtTime(0.28, ctx.currentTime);

    delay.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayFilter.connect(delayWet);
    delayWet.connect(compressor);

    compressor.connect(radioMasterGain);
    radioMasterGain.connect(ctx.destination);

    const eighthSec = 60 / station.bpm / 2;
    const barSteps = 8; // 8 eighth-notes per bar
    const barDurationSec = eighthSec * barSteps;
    stepCounter = 0;

    const triggerStep = () => {
      if (!audioCtx || !radioMasterGain) return;
      const now = audioCtx.currentTime + 0.02;
      const step = stepCounter++;
      const stepInBar = step % barSteps;
      const chordIndex = Math.floor(step / barSteps) % station.chords.length;
      const chord = station.chords[chordIndex];

      // Trigger warm analog pad at the start of each bar
      if (stepInBar === 0) {
        triggerWarmPad(audioCtx, compressor, chord, now, barDurationSec);
      }

      // Rolling 8th-note sub-bass
      if (stepInBar % 2 === 0 || stepInBar === 7) {
        triggerSubBass(audioCtx, compressor, chord[0], now, eighthSec);
      }

      // Soft gated 80s drums
      if (station.hasDrums) {
        if (stepInBar === 0 || stepInBar === 4) {
          triggerKick(audioCtx, compressor, now);
        }
        if (stepInBar === 2 || stepInBar === 6) {
          triggerSnare(audioCtx, compressor, now);
          triggerSnare(audioCtx, delay, now);
        }
        if (stepInBar % 2 === 1) {
          triggerHiHat(audioCtx, compressor, now);
        }
      }

      // Gentle melodic pluck into delay bus
      if (stepInBar === 1 || stepInBar === 3 || stepInBar === 5 || stepInBar === 6) {
        const note = chord[1 + ((stepInBar + chordIndex) % (chord.length - 1))];
        triggerPluck(audioCtx, delay, note, now);
        triggerPluck(audioCtx, compressor, note, now);
      }
    };

    triggerStep();
    radioTimerId = window.setInterval(triggerStep, eighthSec * 1000);
  } catch {
    // Ignore autoplay restrictions
  }
}

export function setRadioMuted(muted: boolean): void {
  if (!audioCtx || !radioMasterGain) return;
  radioMasterGain.gain.setTargetAtTime(muted ? 0 : 0.28, audioCtx.currentTime, 0.05);
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
