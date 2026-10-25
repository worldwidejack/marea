// I vestiti degli eroi dei Templari (docs/TEMPLARI.md §4b): il tuo avatar di MAREA vestito da Crociato, Bucaniera o Arciere. Sono «corpi»
// come le armature del GDR (scatole pesate sulle ossa, rpg/vestito.ts: un draw call), con l'id `tpl_<eroe>` in Indossa.corpo; il copricapo
// (elmo, tricorno, cappuccio) è un cappello dell'avatar (game/avatar.ts, `setCappello`). Misure del corpo di chr_base a riposo: busto
// 0,95-1,30 m, spalle a ±0,2, cosce 0,46-0,85, avanti = −Z. Solo colori della palette (ART_BIBLE §2).
import type { Hue, Pz } from './vestito_pezzi.ts';
import { SX, avamb, lato } from './vestito_pezzi.ts';

/** Il copricapo di ogni eroe (id dei cappelli dell'avatar). */
export const TESTA_TEMPLARI: Record<string, string> = { crociato: 'elmo_templare', bucaniera: 'pirata', arciere: 'cappuccio_arciere' };
/** L'id del vestito dell'eroe (per Indossa.corpo). */
export const corpoTemplari = (classe: string): string => `tpl_${classe}`;

const HUE: Record<string, Hue> = {
  // tunica bianca con la croce rossa sopra la cotta di maglia
  tpl_crociato: { b: '#E8E1D6', d: '#7F7568', l: '#B9AFA3', t: '#E8433F' },
  // giacca rossa coi bottoni d'oro, camicia chiara, stivali e fusciacca scuri
  tpl_bucaniera: { b: '#E8433F', d: '#23201F', l: '#F4E3C1', t: '#F5D547' },
  // tunica verde, giubba e faretra di cuoio
  tpl_arciere: { b: '#4E9A46', d: '#8E5A2B', l: '#E2B97F', t: '#2C6B3F' },
};

// Busto e gonne poco più larghi del corpo (0,31-0,36 m): le braccia pendono a ±0,215 e non ci devono finire dentro. Maniche dalla spalla
// al gomito e sull'avambraccio giuste per il braccio (0,09-0,14), guanti e risvolti bassi: in mano non sembrano blocchi.
function crociato(): Pz[] {
  const P: Pz[] = [];
  P.push({ o: 'Spine', s: [0.35, 0.37, 0.24], at: [0, 1.135, 0], c: 'd' });            // la cotta di maglia (di lato, sotto le braccia)
  P.push({ o: 'Spine', s: [0.31, 0.37, 0.27], at: [0, 1.135, 0], c: 'b' });            // la sopravveste senza maniche
  P.push({ o: 'Spine', s: [0.07, 0.26, 0.02], at: [0, 1.11, -0.141], c: 't' });         // la croce rossa davanti
  P.push({ o: 'Spine', s: [0.22, 0.07, 0.02], at: [0, 1.16, -0.141], c: 't' });
  P.push({ o: 'Spine', s: [0.07, 0.24, 0.02], at: [0, 1.12, 0.141], c: 't' });          // e dietro
  P.push({ o: 'Spine', s: [0.2, 0.07, 0.02], at: [0, 1.16, 0.141], c: 't' });
  P.push({ o: 'Spine', s: [0.42, 0.07, 0.27], at: [0, 1.3, 0], c: 'd' });              // la maglia su spalle e collo
  P.push({ o: 'Hips', s: [0.36, 0.05, 0.28], at: [0, 0.95, 0], c: 'd' });              // la cintura
  P.push({ o: 'Hips', s: [0.41, 0.35, 0.32], at: [0, 0.755, 0], c: 'b' });               // la gonna della sopravveste, fino al ginocchio
  P.push({ o: 'Hips', s: [0.05, 0.3, 0.02], at: [0, 0.755, -0.163], c: 'l' });          // lo spacco
  for (const s of SX) {
    P.push({ o: lato('UpperArm', s), s: [0.14, 0.32, 0.14], at: [s * 0.215, 1.14, 0], c: 'd' }); // maniche di maglia, dalla spalla
    P.push(avamb(s, 0.84, 0.095, 0.24, 0.095, 'd'));
    P.push(avamb(s, 0.71, 0.1, 0.045, 0.1, 'l'));                                         // il polsino del guanto
    P.push({ o: lato('UpperLeg', s), s: [0.125, 0.2, 0.13], at: [s * 0.09, 0.55, 0], c: 'd' }); // la maglia sulle ginocchia
    P.push({ o: lato('LowerLeg', s), s: [0.12, 0.26, 0.13], at: [s * 0.09, 0.3, 0], c: 'd' }); // le calze di maglia
  }
  return P;
}

function bucaniera(): Pz[] {
  const P: Pz[] = [];
  P.push({ o: 'Spine', s: [0.33, 0.37, 0.27], at: [0, 1.135, 0], c: 'b' });            // la giacca
  P.push({ o: 'Spine', s: [0.12, 0.3, 0.02], at: [0, 1.13, -0.141], c: 'l' });          // la camicia aperta davanti
  for (const y of [1.2, 1.12, 1.04]) for (const s of SX) P.push({ o: 'Spine', s: [0.03, 0.03, 0.02], at: [s * 0.085, y, -0.143], c: 't' }); // bottoni
  P.push({ o: 'Spine', s: [0.42, 0.07, 0.28], at: [0, 1.3, 0], c: 'b' });              // il bavero sulle spalle
  P.push({ o: 'Hips', s: [0.36, 0.08, 0.28], at: [0, 0.95, 0], c: 'd' });              // la fusciacca
  P.push({ o: 'Hips', s: [0.05, 0.16, 0.03], at: [0.1, 0.86, -0.14], c: 'd', r: [0, 0, 0.25] });
  P.push({ o: 'Hips', s: [0.34, 0.34, 0.06], at: [0, 0.75, 0.12], c: 'b' });           // le falde dietro
  for (const s of SX) {
    P.push({ o: lato('UpperArm', s), s: [0.14, 0.32, 0.14], at: [s * 0.215, 1.14, 0], c: 'b' });
    P.push(avamb(s, 0.86, 0.095, 0.2, 0.095, 'b'));
    P.push(avamb(s, 0.8, 0.105, 0.035, 0.105, 't'));                                     // la riga d'oro del risvolto
    P.push({ o: lato('LowerLeg', s), s: [0.13, 0.3, 0.14], at: [s * 0.09, 0.28, 0], c: 'd' }); // gli stivali
    P.push({ o: lato('LowerLeg', s), s: [0.145, 0.05, 0.155], at: [s * 0.09, 0.44, 0], c: 'd' });
  }
  return P;
}

function arciere(): Pz[] {
  const P: Pz[] = [];
  P.push({ o: 'Spine', s: [0.33, 0.37, 0.27], at: [0, 1.135, 0], c: 'b' });            // la tunica
  P.push({ o: 'Spine', s: [0.25, 0.24, 0.02], at: [0, 1.1, -0.14], c: 'd' });           // la giubba di cuoio
  P.push({ o: 'Spine', s: [0.05, 0.42, 0.02], at: [0.04, 1.12, -0.15], c: 'd', r: [0, 0, -0.6] }); // la cinghia della faretra
  P.push({ o: 'Spine', s: [0.12, 0.38, 0.11], at: [0.06, 1.18, 0.17], c: 'd', r: [0, 0, -0.25] }); // la faretra
  for (const k of [-0.03, 0.01, 0.05]) P.push({ o: 'Spine', s: [0.025, 0.12, 0.025], at: [0.1 + k, 1.43 - k * 0.6, 0.17], c: 'l', r: [0, 0, -0.25] }); // le penne
  P.push({ o: 'Spine', s: [0.4, 0.1, 0.27], at: [0, 1.29, 0.02], c: 't' });           // il cappuccio calato sulle spalle
  P.push({ o: 'Hips', s: [0.36, 0.05, 0.28], at: [0, 0.95, 0], c: 'd' });              // la cintura
  P.push({ o: 'Hips', s: [0.36, 0.22, 0.27], at: [0, 0.83, 0], c: 'b' });              // la tunica fino a metà coscia
  for (const s of SX) {
    P.push({ o: lato('UpperArm', s), s: [0.14, 0.32, 0.14], at: [s * 0.215, 1.14, 0], c: 'b' });
    P.push(avamb(s, 0.9, 0.085, 0.09, 0.085, 'd'));                                       // i bracciali di cuoio
    P.push({ o: lato('LowerLeg', s), s: [0.125, 0.24, 0.135], at: [s * 0.09, 0.3, 0], c: 'd' }); // gli stivaletti
  }
  return P;
}

const PEZZI: Record<string, () => Pz[]> = { tpl_crociato: crociato, tpl_bucaniera: bucaniera, tpl_arciere: arciere };
const fatti = new Map<string, Pz[]>();
/** I pezzi e i colori del vestito `id` (tpl_crociato, tpl_bucaniera, tpl_arciere); null se non è un vestito dei Templari. */
export function costumeTemplari(id: string): { pezzi: Pz[]; hue: Hue } | null {
  const f = PEZZI[id], hue = HUE[id];
  if (!f || !hue) return null;
  let p = fatti.get(id);
  if (!p) { p = f(); fatti.set(id, p); }
  return { pezzi: p, hue };
}
