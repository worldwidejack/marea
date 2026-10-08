// Missioni del giorno della Bacheca del Porto (#64). Pure e deterministiche: le tre missioni di oggi dipendono solo da giorno UTC e
// persona (createRng(`missioni:<giorno>:<persona>`)), così client e server le calcolano uguali senza salvarle. Nel LotState stanno solo
// i contatori di oggi (`missioni.prog`, li aggiorna il DO del lotto dopo le azioni che sa verificare) e gli indici già riscossi.
// Non esportato da @marea/sim (index.ts): si importa per percorso, come rpg/ e dungeon/.
import { MISSIONI } from '@marea/content/porto.ts';
import type { MissioneTipoDef } from '@marea/content/porto.ts';
import { createRng } from '../rng.ts';
import { advance } from './advance.ts';
import { EconomyError, ZERO, add } from './types.ts';
import type { LotState, MissioniState, Resources } from './types.ts';

const DAY = 86_400_000;
export const giornoDi = (nowMs: number): number => Math.floor(nowMs / DAY);
/** Millisecondi alla mezzanotte UTC (quando arrivano le missioni nuove). */
export const finoAlCambio = (nowMs: number): number => (giornoDi(nowMs) + 1) * DAY - nowMs;

export type Missione = { i: number; tipo: string; testo: string; n: number; premio: Resources };
export type MissioneStato = Missione & { fatto: number; compiuta: boolean; riscossa: boolean };
/** Eventi contati dal server: tipo di missione → quanto aggiungere. */
export type EventiMissione = Partial<Record<string, number>>;

/** Le missioni di oggi per una persona: `alGiorno` tipi diversi (mai due dello stesso `gruppo`), quantità a passi di `passo`. */
export function missioniDelGiorno(owner: string, day: number): Missione[] {
  const rng = createRng(`missioni:${day}:${owner}`);
  const pool: MissioneTipoDef[] = [...MISSIONI.tipi];
  const out: Missione[] = [];
  const gruppi = new Set<string>();
  while (out.length < MISSIONI.alGiorno && pool.length) {
    const k = rng.int(0, pool.length - 1);
    const t = pool.splice(k, 1)[0]!;
    const g = t.gruppo ?? t.tipo;
    if (gruppi.has(g)) continue;
    gruppi.add(g);
    const passi = Math.floor((t.n[1] - t.n[0]) / t.passo);
    const n = t.n[0] + rng.int(0, passi) * t.passo;
    out.push({ i: out.length, tipo: t.tipo, testo: t.testo.replace('{n}', String(n)), n, premio: { ...ZERO, ...t.premio } });
  }
  return out;
}

const VUOTO: MissioniState = { day: 0, prog: {}, riscosse: [] };
/** Stato delle missioni del lotto, azzerato se è cambiato il giorno UTC. */
export function missioniState(lot: LotState, nowMs: number): MissioniState {
  const s = lot.missioni ?? VUOTO, day = giornoDi(nowMs);
  return s.day === day ? s : { day, prog: {}, riscosse: [] };
}

/** Le tre missioni di oggi col progresso (per la Bacheca). */
export function missioniOf(lot: LotState, nowMs: number): { day: number; list: MissioneStato[] } {
  const s = missioniState(lot, nowMs);
  const list = missioniDelGiorno(lot.owner, s.day).map((m) => {
    const fatto = Math.min(m.n, Math.max(0, Math.floor(s.prog[m.tipo] ?? 0)));
    return { ...m, fatto, compiuta: fatto >= m.n, riscossa: s.riscosse.includes(m.i) };
  });
  return { day: s.day, list };
}

/** Aggiunge eventi ai contatori di oggi (solo valori interi > 0). Non tocca risorse né versione: va insieme all'azione che li ha causati. */
export function tracciaMissioni(lot: LotState, eventi: EventiMissione, nowMs: number): LotState {
  const s = missioniState(lot, nowMs);
  let changed = false;
  const prog = { ...s.prog };
  for (const [k, v] of Object.entries(eventi)) {
    const n = Math.floor(v ?? 0);
    if (n <= 0) continue;
    prog[k] = (prog[k] ?? 0) + n;
    changed = true;
  }
  return changed ? { ...lot, missioni: { day: s.day, prog, riscosse: s.riscosse } } : lot;
}

/** Eventi di una partita da solo: una partita, e la medaglia se c'è. */
export function eventiPartita(medal: 'oro' | 'argento' | 'bronzo' | null): EventiMissione {
  return { partite: 1, medaglia: medal ? 1 : 0, oro: medal === 'oro' ? 1 : 0 };
}

/** Eventi di una raccolta: quanto Legno e Pietra sono entrati davvero nel Magazzino (dal libro mastro). */
export function eventiRaccolta(prima: LotState, dopo: LotState): EventiMissione {
  return { legno: dopo.ledger.generated.legno - prima.ledger.generated.legno, pietra: dopo.ledger.generated.pietra - prima.ledger.generated.pietra };
}

/** RISCUOTI: missione compiuta e non ancora riscossa → premio nel lotto (e nel libro mastro). */
export function riscuotiMissione(lot0: LotState, i: number, nowMs: number): { lot: LotState; premio: Resources; missione: MissioneStato } {
  const { list } = missioniOf(lot0, nowMs);
  const m = list.find((x) => x.i === i);
  if (!m) throw new EconomyError('sconosciuto', 'Missione sconosciuta');
  if (m.riscossa) throw new EconomyError('missione', 'Premio già riscosso: torna domani per missioni nuove');
  if (!m.compiuta) throw new EconomyError('missione', `Non ancora: ${m.fatto} su ${m.n}`);
  const lot = advance(lot0, nowMs), s = missioniState(lot0, nowMs);
  return {
    premio: m.premio,
    missione: { ...m, riscossa: true },
    lot: {
      ...lot,
      version: lot.version + 1,
      resources: add(lot.resources, m.premio),
      ledger: { ...lot.ledger, generated: add(lot.ledger.generated, m.premio) },
      missioni: { day: s.day, prog: s.prog, riscosse: [...s.riscosse, i] },
    },
  };
}
