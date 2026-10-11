// I suoni della discesa (#229), sintetizzati come quelli delle Corse (zero file): il vento che sale con la velocità, il fruscio della terra
// sotto le ruote (più ruvido su radici ed erba), il botto degli atterraggi e delle cadute. Partono al primo tocco o tasto (i browser
// non suonano prima di un gesto).
import type { Bici } from '@marea/sim/corse/bici.ts';

export type SuoniBici = { aggiorna(b: Bici): void; muto(on: boolean): void };

export function creaSuoni(): SuoniBici {
  let ac: AudioContext | null = null, vento: GainNode | null = null, ventoF: BiquadFilterNode | null = null, terra: GainNode | null = null, terraF: BiquadFilterNode | null = null;
  let master: GainNode | null = null, zitto = false, ariaPrima = false, cadutePrima = 0;
  const avvia = () => {
    if (ac) return;
    const C = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!C) return;
    ac = new C();
    master = ac.createGain(); master.gain.value = zitto ? 0 : 0.8; master.connect(ac.destination);
    // rumore bianco in loop (2 s), due rami filtrati: vento (passa-banda che sale) e terra (passa-basso ruvido)
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const sorgente = (dest: AudioNode) => { const s = ac!.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); };
    ventoF = ac.createBiquadFilter(); ventoF.type = 'bandpass'; ventoF.Q.value = 0.7; vento = ac.createGain(); vento.gain.value = 0;
    ventoF.connect(vento); vento.connect(master); sorgente(ventoF);
    terraF = ac.createBiquadFilter(); terraF.type = 'lowpass'; terraF.frequency.value = 500; terra = ac.createGain(); terra.gain.value = 0;
    terraF.connect(terra); terra.connect(master); sorgente(terraF);
  };
  addEventListener('pointerdown', avvia); addEventListener('keydown', avvia);
  const botto = (forte: number) => {
    if (!ac || !master) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.5 * forte, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
  };
  return {
    aggiorna(b) {
      if (!ac || !vento || !ventoF || !terra || !terraF) return;
      const t = ac.currentTime, v = b.caduto ? 0 : b.v, k = Math.min(1, v / 16);
      vento.gain.setTargetAtTime(0.02 + k * k * 0.35, t, 0.15);
      ventoF.frequency.setTargetAtTime(300 + k * 1400, t, 0.15);
      const ruvido = b.sup === 'radici' ? 1 : b.sup === 'erba' ? 0.7 : 0.35;
      terra.gain.setTargetAtTime(b.aria ? 0 : Math.min(1, v / 8) * 0.25 * ruvido, t, 0.06);
      terraF.frequency.setTargetAtTime(b.sup === 'radici' ? 900 + Math.random() * 600 : 450 + v * 20, t, 0.03);
      if (ariaPrima && !b.aria && !b.caduto) botto(0.7);
      if (b.cadute > cadutePrima) botto(1.3);
      ariaPrima = b.aria; cadutePrima = b.cadute;
    },
    muto(on) { zitto = on; if (master) master.gain.value = on ? 0 : 0.8; },
  };
}
