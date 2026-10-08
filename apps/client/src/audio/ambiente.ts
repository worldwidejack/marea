// Ambiente (chunk audio): il mare che respira (rumore filtrato: ogni onda sale e scende in 5-9 s, più chiara sulla cresta, con la
// risacca subito dopo), vento in mare aperto e nelle raffiche, scia della barca proporzionale alla velocità, gabbiani lontani ogni
// tanto vicino alla costa di giorno, grilli e rane di notte (col ciclo giorno/notte acceso), pioggia e vento del meteo (setMeteo),
// gocce che cadono nel dungeon. `aggiorna` riceve il tempo dell'audio: così lo stesso codice gira dal vivo e in un OfflineAudioContext.
import type { Meteo } from './ponte.ts';
import { SUONI } from './effetti.ts';
import type { Motore } from './motore.ts';

export type Scena = {
  /** 0..1: quanta terra c'è attorno (0 mare aperto, 1 dentro un'isola) */
  terra: number;
  inBarca: boolean;
  /** 0..1: velocità della barca rispetto al massimo */
  velocita: number;
  /** 0..1: quanto è notte */
  notte: number;
  dungeon: boolean;
  /** 0..1: raffica della Regata */
  raffica: number;
};
export type Ambiente = { aggiorna(s: Scena, t: number): void; meteo(tipo: Meteo, k: number): void; readonly stato: Record<string, number> };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function createAmbiente(mt: Motore): Ambiente {
  const bus = mt.ambiente;
  const onde = mt.loop({ tipo: 'lowpass', f: 420, q: 0.5, bus });
  const risacca = mt.loop({ tipo: 'bandpass', f: 1100, q: 0.4, bus });
  const vento = mt.loop({ tipo: 'bandpass', f: 520, q: 0.9, bus });
  const scia = mt.loop({ tipo: 'lowpass', f: 700, q: 0.7, bus });
  const pioggia = mt.loop({ tipo: 'bandpass', f: 4200, q: 0.35, bus });
  let prossimaOnda = 0, prossimoGabbiano = rnd(4, 9), prossimoGrillo = 0, prossimaRana = rnd(1, 3), prossimaGoccia = rnd(1, 3), prossimaStilla = 0;
  let met: { tipo: Meteo; k: number } = { tipo: 'sereno', k: 0 }, livelloOnde = 0, ultimaRaffica = 0;
  const stato = { onde: 0, vento: 0, scia: 0, gabbiani: 0, grilli: 0, rane: 0, gocce: 0, pioggia: 0 };

  /** Un gabbiano lontano: 2-3 «kyaa» che scendono, con un tremolio veloce, da un lato. */
  const gabbiano = (t: number) => {
    const pan = rnd(-0.8, 0.8), v = rnd(0.018, 0.034), n = 2 + Math.floor(Math.random() * 2), f0 = rnd(1250, 1650);
    for (let i = 0; i < n; i++) mt.tono({ f: f0 * (i === 0 ? 1.05 : 1), f2: f0 * 0.62, onda: 'triangle', t: t + i * rnd(0.22, 0.3), dur: rnd(0.2, 0.3), vol: v, a: 0.04, lp: 2600, vib: { f: 22, d: 0.03 }, bus, pan });
    stato.gabbiani++;
  };
  /** Un grillo: 3-4 impulsi a ~4,4 kHz. */
  const grillo = (t: number, k: number) => {
    const f = rnd(4000, 4800), pan = rnd(-0.9, 0.9), n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) mt.tono({ f, onda: 'sine', t: t + i * 0.034, dur: 0.02, vol: 0.011 * k, a: 0.003, bus, pan });
    stato.grilli++;
  };
  /** Una rana: gracidio a impulsi su una quadra bassa e filtrata. */
  const rana = (t: number, k: number) => {
    const f = rnd(90, 135), pan = rnd(-0.7, 0.7), n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) mt.tono({ f: f * (1 + i * 0.02), onda: 'square', t: t + i * 0.042, dur: 0.032, vol: 0.035 * k, a: 0.004, lp: 520, bus, pan });
    stato.rane++;
  };

  return {
    get stato() { return { ...stato, livelloOnde }; },
    meteo(tipo, k) { met = { tipo, k: Math.max(0, Math.min(1, k)) }; },
    aggiorna(s, t) {
      const mare = s.dungeon ? 0 : 1, costa = s.terra > 0.04 && s.terra < 0.9;
      // ---- onde: una alla volta, ognuna con la sua durata e altezza; vicino alla riva più forti ----
      const base = mare * (0.09 + 0.13 * Math.min(1, (1 - s.terra) * 1.6)) * (s.terra > 0.95 ? 0.5 : 1);
      if (t >= prossimaOnda) {
        const P = rnd(5, 9), picco = base * rnd(0.8, 1.15), basso = base * 0.28, tc = t + P * rnd(0.35, 0.45);
        onde.gain.gain.setValueAtTime(Math.max(0.0001, livelloOnde), t);
        onde.gain.gain.linearRampToValueAtTime(picco, tc); onde.gain.gain.linearRampToValueAtTime(basso, t + P);
        onde.filtro.frequency.setValueAtTime(380, t); onde.filtro.frequency.linearRampToValueAtTime(rnd(800, 1100), tc); onde.filtro.frequency.linearRampToValueAtTime(380, t + P);
        risacca.gain.gain.setValueAtTime(0.0001, t); risacca.gain.gain.linearRampToValueAtTime(0.0001, tc - 0.3);
        risacca.gain.gain.linearRampToValueAtTime(picco * (costa ? 0.4 : 0.15), tc + 0.5); risacca.gain.gain.linearRampToValueAtTime(0.0001, tc + P * 0.4);
        livelloOnde = basso; prossimaOnda = t + P; stato.onde++;
      }
      // ---- vento: mare aperto (soprattutto in barca), raffiche della Regata, meteo ----
      const aperto = mare * Math.max(0, 1 - s.terra * 3) * (s.inBarca ? 1 : 0.5);
      const kv = met.tipo === 'vento' ? met.k : met.tipo === 'pioggia' ? met.k * 0.4 : 0;
      const gv = 0.035 * aperto + 0.22 * s.raffica + 0.2 * kv + (s.dungeon ? 0.03 : 0);
      vento.gain.gain.setTargetAtTime(gv, t, 0.6);
      vento.filtro.frequency.setTargetAtTime(s.dungeon ? 160 : 420 + 260 * Math.sin(t * 0.21) + 140 * Math.sin(t * 0.53) + 900 * s.raffica, t, 0.8);
      if (s.raffica > 0.3 && t - ultimaRaffica > 2.5) { SUONI.raffica(mt, t, s.raffica); ultimaRaffica = t; }
      stato.vento = gv;
      // ---- scia: l'acqua che scorre sotto la barca ----
      const gs = s.inBarca ? 0.13 * s.velocita : 0;
      scia.gain.gain.setTargetAtTime(gs, t, 0.25); scia.filtro.frequency.setTargetAtTime(450 + 1200 * s.velocita, t, 0.3); stato.scia = gs;
      // ---- pioggia: fruscio più le stille che picchiano ----
      const kp = met.tipo === 'pioggia' ? met.k : 0;
      pioggia.gain.gain.setTargetAtTime(0.12 * kp * mare, t, 1); stato.pioggia = kp;
      if (kp > 0 && t >= prossimaStilla) { mt.tono({ f: rnd(2200, 5200), onda: 'sine', t, dur: 0.012, vol: 0.02 * kp, bus, pan: rnd(-1, 1) }); prossimaStilla = t + rnd(0.02, 0.12) / kp; }
      // ---- animali ----
      if (t >= prossimoGabbiano) { if (mare && costa && s.notte < 0.3 && kp < 0.5) gabbiano(t); prossimoGabbiano = t + rnd(7, 18); }
      if (t >= prossimoGrillo) { if (mare && s.notte > 0.25 && s.terra > 0.04) grillo(t, s.notte); prossimoGrillo = t + rnd(0.28, 0.75); }
      if (t >= prossimaRana) { if (mare && s.notte > 0.5 && costa) rana(t, s.notte); prossimaRana = t + rnd(1.3, 4.5); }
      // ---- dungeon: gocce con l'eco ----
      if (t >= prossimaGoccia) { if (s.dungeon) { SUONI.goccia(mt, t, 0); stato.gocce++; } prossimaGoccia = t + rnd(1.8, 5.5); }
    },
  };
}
