/**
 * Gift-unwrapping sound, synthesised sample by sample (no audio file to download):
 *  1. the ribbon is pulled (soft rubbing noise),
 *  2. wrapping paper tears and crinkles (dense irregular micro-clicks + band-passed hiss),
 *  3. the box lid lifts off with a muffled thump,
 *  4. a few tiny bell notes sparkle.
 * The buffer is built once and replayed.
 */
const MUTE_KEY = 'petits-jours-son-coupe';

let context: AudioContext | undefined;
let buffer: AudioBuffer | undefined;
const listeners = new Set<() => void>();

export function isSoundMuted(): boolean {
  try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setSoundMuted(muted: boolean) {
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage unavailable */ }
  listeners.forEach(listener => listener());
}
export function onSoundMuteChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(rate: number): Float32Array {
  const random = seeded(20261224);
  const length = Math.floor(rate * 2.6);
  const out = new Float32Array(length);
  const add = (time: number, value: number) => { const i = Math.floor(time * rate); if (i >= 0 && i < length) out[i] += value; };

  // 1 · Ribbon pull (0 → .35 s): low-passed noise, rising then fading.
  let low = 0;
  for (let i = 0; i < rate * .35; i++) {
    const t = i / rate;
    const env = Math.sin(Math.PI * t / .35) ** 2;
    low += (random() * 2 - 1 - low) * .08;
    out[i] += low * env * 1.5 * (1 + Math.sin(t * 90) * .3);
  }

  // 2 · Tearing + crinkling paper (.25 → 1.5 s).
  const tearStart = .25, tearEnd = 1.5;
  let band1 = 0, band2 = 0;
  for (let i = Math.floor(tearStart * rate); i < Math.floor(tearEnd * rate); i++) {
    const t = i / rate;
    const progress = (t - tearStart) / (tearEnd - tearStart);
    // Irregular loudness: several "rips" of different strength.
    const rip = Math.max(0, Math.sin(progress * 19 + Math.sin(progress * 7) * 2)) ** 2;
    const env = rip * (.9 - progress * .5) * Math.min(1, progress * 12) + .05;
    const noise = random() * 2 - 1;
    band1 += (noise - band1) * .55;           // brighten
    band2 += (band1 - band2) * .3;
    out[i] += (band1 - band2) * 2.6 * env * .5;
  }
  // Crinkle: thousands of micro-clicks, denser at the start, each a decaying noise burst.
  for (let n = 0; n < 520; n++) {
    const progress = Math.pow(random(), 1.35);
    const time = tearStart + progress * (tearEnd - tearStart) + .05;
    const strength = (.25 + random() * .75) * (1 - progress * .6);
    const grain = 5 + Math.floor(random() * 38);
    let sign = random() < .5 ? -1 : 1;
    for (let g = 0; g < grain; g++) {
      const decay = Math.exp(-g / (grain * .35));
      add(time + g / rate, sign * strength * decay * .55 * (random() * .8 + .2));
      if (random() < .35) sign = -sign;
    }
  }

  // 3 · Lid lifts off (1.35 s): short thump + soft whoosh of air.
  const lid = 1.35;
  let air = 0;
  for (let i = 0; i < rate * .45; i++) {
    const t = i / rate;
    const k = Math.floor((lid + t) * rate);
    if (k >= length) break;
    const thump = Math.sin(2 * Math.PI * (120 - 70 * Math.min(1, t * 3)) * t) * Math.exp(-t * 14) * .8;
    air += (random() * 2 - 1 - air) * .12;
    out[k] += thump + air * Math.sin(Math.PI * Math.min(1, t / .35)) * .55;
  }

  // 4 · Little bells (1.5 → 2.6 s): inharmonic partials for a glassy sound.
  const notes = [[1.5, 1318.5], [1.62, 1568], [1.76, 1975.5], [1.92, 2637]];
  for (const [start, frequency] of notes) {
    for (let i = 0; i < rate * 1.0; i++) {
      const t = i / rate;
      const k = Math.floor((start + t) * rate);
      if (k >= length) break;
      const env = Math.exp(-t * 5.5) * Math.min(1, t * 600);
      out[k] += env * .16 * (Math.sin(2 * Math.PI * frequency * t) + .38 * Math.sin(2 * Math.PI * frequency * 2.76 * t) + .18 * Math.sin(2 * Math.PI * frequency * 5.4 * t));
    }
  }

  // Normalise gently and fade the very end.
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? .85 / peak : 1;
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, (length - i) / (rate * .15));
    out[i] = Math.tanh(out[i] * gain * 1.1) * fade;
  }
  return out;
}

/** Plays the unwrapping sound. Must be called from a user gesture (a click) so browsers allow audio. */
export function playGiftOpening() {
  if (isSoundMuted()) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    if (!buffer || buffer.sampleRate !== context.sampleRate) {
      buffer = context.createBuffer(1, Math.floor(context.sampleRate * 2.6), context.sampleRate);
      buffer.copyToChannel(build(context.sampleRate) as Float32Array<ArrayBuffer>, 0);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = .75;
    source.connect(gain).connect(context.destination);
    source.start();
  } catch { /* audio is a nicety: never break the page */ }
}
