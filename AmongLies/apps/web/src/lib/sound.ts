"use client";

/**
 * Sonido sintetizado con Web Audio: efectos y una música de fondo suave, sin
 * archivos (nada con derechos). Los navegadores no dejan sonar nada hasta que
 * el usuario toca algo, así que el contexto se crea en la primera interacción.
 */

export type Sfx =
  | "turn"
  | "message"
  | "join"
  | "invite"
  | "vote"
  | "reveal"
  | "win"
  | "lose"
  | "eliminated";

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxVolume = 0.6;
let musicVolume = 0.3;
let sfxOn = true;
let musicOn = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx = new AudioContext();
  sfxGain = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain.connect(ctx.destination);
  musicGain.connect(ctx.destination);
  applyVolumes();
  return ctx;
}

function applyVolumes() {
  if (!ctx || !sfxGain || !musicGain) return;
  sfxGain.gain.setTargetAtTime(sfxOn ? sfxVolume * 0.5 : 0, ctx.currentTime, 0.02);
  musicGain.gain.setTargetAtTime(musicOn ? musicVolume * 0.25 : 0, ctx.currentTime, 0.3);
}

/** Se llama en la primera interacción del usuario (y en las siguientes, por si el navegador lo suspendió). */
export function unlockAudio(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
  if (musicOn) startMusic();
}

export function configureSound(options: { sfxOn: boolean; sfxVolume: number; musicOn: boolean; musicVolume: number }): void {
  ({ sfxOn, sfxVolume, musicOn, musicVolume } = options);
  applyVolumes();
  if (musicOn && ctx?.state === "running") startMusic();
  if (!musicOn) stopMusic();
}

/** Una nota con envolvente suave. `slide` lleva la frecuencia a otro valor al final. */
function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; slide?: number; out?: GainNode | null } = {}) {
  const c = ctx;
  const out = opts.out ?? sfxGain;
  if (!c || !out) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
  const peak = opts.gain ?? 0.6;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);

export function playSfx(name: Sfx): void {
  if (!sfxOn || !context() || ctx!.state !== "running") return;
  switch (name) {
    case "turn": // campanita que sube: "te toca"
      tone(NOTE(3), 0, 0.25, { type: "triangle" });
      tone(NOTE(10), 0.12, 0.4, { type: "triangle" });
      break;
    case "message":
      tone(NOTE(15), 0, 0.08, { gain: 0.25 });
      break;
    case "join":
      tone(NOTE(7), 0, 0.12, { type: "triangle", gain: 0.35 });
      tone(NOTE(12), 0.08, 0.18, { type: "triangle", gain: 0.35 });
      break;
    case "invite":
      tone(NOTE(12), 0, 0.3, { gain: 0.45 });
      tone(NOTE(16), 0.15, 0.45, { gain: 0.45 });
      break;
    case "vote":
      tone(NOTE(-5), 0, 0.12, { type: "square", gain: 0.15 });
      break;
    case "reveal": // barrido de suspenso
      tone(NOTE(-17), 0, 0.9, { type: "sawtooth", gain: 0.12, slide: NOTE(-5) });
      tone(NOTE(-10), 0.85, 0.35, { type: "triangle", gain: 0.5 });
      break;
    case "win":
      [0, 4, 7, 12].forEach((s, i) => tone(NOTE(s + 3), i * 0.11, 0.45, { type: "triangle", gain: 0.45 }));
      break;
    case "lose":
      [7, 3, 0, -5].forEach((s, i) => tone(NOTE(s - 2), i * 0.16, 0.5, { type: "sine", gain: 0.4 }));
      break;
    case "eliminated":
      tone(NOTE(-21), 0, 0.6, { type: "sine", gain: 0.7, slide: NOTE(-33) });
      break;
  }
}

// ── Música: acordes suaves (Am – F – C – G) con un arpegio disperso ─────────

const CHORDS = [
  [-12, -9, -5], // La menor
  [-16, -12, -9], // Fa
  [-21, -17, -14], // Do
  [-14, -10, -7], // Sol
];
const BAR_SECONDS = 4;
let bar = 0;

function playBar() {
  if (!ctx || !musicGain) return;
  const chord = CHORDS[bar % CHORDS.length];
  for (const s of chord) tone(NOTE(s), 0, BAR_SECONDS * 1.1, { type: "sine", gain: 0.22, out: musicGain });
  tone(NOTE(chord[0] - 12), 0, BAR_SECONDS, { type: "triangle", gain: 0.18, out: musicGain });
  // Unas pocas notas del acorde, una octava arriba, en tiempos al azar.
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.6) {
      const note = chord[Math.floor(Math.random() * chord.length)] + 12;
      tone(NOTE(note), i * (BAR_SECONDS / 3) + Math.random() * 0.3, 0.9, { type: "triangle", gain: 0.12, out: musicGain });
    }
  }
  bar++;
}

function startMusic() {
  if (musicTimer || !ctx) return;
  playBar();
  musicTimer = setInterval(playBar, BAR_SECONDS * 1000);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
