// Suoni della guida del motore v2 (#170), sintetizzati con WebAudio (niente file): il motore che sale con la velocità, la sgommata
// del drift, il «ding» a ogni livello della carica (blu, arancio, viola, sempre più acuto), la fiammata del turbo, il semaforo,
// l'acrobazia, la scia, il motore ingolfato e l'atterraggio. Il contesto audio nasce al primo gesto (regola dei browser).
// Per ora lo usa il banco di prova (provapiste.html); il gioco vero ha il suo motore audio (audio/), dove questi suoni andranno quando
// il circuito della Spiaggia prenderà il posto del Gran Premio.

export type SuoniGuida = {
  /** Da chiamare a ogni frame: velocità (m/s), velocità massima, turbo acceso, in drift, a terra. */
  motore(v: number, vmax: number, turbo: boolean, drift: boolean, terra: boolean): void;
  livello(lv: number): void;
  turbo(lv: number): void;
  bip(via: boolean): void;
  acrobazia(): void;
  scia(): void;
  ingolfato(): void;
  atterra(forte: number): void;
  acceso: boolean;
  /** Spegne i suoni continui (pausa, fine gara). */
  zitto(): void;
};

export function creaSuoni(): SuoniGuida {
  let ctx: AudioContext | null = null, out: GainNode | null = null, rumore: AudioBuffer | null = null;
  let mot: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; lp: BiquadFilterNode } | null = null;
  let sgomma: { g: GainNode; bp: BiquadFilterNode } | null = null;
  const avvia = () => {
    if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC(); out = ctx.createGain(); out.gain.value = api.acceso ? 0.5 : 0; out.connect(ctx.destination);
    rumore = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = rumore.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // il motore: due dente di sega leggermente stonati in un passa-basso (ronzio da kart)
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 50; o2.frequency.value = 25.5;
    lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out); o1.start(); o2.start();
    mot = { o1, o2, g, lp };
    // la sgommata: rumore in un passa-banda, acceso solo in drift
    const src = ctx.createBufferSource(), sg = ctx.createGain(), bp = ctx.createBiquadFilter();
    src.buffer = rumore; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3; sg.gain.value = 0;
    src.connect(bp); bp.connect(sg); sg.connect(out); src.start();
    sgomma = { g: sg, bp };
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, avvia, { passive: true });

  const tono = (f: number, dur: number, vol: number, tipo: OscillatorType = 'square', f2?: number, ritardo = 0) => {
    if (!ctx || !out) return;
    const t = ctx.currentTime + ritardo, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  };
  const soffio = (dur: number, vol: number, f0: number, f1: number) => {
    if (!ctx || !out || !rumore) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    src.buffer = rumore; bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.02);
  };

  const api: SuoniGuida = {
    acceso: true,
    motore(v, vmax, turbo, drift, terra) {
      if (!ctx || !mot || !sgomma || !out) return;
      const t = ctx.currentTime, k = Math.max(0, Math.min(1.4, Math.abs(v) / Math.max(1, vmax)));
      out.gain.setTargetAtTime(api.acceso ? 0.5 : 0, t, 0.05);
      const f = 42 + k * 95 + (turbo ? 18 : 0) + (terra ? 0 : 25); // in aria le ruote girano a vuoto: sale
      mot.o1.frequency.setTargetAtTime(f, t, 0.06); mot.o2.frequency.setTargetAtTime(f * 0.51, t, 0.06);
      mot.lp.frequency.setTargetAtTime(380 + k * 900 + (turbo ? 900 : 0), t, 0.08);
      mot.g.gain.setTargetAtTime(0.05 + k * 0.06, t, 0.08);
      sgomma.g.gain.setTargetAtTime(drift && terra ? 0.07 : 0, t, 0.04);
      sgomma.bp.frequency.setTargetAtTime(2000 + k * 900, t, 0.1);
    },
    livello(lv) { tono(660 * (lv === 1 ? 1 : lv === 2 ? 1.26 : 1.5), 0.12, 0.09, 'square', undefined); tono(1320 * (lv === 1 ? 1 : lv === 2 ? 1.26 : 1.5), 0.1, 0.05, 'triangle', undefined, 0.05); },
    turbo(lv) { soffio(0.45 + lv * 0.12, 0.35, 500, 3200); tono(90, 0.3, 0.18, 'sawtooth', 45); },
    bip(via) { tono(via ? 880 : 440, via ? 0.5 : 0.18, 0.12, 'square'); },
    acrobazia() { tono(500, 0.22, 0.08, 'triangle', 1400); },
    scia() { soffio(0.6, 0.18, 300, 1400); },
    ingolfato() { for (let i = 0; i < 4; i++) tono(70 + i * 6, 0.09, 0.2, 'sawtooth', 40, i * 0.13); soffio(0.5, 0.1, 400, 200); },
    atterra(forte) { tono(110, 0.14, Math.min(0.25, 0.06 + forte * 0.02), 'square', 55); },
    zitto() { if (!ctx || !mot || !sgomma) return; mot.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); sgomma.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); },
  };
  return api;
}
