// Motore audio (chunk a parte, caricato da audio/ponte.ts): contesto WebAudio, bus Musica / Effetti / Ambiente, master con
// compressore e un limitatore morbido (picco sempre < 1, niente clipping), e i due mattoni di ogni suono: `tono` (oscillatore con
// inviluppo, glissato, vibrato, filtro) e `soffio` (rumore filtrato). Tutto sintetizzato: zero file audio. Funziona anche su un
// OfflineAudioContext (test: 10 s registrati senza altoparlanti).

export type Onda = OscillatorType | 'impulso';
export type Tono = {
  f: number; f2?: number; onda?: Onda; t?: number; dur: number; vol: number;
  /** attacco (s); il rilascio è esponenziale fino a `dur` */
  a?: number; lp?: number; q?: number; vib?: { f: number; d: number }; bus?: AudioNode; pan?: number;
};
export type Soffio = { tipo?: BiquadFilterType; f: number; f2?: number; q?: number; t?: number; dur: number; vol: number; a?: number; bus?: AudioNode; pan?: number };
export type Motore = {
  ctx: BaseAudioContext;
  /** bus prima del master: musica (con il suo `duck` per abbassarla nei minigiochi), effetti, ambiente (sotto Effetti) */
  musica: GainNode; duck: GainNode; effetti: GainNode; ambiente: GainNode;
  rumore: AudioBuffer;
  now(): number;
  tono(o: Tono): void;
  soffio(o: Soffio): void;
  /** Rumore in loop filtrato, per i suoni continui (onde, vento, scia, pioggia): si regola con gain e filtro. */
  loop(o: { tipo: BiquadFilterType; f: number; q?: number; bus: AudioNode }): { gain: GainNode; filtro: BiquadFilterNode; stop(): void };
};

/** Livelli delle Impostazioni (0 spento … 3) → guadagno. */
export const LIVELLI = [0, 0.4, 0.7, 1] as const;
/** Volumi di base dei bus: la musica sta sotto gli effetti, l'ambiente sotto tutto. */
export const BASE = { musica: 0.38, effetti: 0.8, ambiente: 0.55 } as const;

let pulse: PeriodicWave | null = null, pulseCtx: BaseAudioContext | null = null;
/** Onda quadra al 25% (il suono «NES» più morbido della quadra al 50%), da serie di Fourier. */
function impulso(ctx: BaseAudioContext): PeriodicWave {
  if (pulse && pulseCtx === ctx) return pulse;
  const n = 24, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  pulseCtx = ctx; pulse = ctx.createPeriodicWave(re, im);
  return pulse;
}

export function createMotore(ctx: BaseAudioContext): Motore {
  // master: compressore (tiene insieme musica ed effetti) → limitatore morbido (tanh: |uscita| ≤ 0,95 qualunque cosa entri)
  const master = ctx.createGain(); master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
  const lim = ctx.createWaveShaper();
  const N = 2048, curve = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = 0.95 * Math.tanh(1.4 * x) / Math.tanh(1.4); }
  lim.curve = curve; lim.oversample = '2x';
  master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
  const musica = ctx.createGain(), duck = ctx.createGain(), effetti = ctx.createGain(), ambiente = ctx.createGain();
  musica.gain.value = 0; effetti.gain.value = 0; ambiente.gain.value = BASE.ambiente;
  duck.connect(musica); musica.connect(master); effetti.connect(master); ambiente.connect(effetti);
  // 2 s di rumore bianco, in comune a tutti i soffi
  const rumore = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const d = rumore.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const uscita = (bus: AudioNode, pan: number | undefined): AudioNode => {
    if (pan === undefined || !ctx.createStereoPanner) return bus;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(bus); return p;
  };
  /** inviluppo: 0 → vol in `a` secondi, poi giù esponenziale fino a `dur` */
  const inviluppo = (g: GainNode, t: number, a: number, dur: number, vol: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur));
  };
  const m: Motore = {
    ctx, musica, duck, effetti, ambiente, rumore,
    now: () => ctx.currentTime,
    tono(o) {
      const t = o.t ?? ctx.currentTime, a = o.a ?? 0.005, osc = ctx.createOscillator(), g = ctx.createGain();
      if (o.onda === 'impulso') osc.setPeriodicWave(impulso(ctx)); else osc.type = o.onda ?? 'square';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
      if (o.vib) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = o.vib.f; lg.gain.value = o.f * o.vib.d; lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(t); lfo.stop(t + o.dur + 0.05);
      }
      let src: AudioNode = osc;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q ?? 0.7; osc.connect(f); src = f; }
      inviluppo(g, t, a, o.dur, o.vol);
      src.connect(g); g.connect(uscita(o.bus ?? effetti, o.pan));
      osc.start(t); osc.stop(t + o.dur + 0.05);
      osc.onended = () => g.disconnect();
    },
    soffio(o) {
      const t = o.t ?? ctx.currentTime, a = o.a ?? 0.004, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = rumore; src.loop = true;
      f.type = o.tipo ?? 'bandpass'; f.frequency.setValueAtTime(o.f, t); f.Q.value = o.q ?? 1;
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
      inviluppo(g, t, a, o.dur, o.vol);
      src.connect(f); f.connect(g); g.connect(uscita(o.bus ?? effetti, o.pan));
      src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
      src.onended = () => g.disconnect();
    },
    loop(o) {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = rumore; src.loop = true; f.type = o.tipo; f.frequency.value = o.f; f.Q.value = o.q ?? 0.7; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(o.bus);
      src.start(ctx.currentTime, Math.random() * 1.5);
      return { gain: g, filtro: f, stop: () => { try { src.stop(); } catch { /* già fermo */ } g.disconnect(); } };
    },
  };
  return m;
}

/** Nota MIDI → Hz. */
export const hz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
/** Piccola variazione casuale (±k): toni e volumi non sono mai identici due volte. */
export const vari = (k: number): number => 1 + (Math.random() * 2 - 1) * k;
