// I suoni della Difesa (#358, #379). Se la pelle li ha (pelle.json → `suoni`: nome → file), sono effetti veri (ElevenLabs per l'orto),
// decodificati al primo tocco e suonati con un filo di tono diverso ogni volta per non ripetersi; altrimenti (o finché non sono pronti)
// restano i sintetizzati di prima, zero file: il «pop» di chi pianti, il «tup» dei colpi, lo schiocco quando colpisci (metallico
// sull'armatura), il morso, il boccone, il trillo della moneta, i botti, il motore del tosaerba, il corno dell'ondata e la sirena
// dell'ondata enorme, la fanfara e il lamento di fine partita. Partono al primo tocco o tasto (regola dei browser).
import type { Pelle } from './skin.ts';

export type SuoniDifesa = {
  pianta(): void; spara(gelo: boolean): void; colpito(armatura: boolean): void; armatura(): void; morso(): void; mangiato(): void;
  moneta(): void; raccolta(): void; botto(grosso: boolean): void; tosaerba(): void; salto(): void; ondata(): void; enorme(): void;
  vinta(): void; persa(): void; no(): void; muto(on: boolean): void;
  /** I file della pelle (se ne ha): si decodificano subito se l'audio è già partito, sennò al primo tocco. */
  pelle(p: Pelle): void;
  /** Quanti effetti da file sono pronti (per i test). */
  pronti(): number;
};

export function creaSuoni(): SuoniDifesa {
  let ac: AudioContext | null = null, master: GainNode | null = null, rumore: AudioBuffer | null = null, zitto = false, ultimoColpo = 0;
  let mappa: Record<string, string[]> = {}, dir = '', giro = 0;
  const buf = new Map<string, AudioBuffer[]>();
  /** Decodifica i file della pelle corrente (una volta per pelle; se nel frattempo la pelle cambia, i vecchi si buttano). */
  const decodifica = async () => {
    if (!ac) return;
    const mio = ++giro;
    buf.clear();
    for (const [nome, files] of Object.entries(mappa)) {
      const lista: AudioBuffer[] = [];
      for (const f of files) {
        try {
          const r = await fetch(dir + f);
          if (r.ok) lista.push(await ac.decodeAudioData(await r.arrayBuffer()));
        } catch { /* resta il sintetizzato */ }
      }
      if (mio !== giro) return;
      if (lista.length) buf.set(nome, lista);
    }
  };
  const avvia = () => {
    if (ac) { if (ac.state === 'suspended') void ac.resume(); return; }
    try {
      ac = new AudioContext(); master = ac.createGain(); master.gain.value = zitto ? 0 : 0.5; master.connect(ac.destination);
      rumore = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = rumore.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      void decodifica();
    } catch { ac = null; }
  };
  addEventListener('pointerdown', avvia, { passive: true }); addEventListener('keydown', avvia);
  /** Suona l'effetto `nome` da file, se c'è: ritorna false se non c'è (allora suona il sintetizzato). */
  const file = (nome: string, vol = 1, varia = 0.06): boolean => {
    const l = buf.get(nome);
    if (!ac || !master || !l?.length) return false;
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = l[Math.floor(Math.random() * l.length)]!;
    s.playbackRate.value = 1 + (Math.random() * 2 - 1) * varia;
    g.gain.value = vol;
    s.connect(g).connect(master); s.start();
    return true;
  };
  /** Un tono che scivola da f0 a f1 in `dur` secondi. */
  const tono = (tipo: OscillatorType, f0: number, f1: number, dur: number, vol: number, ritardo = 0) => {
    if (!ac || !master) return;
    const t = ac.currentTime + ritardo, o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const soffio = (lp: number, dur: number, vol: number, ritardo = 0) => {
    if (!ac || !master || !rumore) return;
    const t = ac.currentTime + ritardo, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = rumore; f.type = 'lowpass'; f.frequency.value = lp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  return {
    pianta() { if (!file('pianta', 0.8)) { tono('sine', 220, 520, 0.12, 0.35); soffio(900, 0.1, 0.25); } },
    spara(gelo) { if (!file(gelo ? 'sparaGelo' : 'spara', 0.45, 0.08)) tono('triangle', gelo ? 700 : 520, gelo ? 380 : 240, 0.07, 0.18); },
    colpito(armatura) {
      if (!ac) return;
      const ora = ac.currentTime; if (ora - ultimoColpo < 0.03) return; ultimoColpo = ora;
      if (file(armatura ? 'colpoLatta' : 'colpo', armatura ? 0.45 : 0.55, 0.1)) return;
      if (armatura) { tono('square', 1400, 900, 0.06, 0.08); tono('sine', 2600, 2000, 0.08, 0.06); } else { soffio(1600, 0.07, 0.3); tono('sine', 300, 120, 0.06, 0.15); }
    },
    armatura() { if (!file('armatura', 0.7)) { tono('square', 900, 300, 0.18, 0.1); soffio(2500, 0.15, 0.2); } },
    morso() { if (!file('morso', 0.6, 0.1)) { soffio(700, 0.08, 0.25); tono('square', 160, 90, 0.06, 0.08); } },
    mangiato() { if (!file('mangiato', 0.8)) { tono('sine', 300, 70, 0.3, 0.3); soffio(500, 0.25, 0.3); } },
    moneta() { if (!file('seme', 0.35)) tono('sine', 1300, 1700, 0.15, 0.08); },
    raccolta() { if (!file('raccolta', 0.6, 0.04)) { tono('sine', 990, 990, 0.08, 0.2); tono('sine', 1480, 1480, 0.12, 0.2, 0.07); } },
    botto(grosso) { if (!file(grosso ? 'scoppio' : 'scoppietto', grosso ? 1 : 0.8, 0.05)) { soffio(grosso ? 700 : 1000, grosso ? 0.9 : 0.5, grosso ? 1 : 0.7); tono('sine', grosso ? 120 : 160, 30, grosso ? 0.7 : 0.4, 0.8); } },
    tosaerba() { if (!file('annaffiatoio', 0.9, 0.02)) for (let i = 0; i < 6; i++) tono('sawtooth', 70 + i * 4, 90, 0.14, 0.12, i * 0.12); },
    salto() { if (!file('salto', 0.6, 0.08)) tono('sine', 300, 900, 0.18, 0.15); },
    ondata() { if (!file('ondata', 0.55, 0)) { tono('sawtooth', 180, 200, 0.6, 0.18); tono('sawtooth', 240, 260, 0.7, 0.14, 0.15); } },
    enorme() { if (!file('enorme', 0.42, 0)) for (let i = 0; i < 3; i++) tono('sawtooth', 420, 860, 0.45, 0.16, i * 0.5); },
    vinta() { if (!file('vinta', 0.8, 0)) [523, 659, 784, 1046].forEach((f, i) => tono('triangle', f, f, 0.22, 0.25, i * 0.13)); },
    persa() { if (!file('persa', 0.6, 0)) [392, 330, 262, 196].forEach((f, i) => tono('triangle', f, f * 0.97, 0.35, 0.25, i * 0.25)); },
    no() { if (!file('no', 0.5, 0)) tono('square', 200, 150, 0.1, 0.12); },
    muto(on) { zitto = on; if (master) master.gain.value = on ? 0 : 0.5; },
    pelle(p) { mappa = p.suoni; dir = p.dir; if (ac) void decodifica(); else buf.clear(); },
    pronti: () => buf.size,
  };
}
