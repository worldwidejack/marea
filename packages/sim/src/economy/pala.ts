// La pala di Borgo Marea (#438): celle scavabili del Borgo (isola `porto`), bottino giornaliero (10-200 monete, sparisce solo per chi lo
// scava) e tipi delle buche condivise. Puro e deterministico; non importa il catalogo GDR così può stare anche fuori dal chunk GDR.
import { BORGO, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { GENTE } from '@marea/content/porto.ts';
import { INSETTI_CFG } from '@marea/content/insetti.ts';
import { BOTTEGHE, BOTTEGHE_IDS } from '@marea/content/botteghe.ts';
import { hashJson } from '../hash.ts';
import { createRng } from '../rng.ts';
import { advance } from './advance.ts';
import { giornoRoma } from './giorno.ts';
import { guadagna } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

/** Cosa c'è seppellito in una buca di Borgo Marea: un oggetto dello zaino, un mobile non posato o monete. */
export type BucaDono =
  | { tipo: 'oggetto'; id: string; n: number }
  | { tipo: 'mobile'; id: string; n: number }
  | { tipo: 'monete'; monete: number };

export type BucaStato = 'aperta' | 'seppellita';
/** Una buca nel terreno di Borgo Marea (coordinate cella locale `[cx, cz]` del template `porto`). */
export type BucaBorgo = { cell: [number, number]; stato: BucaStato; chi: string; quando: number; dono?: BucaDono };

/** Chiave testuale `"cx,cz"` di una cella del Borgo. */
export function cellKeyBorgo(cell: readonly [number, number]): string {
  return `${cell[0]},${cell[1]}`;
}

/** true se il personaggio possiede la pala nello zaino. */
export function possiedePala(lot: LotState | null | undefined): boolean {
  return (lot?.hero?.inv['pala'] ?? 0) >= 1;
}

let _scavabili: [number, number][] | null = null;
let _scavabiliSet: Set<string> | null = null;

function calcolaScavabili(): { list: [number, number][]; set: Set<string> } {
  const isl = ISLANDS.find((i) => i.id === 'porto');
  const list: [number, number][] = [];
  const set = new Set<string>();
  if (!isl) return { list, set };
  const h = isl.rows.length, w = isl.rows[0]?.length ?? 0;
  const vicino = (cx: number, cz: number, ax: number, az: number, r2: number): boolean => {
    const dx = cx - ax, dz = cz - az;
    return dx * dx + dz * dz <= r2;
  };
  const occupata = (cx: number, cz: number): boolean => {
    for (const s of isl.slots ?? []) if (vicino(cx, cz, s.at[0], s.at[1], 1.1)) return true;
    for (const c of BORGO.case) if (vicino(cx, cz, c.at[0], c.at[1], 1.1) || vicino(cx, cz, c.porta[0], c.porta[1], 1.1)) return true;
    if (vicino(cx, cz, BORGO.negozio.at[0], BORGO.negozio.at[1], 3.2) || vicino(cx, cz, BORGO.negozio.porta[0], BORGO.negozio.porta[1], 1.5)) return true;
    for (const s of INSETTI_CFG.sassi.celle) if (vicino(cx, cz, s[0], s[1], 1.1)) return true; // i sassi degli insetti (#445)
    for (const p of Object.values(GENTE.posti)) if (vicino(cx, cz, p.at[0], p.at[1], 1.5) || vicino(cx, cz, p.fronte[0], p.fronte[1], 1.1)) return true;
    // le botteghe del Borgo (#414): la casetta (col Cantiere un po' più larga) e il posto davanti al banco
    for (const id of BOTTEGHE_IDS) { const p = BOTTEGHE[id].posto; if (p && (vicino(cx, cz, p.at[0], p.at[1], 6.5) || vicino(cx, cz, p.fronte[0], p.fronte[1], 1.5))) return true; }
    for (const n of GENTE.gente) if (n.giro.length === 1 && n.giro[0] && vicino(cx, cz, n.giro[0][0], n.giro[0][1], 1.1)) return true;
    const pc = MINIGAMES_CFG.consegne.posti['porto'], pi = MINIGAMES_CFG.ingorgo.posti['porto'];
    if (pc && vicino(cx, cz, pc[0], pc[1], 1.1)) return true;
    if (pi && vicino(cx, cz, pi[0], pi[1], 1.1)) return true;
    for (const pr of isl.props ?? []) {
      const r2 = pr.k === 'fontana' ? 3.2 : pr.k === 'filo_borgo' ? 0 : 0.85;
      if (r2 > 0 && vicino(cx, cz, pr.at[0], pr.at[1], r2)) return true;
    }
    return false;
  };
  for (let cz = 1; cz < h - 1; cz++) {
    const row = isl.rows[cz] ?? '';
    for (let cx = 1; cx < w - 1; cx++) {
      const ch = row[cx];
      if (ch !== '.' && ch !== 'g') continue;
      let libere = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nb = isl.rows[cz + dz]?.[cx + dx] ?? '~';
        if (nb === '.' || nb === 'g' || nb === 'd' || nb === 'P') libere++;
      }
      if (libere < 2 || occupata(cx, cz)) continue;
      list.push([cx, cz]);
      set.add(`${cx},${cz}`);
    }
  }
  return { list, set };
}

/** Tutte le celle `[cx, cz]` del template `porto` (Borgo Marea) in cui si può scavare una buca. */
export function celleScavabiliBorgo(): readonly [number, number][] {
  if (!_scavabili) { const c = calcolaScavabili(); _scavabili = c.list; _scavabiliSet = c.set; }
  return _scavabili;
}

/** true se la cella `[cx, cz]` del template `porto` è scavabile con la pala. */
export function isCellaScavabileBorgo(cell: readonly [number, number]): boolean {
  if (!Number.isInteger(cell[0]) || !Number.isInteger(cell[1])) return false;
  if (!_scavabiliSet) { const c = calcolaScavabili(); _scavabili = c.list; _scavabiliSet = c.set; }
  return _scavabiliSet.has(`${cell[0]},${cell[1]}`);
}

/** Bottino seppellito del giorno (data di Roma): cella casuale di Borgo Marea e monete tra `BORGO.pala.bottino[0]` e `[1]` (10-200). */
export function bottinoDelGiorno(nowMs: number): { giorno: number; cell: [number, number]; monete: number } {
  const giorno = giornoRoma(nowMs);
  const celle = celleScavabiliBorgo();
  const rng = createRng(hashJson(['bottino_borgo_v1', giorno]));
  const c = celle.length ? celle[rng.int(0, celle.length - 1)]! : [44, 42] as const;
  const [min, max] = BORGO.pala.bottino;
  const monete = rng.int(min, max);
  return { giorno, cell: [c[0], c[1]], monete };
}

/** true se questo giocatore ha già scavato il bottino giornaliero di oggi. */
export function bottinoRiscossoOggi(lot: LotState | null | undefined, nowMs: number): boolean {
  return !!lot && lot.bottinoGiorno === giornoRoma(nowMs);
}

/** Scava il bottino giornaliero per questo lotto: dà le monete e segna `bottinoGiorno = giornoRoma(nowMs)` (per gli altri giocatori resta). */
export function riscuotiBottino(lot0: LotState, nowMs: number): { lot: LotState; monete: number; cell: [number, number] } {
  const lot = advance(lot0, nowMs);
  if (!possiedePala(lot)) throw new EconomyError('oggetto', 'Serve la pala');
  const b = bottinoDelGiorno(nowMs);
  if (lot.bottinoGiorno === b.giorno) throw new EconomyError('unico', 'Hai già scavato il bottino di oggi');
  const pagato = guadagna(lot, b.monete);
  return { lot: { ...pagato, version: lot.version + 1, bottinoGiorno: b.giorno }, monete: b.monete, cell: b.cell };
}
