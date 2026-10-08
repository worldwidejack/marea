// @marea/content/porto.ts: il Porto più ricco (#63-#65). Gente del Porto (personaggi non giocanti, battute, giri), posti del Mercante
// e della Bacheca, missioni del giorno. Entry separata da index.ts come rpg.ts. Solo dati: le formule stanno in @marea/sim/economy/missioni.ts.
// Coordinate in celle dell'isola `porto` (interi = centro della cella, come `props` in islands.json); `rot` = rotazione Y in radianti.
import gente from './gente.json' with { type: 'json' };
import missioni from './missioni.json' with { type: 'json' };
import type { Resources } from './types.ts';

export type PortoLook = { pelle: number; capelli: number; coloreCapelli: number; vestito: number; cappello: number };
/** Una persona del Porto: `giro` = punti da percorrere avanti e indietro (uno solo = ferma), `velocita` in m/s, `raggio` = da quanto vicino si parla. */
export type PersonaPorto = { id: string; nome: string; ruolo: 'mercante' | 'contrabbandiere' | 'guida'; look: PortoLook; giro: [number, number][]; velocita: number; raggio: number; battute: string[] };
/** Banco del Mercante o Bacheca: dove sta il prop (`at`, `rot`) e dove si mette chi gioca per usarlo (`fronte`, entro `raggio` m). */
export type PortoPosto = { nome: string; cartello: string; at: [number, number]; rot: number; fronte: [number, number]; raggio: number };
/** `contrabbando`: banco del Contrabbandiere accanto alla Grotta (GDR: monete, merce in rpg/balance.json `contrabbando`). */
export type GenteDef = { posti: { mercante: PortoPosto; bacheca: PortoPosto; contrabbando: PortoPosto }; gente: PersonaPorto[] };
/** Un tipo di missione: `testo` con {n}; `n` = [min, max] a passi di `passo`; `gruppo`: due tipi dello stesso gruppo non escono lo stesso giorno. */
export type MissioneTipoDef = { tipo: string; testo: string; n: [number, number]; passo: number; gruppo?: string; premio: Resources };
export type MissioniDef = { alGiorno: number; tipi: MissioneTipoDef[] };

export const GENTE = gente as unknown as GenteDef;
export const MISSIONI = missioni as unknown as MissioniDef;

/** Contatori che il server sa aggiornare (Lot DO): un tipo di missione fuori da qui non si potrebbe mai compiere. */
export const MISSIONE_TIPI = ['legno', 'pietra', 'cantiere', 'partite', 'medaglia', 'oro', 'dungeon', 'mercante'] as const;

/** [] se tutto ok, altrimenti errori in italiano (li chiamano i test della sim). */
export function validatePorto(): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const p of GENTE.gente) {
    if (ids.has(p.id)) errs.push(`gente: id duplicato ${p.id}`);
    ids.add(p.id);
    if (!p.battute.length) errs.push(`gente ${p.id}: nessuna battuta`);
    if (!p.giro.length) errs.push(`gente ${p.id}: giro vuoto`);
    if (p.giro.length > 1 && !(p.velocita > 0)) errs.push(`gente ${p.id}: giro senza velocità`);
  }
  if (GENTE.gente.filter((p) => p.ruolo === 'mercante').length !== 1) errs.push('gente: serve esattamente un mercante');
  if (GENTE.gente.filter((p) => p.ruolo === 'contrabbandiere').length !== 1) errs.push('gente: serve esattamente un contrabbandiere');
  const tipi = new Set<string>();
  for (const t of MISSIONI.tipi) {
    if (tipi.has(t.tipo)) errs.push(`missioni: tipo duplicato ${t.tipo}`);
    tipi.add(t.tipo);
    if (!(MISSIONE_TIPI as readonly string[]).includes(t.tipo)) errs.push(`missioni: tipo ${t.tipo} che il server non sa contare`);
    if (!(t.n[0] >= 1 && t.n[1] >= t.n[0] && t.passo >= 1)) errs.push(`missioni ${t.tipo}: n o passo non validi`);
    if (!(['legno', 'pietra', 'perle'] as const).every((k) => Number.isInteger(t.premio[k]) && t.premio[k] >= 0)) errs.push(`missioni ${t.tipo}: premio non valido`);
  }
  const gruppi = new Set(MISSIONI.tipi.map((t) => t.gruppo ?? t.tipo));
  if (gruppi.size < MISSIONI.alGiorno) errs.push(`missioni: ${gruppi.size} gruppi per ${MISSIONI.alGiorno} missioni al giorno`);
  return errs;
}
