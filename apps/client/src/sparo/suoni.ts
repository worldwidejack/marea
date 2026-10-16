// I suoni dello sparatutto (#355), sintetizzati come quelli delle Corse e della discesa (zero file): lo sparo è un colpo di rumore
// filtrato + un tonfo grave che scende + uno schiocco acuto, diverso per arma; poi ricarica (clic del caricatore, carrello), il pompa
// che scarrella, il colpo a vuoto, la X del colpo a segno (più acuta alla testa), il «ding» dell'uccisione, passi, salto e atterraggio,
// il ping dei colpi sulla lamiera. Gli spari degli altri arrivano da dove sono (panning e distanza). Partono al primo tocco o tasto.

export type SuoniSparo = {
  sparo(arma: string, o?: { pan?: number; dist?: number }): void;
  ricarica(arma: string, secondi: number): void;
  carico(arma: string): void;
  vuoto(): void; segno(testa: boolean): void; ucciso(): void;
  passo(forte: number): void; salto(): void; atterra(forte: number): void;
  impatto(metallo: boolean, dist: number): void;
  colpitoIo(): void;
  muto(on: boolean): void;
};

type Ricetta = { lp: number; coda: number; tonfo: [number, number, number]; gain: number; schiocco: number; eco: number };
const ARMI: Record<string, Ricetta> = {
  pistola: { lp: 3600, coda: 0.15, tonfo: [150, 52, 0.1], gain: 0.85, schiocco: 0.55, eco: 0.25 },
  mitra: { lp: 3000, coda: 0.1, tonfo: [118, 46, 0.08], gain: 0.7, schiocco: 0.4, eco: 0.18 },
  pompa: { lp: 1900, coda: 0.42, tonfo: [92, 34, 0.24], gain: 1.15, schiocco: 0.7, eco: 0.5 },
};

export function creaSuoni(): SuoniSparo {
  let ac: AudioContext | null = null, master: GainNode | null = null, rumore: AudioBuffer | null = null, zitto = false;
  const avvia = () => {
    if (ac) { if (ac.state === 'suspended') void ac.resume(); return; }
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    ac = new C();
    master = ac.createGain(); master.gain.value = zitto ? 0 : 0.7;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    rumore = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = rumore.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  addEventListener('pointerdown', avvia); addEventListener('keydown', avvia); addEventListener('mousedown', avvia);

  /** Un colpo di rumore filtrato con inviluppo esponenziale. */
  const soffio = (t: number, tipo: BiquadFilterType, f: number, q: number, g: number, dur: number, dest: AudioNode) => {
    if (!ac || !rumore) return;
    const s = ac.createBufferSource(); s.buffer = rumore; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const fl = ac.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f; fl.Q.value = q;
    const gn = ac.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(gn); gn.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  const tono = (t: number, tipo: OscillatorType, f0: number, f1: number, g: number, dur: number, dest: AudioNode) => {
    if (!ac) return;
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  };
  /** Uscita col pan (−1..1) e il volume della distanza. */
  const uscita = (pan = 0, dist = 0): AudioNode | null => {
    if (!ac || !master) return null;
    const g = ac.createGain(); g.gain.value = 1 / (1 + dist * 0.06);
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p); p.connect(master);
    return g;
  };
  const clic = (t: number, f: number, g: number) => { const o = uscita(); if (o) { soffio(t, 'bandpass', f, 3, g, 0.035, o); tono(t, 'square', f * 0.5, f * 0.4, g * 0.25, 0.02, o); } };

  return {
    sparo(arma, o = {}) {
      const r = ARMI[arma] ?? ARMI.mitra!, out = uscita(o.pan, o.dist);
      if (!ac || !out) return;
      const t = ac.currentTime + 0.003, lontano = (o.dist ?? 0) > 6;
      const lp = lontano ? r.lp * 0.45 : r.lp;
      soffio(t, 'lowpass', lp * (0.92 + Math.random() * 0.16), 0.8, r.gain, r.coda, out);
      if (!lontano) soffio(t, 'highpass', 4200, 0.7, r.schiocco, 0.025, out);
      tono(t, 'sine', r.tonfo[0] * (0.95 + Math.random() * 0.1), r.tonfo[1], r.gain * 0.9, r.tonfo[2], out);
      // la coda: il botto che rimbalza tra i container
      soffio(t + 0.04, 'lowpass', 700, 0.6, r.gain * r.eco * 0.5, r.coda * 2.2, out);
      if (arma === 'pompa') { clic(t + 0.32, 900, 0.35); clic(t + 0.45, 1300, 0.4); }
    },
    ricarica(arma, secondi) {
      if (!ac) return;
      const t = ac.currentTime;
      if (arma === 'pompa') return; // il pompa fa un clic a colpo (carico)
      clic(t + secondi * 0.15, 1100, 0.35); clic(t + secondi * 0.55, 1500, 0.45); clic(t + secondi * 0.82, 900, 0.4); clic(t + secondi * 0.92, 1300, 0.45);
    },
    carico(arma) { if (ac && arma === 'pompa') clic(ac.currentTime, 1200, 0.35); },
    vuoto() { if (ac) clic(ac.currentTime, 2400, 0.3); },
    segno(testa) {
      const o = uscita(); if (!ac || !o) return;
      const t = ac.currentTime;
      tono(t, 'triangle', testa ? 2900 : 1900, testa ? 2600 : 1700, 0.28, 0.06, o);
      if (testa) soffio(t, 'bandpass', 3800, 4, 0.25, 0.05, o);
    },
    ucciso() {
      const o = uscita(); if (!ac || !o) return;
      const t = ac.currentTime + 0.03;
      tono(t, 'sine', 988, 980, 0.3, 0.32, o); tono(t + 0.07, 'sine', 1480, 1470, 0.24, 0.36, o);
    },
    passo(forte) { const o = uscita(); if (ac && o) soffio(ac.currentTime, 'lowpass', 380, 1, 0.12 * forte, 0.07, o); },
    salto() { const o = uscita(); if (ac && o) soffio(ac.currentTime, 'lowpass', 500, 1, 0.12, 0.08, o); },
    atterra(forte) { const o = uscita(); if (ac && o) { const t = ac.currentTime; tono(t, 'sine', 90, 40, Math.min(0.6, forte * 0.05), 0.14, o); soffio(t, 'lowpass', 420, 1, Math.min(0.4, forte * 0.04), 0.12, o); } },
    impatto(metallo, dist) {
      const o = uscita(0, dist); if (!ac || !o || Math.random() < 0.5) return;
      const t = ac.currentTime;
      if (metallo) tono(t, 'sine', 2200 + Math.random() * 1600, 1800, 0.08, 0.09, o);
      else soffio(t, 'bandpass', 900, 1.5, 0.1, 0.05, o);
    },
    colpitoIo() { const o = uscita(); if (ac && o) { const t = ac.currentTime; tono(t, 'sine', 70, 40, 0.5, 0.18, o); soffio(t, 'lowpass', 300, 1, 0.3, 0.15, o); } },
    muto(on) { zitto = on; if (master) master.gain.value = on ? 0 : 0.7; },
  };
}
