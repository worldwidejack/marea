// La casa arredabile (#265, CONTRACTS §41): mobili (mobili.json) comprati al negozio dei mobili finiscono nel magazzino di casa e si
// posano nella stanza (BORGO.stanza): quelli «a terra» su una cella del pavimento (si girano di 90°), quelli «a parete» su una cella di
// muro (in fondo `n`, a sinistra `o`, a destra `e`). Pavimenti e carte da parati (borgo.json) si comprano una volta e poi si scelgono.
// Il baule è il Forziere (edificio, livelli e capienza come prima): in casa si sposta e si gira come un mobile.
// Puro: lo usano il DO del lotto (valida e salva) e il client (sagoma verde/rossa, anteprima). Tutto sta nel LotState, campo `casa`.
import { BORGO, MOBILI } from '@marea/content';
import type { MobileDef, StanzaFinitura } from '@marea/content';
import { advance } from './advance.ts';
import { pay } from './actions.ts';
import { inStanza } from './cells.ts';
import { EconomyError, ZERO } from './types.ts';
import type { LotState, PlacedBuilding } from './types.ts';

export type Muro = 'n' | 'o' | 'e';
/** Un mobile posato: `cell` del pavimento (a parete: la cella del pavimento lungo quel muro), `rot` quarti di giro (solo a terra). */
export type PlacedMobile = { id: string; mobile: string; cell: [number, number]; muro?: Muro; rot?: number };
export type CasaState = {
  /** Mobili comprati e non posati: id → quanti. */
  magazzino?: Record<string, number>;
  arredi?: PlacedMobile[];
  /** Pavimenti e carte comprati (id di borgo.json); quelli di serie sono di tutti. */
  finiture?: string[];
  /** Scelti (assente = quello di serie, il primo). */
  pavimento?: string; carta?: string;
  /** Quarti di giro del baule (Forziere) in casa. */
  bauleRot?: number;
};
export type Finitura = 'pavimento' | 'carta';
/** Dove va un mobile: cella del pavimento, più il muro se è da parete. */
export type PostoMobile = { cell: [number, number]; muro?: Muro };

const ST = BORGO.stanza, [X0, Z0, X1, Z1] = ST.pavimento, [CX] = ST.corridoio;
/** La cella del pavimento dove sbuca il corridoio e quella davanti alla porta in fondo: passaggi, niente mobili a terra. */
const PASSAGGI: readonly (readonly [number, number])[] = [[CX, Z1 - 1], [ST.retro[0], ST.retro[1]]];

export const mobile = (id: string): MobileDef | null => MOBILI.find((m) => m.id === id) ?? null;
export const finitura = (tipo: Finitura, id: string): StanzaFinitura | null => (tipo === 'pavimento' ? BORGO.pavimenti : BORGO.carte).find((f) => f.id === id) ?? null;
export const casaDi = (lot: LotState | null | undefined): CasaState => lot?.casa ?? {};
/** Una finitura è tua: quella di serie (perle 0) o comprata. */
export function possiedeFinitura(lot: LotState | null, tipo: Finitura, id: string): boolean {
  const f = finitura(tipo, id);
  return !!f && (!(f.perle ?? 0) || (casaDi(lot).finiture ?? []).includes(id));
}
/** Pavimento e carta scelti (id), quelli di serie se non hai scelto o non esistono più. */
export function finitureScelte(lot: LotState | null): { pavimento: string; carta: string } {
  const c = casaDi(lot);
  return { pavimento: finitura('pavimento', c.pavimento ?? '') ? c.pavimento! : BORGO.pavimenti[0]!.id, carta: finitura('carta', c.carta ?? '') ? c.carta! : BORGO.carte[0]!.id };
}

const same = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] === b[0] && a[1] === b[1];
/** Il Forziere (il baule) di questo lotto, se è costruito. */
export const baule = (lot: LotState): PlacedBuilding | null => lot.buildings.find((b) => b.building === 'forziere') ?? null;

/** Perché un mobile non può stare lì (null = va bene). `senza` = id di un mobile da non contare (quello che sposti). */
export function postoMobileError(lot: LotState, m: MobileDef, p: PostoMobile, senza: string | null = null): { code: 'posizione' | 'cella'; msg: string } | null {
  const c = p.cell, arredi = (casaDi(lot).arredi ?? []).filter((a) => a.id !== senza);
  if (!Array.isArray(c) || !Number.isInteger(c[0]) || !Number.isInteger(c[1]) || !inStanza(c)) return { code: 'posizione', msg: 'Fuori dalla stanza' };
  if (m.posto === 'parete') {
    const ok = p.muro === 'n' ? c[1] === Z0 && c[0] !== ST.retro[0] : p.muro === 'o' ? c[0] === X0 : p.muro === 'e' ? c[0] === X1 - 1 : false;
    if (!ok) return { code: 'posizione', msg: 'Questo si appende a un muro' };
    return arredi.some((a) => a.muro === p.muro && same(a.cell, c)) ? { code: 'cella', msg: 'Su questo muro c’è già qualcosa' } : null;
  }
  if (p.muro) return { code: 'posizione', msg: 'Questo va per terra' };
  if (PASSAGGI.some((q) => same(q, c))) return { code: 'posizione', msg: 'Qui si passa: lascia libero' };
  if (arredi.some((a) => !a.muro && same(a.cell, c)) || lot.buildings.some((b) => same(b.cell, c)) || lot.decor.some((d) => same(d.cell, c))) return { code: 'cella', msg: 'Cella occupata' };
  return null;
}

const conCasa = (lot: LotState, casa: CasaState): LotState => ({ ...lot, version: lot.version + 1, casa });
const nextN = (arredi: readonly PlacedMobile[]): number => {
  let n = arredi.length;
  for (const a of arredi) { const k = Number(a.id.slice(a.id.lastIndexOf('-') + 1)); if (Number.isInteger(k) && k > n) n = k; }
  return n + 1;
};
const trova = (lot: LotState, id: string): PlacedMobile => {
  const a = (casaDi(lot).arredi ?? []).find((x) => x.id === id);
  if (!a) throw new EconomyError('sconosciuto', 'Mobile non trovato');
  return a;
};
const controlla = (lot: LotState, m: MobileDef, p: PostoMobile, senza: string | null = null) => {
  const bad = postoMobileError(lot, m, p, senza);
  if (bad) throw new EconomyError(bad.code, bad.msg);
};

/** Compra un mobile al negozio: Perle spese, uno in più nel magazzino. */
export function compraMobile(lot0: LotState, id: string, nowMs: number): LotState {
  const m = mobile(id);
  if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
  const lot = pay(advance(lot0, nowMs), { ...ZERO, perle: m.perle }), c = casaDi(lot), mag = { ...(c.magazzino ?? {}) };
  mag[id] = (mag[id] ?? 0) + 1;
  return conCasa(lot, { ...c, magazzino: mag });
}
/** Compra un pavimento o una carta da parati (una volta sola) e lo mette subito. */
export function compraFinitura(lot0: LotState, tipo: Finitura, id: string, nowMs: number): LotState {
  const f = finitura(tipo, id);
  if (!f) throw new EconomyError('sconosciuto', tipo === 'pavimento' ? 'Pavimento sconosciuto' : 'Carta da parati sconosciuta');
  if (possiedeFinitura(lot0, tipo, id)) throw new EconomyError('unico', 'Ce l’hai già');
  const lot = pay(advance(lot0, nowMs), { ...ZERO, perle: f.perle ?? 0 }), c = casaDi(lot);
  return conCasa(lot, { ...c, finiture: [...(c.finiture ?? []), id], [tipo]: id });
}
/** Mette un pavimento o una carta che hai già. */
export function scegliFinitura(lot0: LotState, tipo: Finitura, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (!possiedeFinitura(lot, tipo, id)) throw new EconomyError(finitura(tipo, id) ? 'requisito' : 'sconosciuto', 'Prima compralo al negozio dei mobili');
  return conCasa(lot, { ...casaDi(lot), [tipo]: id });
}
/** Posa un mobile del magazzino nella stanza. */
export function posaMobile(lot0: LotState, id: string, p: PostoMobile, rot: number, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), m = mobile(id), c = casaDi(lot);
  if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
  if (!((c.magazzino ?? {})[id]! > 0)) throw new EconomyError('requisito', 'Non ce l’hai nel magazzino');
  if (!Number.isInteger(rot) || rot < 0 || rot > 3) throw new EconomyError('posizione', 'Rotazione non valida (0-3)');
  controlla(lot, m, p);
  const arredi = c.arredi ?? [], a: PlacedMobile = { id: `${id}-${nextN(arredi)}`, mobile: id, cell: [p.cell[0], p.cell[1]] };
  if (m.posto === 'parete') a.muro = p.muro!; else if (rot) a.rot = rot;
  const mag = { ...c.magazzino }; mag[id] = mag[id]! - 1; if (!mag[id]) delete mag[id];
  return conCasa(lot, { ...c, magazzino: mag, arredi: [...arredi, a] });
}
/** Sposta un mobile posato (stesse regole; la sua cella di adesso non conta come occupata). */
export function spostaMobile(lot0: LotState, id: string, p: PostoMobile, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), a = trova(lot, id), m = mobile(a.mobile);
  if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
  controlla(lot, m, p, id);
  const c = casaDi(lot);
  return conCasa(lot, { ...c, arredi: (c.arredi ?? []).map((x) => {
    if (x.id !== id) return x;
    const y: PlacedMobile = { id: x.id, mobile: x.mobile, cell: [p.cell[0], p.cell[1]] };
    if (m.posto === 'parete') y.muro = p.muro!; else if (x.rot) y.rot = x.rot;
    return y;
  }) });
}
/** Gira di 90° un mobile a terra (0 → 1 → 2 → 3 → 0). */
export function ruotaMobile(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), a = trova(lot, id);
  if (a.muro) throw new EconomyError('posizione', 'Quelli a parete non si girano');
  const c = casaDi(lot);
  return conCasa(lot, { ...c, arredi: (c.arredi ?? []).map((x) => {
    if (x.id !== id) return x;
    const rot = ((x.rot ?? 0) + 1) % 4, y: PlacedMobile = { id: x.id, mobile: x.mobile, cell: x.cell };
    if (rot) y.rot = rot;
    return y;
  }) });
}
/** Rimette un mobile nel magazzino. */
export function ritiraMobile(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), a = trova(lot, id), c = casaDi(lot), mag = { ...(c.magazzino ?? {}) };
  mag[a.mobile] = (mag[a.mobile] ?? 0) + 1;
  return conCasa(lot, { ...c, magazzino: mag, arredi: (c.arredi ?? []).filter((x) => x.id !== id) });
}
/** Sposta il baule (il Forziere) su un'altra cella del pavimento della stanza. */
export function spostaBaule(lot0: LotState, cell: [number, number], nowMs: number): LotState {
  const lot = advance(lot0, nowMs), b = baule(lot);
  if (!b) throw new EconomyError('sconosciuto', 'Il baule non c’è ancora: costruisci il Forziere');
  if (same(b.cell, cell)) return lot;
  controlla({ ...lot, buildings: lot.buildings.filter((x) => x.id !== b.id) }, { id: 'baule', nome: 'Baule', perle: 1, posto: 'terra', forma: 'baule', colori: ['#8E5A2B'] }, { cell });
  return { ...lot, version: lot.version + 1, buildings: lot.buildings.map((x) => (x.id === b.id ? { ...x, cell: [cell[0], cell[1]] } : x)) };
}
/** Gira il baule di 90°. */
export function ruotaBaule(lot0: LotState, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (!baule(lot)) throw new EconomyError('sconosciuto', 'Il baule non c’è ancora: costruisci il Forziere');
  const c = casaDi(lot), rot = ((c.bauleRot ?? 0) + 1) % 4, out: CasaState = { ...c };
  if (rot) out.bauleRot = rot; else delete out.bauleRot;
  return conCasa(lot, out);
}
