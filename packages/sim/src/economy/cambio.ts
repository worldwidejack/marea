// I salvataggi di prima diventano quelli di oggi (VISIONE §2, GDD §5). Lo fa il server in lettura (DO Lot, `aggiornaSalvataggio`), una
// volta sola: un lotto di oggi torna identico. Due passi.
// 1) `convertiMonete` (un lotto senza `monete`): diventano monete, al cambio fisso di `BALANCE.monete.cambio`,
//    - le risorse di prima (Legno, Pietra, Perle) del lotto;
//    - gli edifici spenti del giardino (le chiavi di `BALANCE.monete.edifici`): quanto erano costati i loro livelli (anche il cantiere in
//      corso, già pagato) e il deposito di Legno o Pietra non ancora raccolto;
//    - le monete del personaggio (`hero.monete`, il portafoglio del GDR di prima; senza personaggio quelle con cui sarebbe nato).
//    Chi ha comprato tiene tutto (mobili, finiture, cappelli, colori della barca, decorazioni, ampliamenti, equipaggiamento).
// 2) `senzaGiardino` (un lotto con `buildings`): quello che resta degli edifici diventa un campo suo. Il Molo → il livello della barca
//    (`barca`), il Banco da Lavoro → il livello col Fabbro (`botteghe.fabbro`), il Forziere → il baule di casa (`casa.baule`, col suo livello;
//    se stava in giardino, in casa nella prima cella libera). Il Tavolo Alchemico non serve più (l'Alchimista non ha livelli). Via risorse,
//    edifici, cantiere, poste delle sfide, Faro e libro mastro di prima. Poi le decorazioni del giardino nel magazzino (`decorInCasa`) e il
//    baule di serie a chi non l'ha (`conBaule`). Pura.
import { BALANCE } from '@marea/content';
import type { MobileDef } from '@marea/content';
import { conBaule, postoMobileError } from './casa.ts';
import type { CasaState } from './casa.ts';
import { decorInCasa } from './decorazioni.ts';
import { inMonete } from './monete.ts';
import { livelloCasa, stanzaAt } from './stanze.ts';
import type { CambioMonete, LotState, Resources } from './types.ts';

/** Un edificio del giardino di prima (posato o riposto nel magazzino dell'isola). */
type EdificioVecchio = { id: string; building: string; level: number; cell?: [number, number]; buffer?: number };
/** Un salvataggio di prima: quello di oggi più i campi del giardino, e senza `monete` se non è ancora convertito. */
export type LottoDiPrima = Omit<LotState, 'monete'> & {
  monete?: number;
  resources?: Resources;
  buildings?: EdificioVecchio[];
  magazzinoEdifici?: EdificioVecchio[];
  construction?: { building: string; level: number } | null;
  escrow?: Resources;
  boostUntilMs?: number;
  finito?: unknown;
  /** Sfide con posta e Faro comune di prima (codice tolto da tempo): restavano nei salvataggi. */
  challenges?: unknown; holds?: unknown; settled?: unknown; faro?: unknown;
  ledger: LotState['ledger'] & { generated?: Resources; spent?: Resources };
  hero?: LotState['hero'] & { monete?: number };
};

const ZERO: Resources = { legno: 0, pietra: 0, perle: 0 };
const add = (a: Resources, b: Partial<Resources>): Resources => ({ legno: a.legno + (b.legno ?? 0), pietra: a.pietra + (b.pietra ?? 0), perle: a.perle + (b.perle ?? 0) });
const EDIFICI = BALANCE.monete.edifici;
/** Il baule come mobile a terra di una cella (per vedere se la cella del Forziere di prima è ancora libera). */
const BAULE: MobileDef = { id: 'baule', nome: 'Baule', categoria: 'contenitori', monete: 1, posto: 'terra', colori: [] };

/** Edifici del giardino che diventano monete; gli altri (Molo, Banco, Tavolo Alchemico, Forziere) diventano barca, Fabbro e baule. */
export const EDIFICI_SPENTI: ReadonlySet<string> = new Set(Object.keys(EDIFICI));

/** Quanto è costato un edificio spento fino al livello `livello` (somma dei livelli 1..livello). */
export function costoEdificio(id: string, livello: number): Resources {
  let r: Resources = { ...ZERO };
  for (const l of EDIFICI[id]?.livelli.slice(0, Math.max(0, livello)) ?? []) r = add(r, l);
  return r;
}

/** Valore di un edificio spento: i livelli pagati più il deposito di Legno o Pietra non raccolto (la Serra teneva ingredienti: non conta). */
function valore(b: EdificioVecchio): Resources {
  const r = costoEdificio(b.building, b.level), res = EDIFICI[b.building]?.produce, dep = Math.max(0, Math.floor(b.buffer || 0));
  return res ? { ...r, [res]: r[res] + dep } : r;
}

/** Converte un salvataggio di prima del 18 ott 2026 (nessun `monete`); un lotto già convertito torna identico. */
export function convertiMonete(lot: LottoDiPrima): LottoDiPrima & { monete: number } {
  if (typeof lot.monete === 'number') return lot as LottoDiPrima & { monete: number };
  let edifici: Resources = { ...ZERO };
  const spenti: string[] = [], resta: EdificioVecchio[] = [];
  for (const b of [...(lot.buildings ?? []), ...(lot.magazzinoEdifici ?? [])]) {
    if (EDIFICI_SPENTI.has(b.building)) { edifici = add(edifici, valore(b)); spenti.push(b.building); } else resta.push(b);
  }
  // il cantiere di un edificio spento era già pagato: vale il livello che stava costruendo
  const c = lot.construction;
  if (c && EDIFICI_SPENTI.has(c.building)) edifici = add(edifici, EDIFICI[c.building]?.livelli[c.level - 1] ?? {});
  const eroe = lot.hero ? Math.max(0, Math.floor(lot.hero.monete ?? 0)) : BALANCE.monete.partenza;
  const risorse: Resources = { ...ZERO, ...lot.resources };
  const monete = inMonete(risorse) + inMonete(edifici) + eroe;
  const cambio: CambioMonete = { ms: lot.nowMs, monete, risorse, edifici, edificiSpenti: [...new Set(spenti)].sort(), eroe };
  let hero = lot.hero;
  if (hero && 'monete' in hero) { const { monete: _vecchie, ...h } = hero; hero = h; }
  return {
    ...lot, version: lot.version + 1, monete, cambio, buildings: resta, magazzinoEdifici: [], construction: null, resources: { ...ZERO },
    ledger: { ...lot.ledger, monete: { generated: monete, spent: 0 } },
    ...(hero ? { hero } : {}),
  };
}

/** Il livello più alto di un edificio fra quelli posati e riposti (0 = non c'è). */
const livelloDi = (lot: LottoDiPrima, id: string): number => Math.max(0, ...[...(lot.buildings ?? []), ...(lot.magazzinoEdifici ?? [])].filter((b) => b.building === id).map((b) => b.level));

const VECCHI = ['resources', 'buildings', 'magazzinoEdifici', 'construction', 'escrow', 'boostUntilMs', 'finito', 'challenges', 'holds', 'settled', 'faro'];
/** Toglie il giardino da un lotto già in monete: Molo, Banco e Forziere diventano barca, Fabbro e baule. Un lotto di oggi torna identico. */
export function senzaGiardino(vecchio: LottoDiPrima & { monete: number }): LotState {
  if (!VECCHI.some((k) => k in vecchio)
    && !('generated' in vecchio.ledger) && !('spent' in vecchio.ledger)) return vecchio as LotState;
  const { resources: _r, buildings: _b, magazzinoEdifici: _m, construction: _c, escrow: _e, boostUntilMs: _f, finito: _x, challenges: _s, holds: _h, settled: _t, faro: _fc, ledger, ...resto } = vecchio;
  const lot: LotState = { ...resto, version: vecchio.version + 1, ledger: ledger.monete ? { monete: ledger.monete } : {} };
  const molo = livelloDi(vecchio, 'molo'), banco = livelloDi(vecchio, 'banco');
  if (molo > 1) lot.barca = Math.max(lot.barca ?? 1, molo);
  if (banco > (lot.botteghe?.fabbro ?? 1)) lot.botteghe = { ...lot.botteghe, fabbro: banco };
  const forziere = [...(vecchio.buildings ?? []), ...(vecchio.magazzinoEdifici ?? [])].filter((b) => b.building === 'forziere' && b.level >= 1).sort((a, b) => b.level - a.level)[0];
  if (forziere && !lot.casa?.baule) {
    // il Forziere che stava già in casa resta dov'era; quello del giardino va nella prima cella libera (la mette conBaule, col suo livello)
    const inCasa = !!forziere.cell && !!stanzaAt(livelloCasa(lot.casa), forziere.cell) && !postoMobileError(lot, BAULE, { cell: forziere.cell });
    const casa: CasaState = lot.casa ?? {};
    if (inCasa) lot.casa = { ...casa, baule: { livello: forziere.level, cell: [forziere.cell![0], forziere.cell![1]] } };
    else { const conB = conBaule(lot); if (conB.casa?.baule) lot.casa = { ...conB.casa, baule: { ...conB.casa.baule, livello: forziere.level } }; }
  }
  return lot;
}

/** Un salvataggio qualunque (di prima o di oggi) come quello di oggi: monete, niente giardino, decorazioni in casa, baule. */
export function aggiornaSalvataggio(lot: LotState | LottoDiPrima): LotState {
  return conBaule(decorInCasa(senzaGiardino(convertiMonete(lot as LottoDiPrima))));
}
