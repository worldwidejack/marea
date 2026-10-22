// Le pose del retino. Ogni posa dice dove sta la mano (nel riferimento dell'avatar: x a destra, y in su, z indietro, avanti = −z),
// come è inclinata l'asta (pitch: + verso dietro, − verso avanti; a −π/2 l'asta è orizzontale in avanti; giro: quanto è girata a sinistra,
// così la rete atterra davanti a te e non davanti alla mano destra) e quanto si piega il corpo
// (lean = busto in avanti, twist = spalla destra indietro, knee = ginocchia piegate, in radianti). Il colpo scorre fra le pose chiave:
// guardia → carica (tutto indietro) → apice (sopra la testa) → impatto (la rete sul prato, bocca in giù) → guardia.
// Niente three: lo usano l'animazione (game/retino_anim.ts) e i test di Node.
import type { AzioneRetino } from './retino_azione.ts';

export type PosaRetino = { hx: number; hy: number; hz: number; pitch: number; roll: number; giro: number; lean: number; twist: number; knee: number };

const GUARDIA: PosaRetino = { hx: 0.22, hy: 0.95, hz: -0.22, pitch: -0.32, roll: 0.16, giro: 0, lean: 0, twist: 0, knee: 0 };
const CARICA: PosaRetino = { hx: 0.3, hy: 1.12, hz: 0.12, pitch: 1.15, roll: 0.22, giro: 0, lean: 0.12, twist: 0.5, knee: 0.3 };
const APICE: PosaRetino = { hx: 0.26, hy: 1.42, hz: -0.1, pitch: -0.15, roll: 0.12, giro: 0.1, lean: 0.2, twist: 0.1, knee: 0.35 };
export const IMPATTO: PosaRetino = { hx: 0.2, hy: 0.74, hz: -0.46, pitch: -2.1, roll: 0, giro: 0.19, lean: 0.62, twist: -0.15, knee: 0.55 };

const CHIAVI = Object.keys(GUARDIA) as (keyof PosaRetino)[];
const mix = (a: PosaRetino, b: PosaRetino, k: number): PosaRetino => {
  const o = { ...a };
  for (const c of CHIAVI) o[c] = a[c] + (b[c] - a[c]) * k;
  return o;
};
const esce = (k: number) => 1 - (1 - k) * (1 - k);
const dolce = (k: number) => k * k * (3 - 2 * k);
/** Il punto dell'arco in cui il retino passa sopra la testa, in frazione di fendente (già accelerato). */
const APICE_A = 0.45;

export function posaRetino(s: Pick<AzioneRetino, 'fase' | 'carica' | 'colpo'>): PosaRetino {
  const c = s.colpo;
  if (!c) return s.fase === 'carica' ? mix(GUARDIA, CARICA, esce(s.carica)) : GUARDIA;
  const u = Math.min(1, c.t / c.durata);
  switch (c.fase) {
    case 'avvio': return mix(GUARDIA, CARICA, esce(c.da + (1 - c.da) * u));
    case 'fendente': { const e = u * u; return e < APICE_A ? mix(CARICA, APICE, e / APICE_A) : mix(APICE, IMPATTO, (e - APICE_A) / (1 - APICE_A)); }
    case 'impatto': return { ...IMPATTO, lean: IMPATTO.lean + 0.05 * Math.sin(u * Math.PI) };
    case 'lag': { const r = Math.exp(-4 * u) * Math.sin(u * Math.PI * 3); return { ...IMPATTO, pitch: IMPATTO.pitch + 0.1 * r, hy: IMPATTO.hy + 0.03 * r }; }
    case 'risalita': return mix(IMPATTO, GUARDIA, dolce(u));
  }
}
