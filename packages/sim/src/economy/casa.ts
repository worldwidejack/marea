// La casa arredabile (#265, CONTRACTS §41): mobili (mobili.json) comprati al negozio dei mobili finiscono nel magazzino di casa e si
// posano nella stanza (BORGO.stanza): quelli «a terra» su una cella del pavimento (si girano di 90°), quelli «a parete» su una cella di
// muro (in fondo `n`, a sinistra `o`, a destra `e`). Pavimenti e carte da parati (borgo.json) si comprano una volta e poi si scelgono.
// Il baule è il Forziere (edificio, livelli e capienza come prima): in casa si sposta e si gira come un mobile.
// Puro: lo usano il DO del lotto (valida e salva) e il client (sagoma verde/rossa, anteprima). Tutto sta nel LotState, campo `casa`.
import { BORGO, MOBILI } from '@marea/content';
import type { MobileDef, StanzaFinitura } from '@marea/content';
import { advance } from './advance.ts';
import { spendi } from './monete.ts';
import { livelloCasa, prossimoAmpliamento, scaleDi, stanzaAt, stanzeDi } from './stanze.ts';
import type { Stanza } from './stanze.ts';
import { inVetrina, inVetrinaFinitura } from './vetrina.ts';
import { EconomyError } from './types.ts';
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
  /** Gli ampliamenti fatti dal mobiliere (#386, economy/stanze.ts): 0..max. Assente = 0, la stanza di sempre. */
  livello?: number;
};
export type Finitura = 'pavimento' | 'carta';
/** Dove va un mobile: cella del pavimento, più il muro se è da parete. */
export type PostoMobile = { cell: [number, number]; muro?: Muro; rot?: number };
/** Le celle del pavimento che occupa un mobile a terra: `cell` è l'ancora, il resto dell'ingombro (`celle` [larghezza, profondità]) va
 *  verso +x e +z e gira con `rot` (quarti di giro, come ry = rot·90° della vista: (x,z) → (z,−x)). Interi, niente trigonometria. */
export function celleMobile(m: Pick<MobileDef, 'posto' | 'celle'>, cell: readonly [number, number], rot = 0): [number, number][] {
  const [w, d] = m.posto === 'terra' ? m.celle ?? [1, 1] : [1, 1], out: [number, number][] = [];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
    const [dx, dz] = rot === 1 ? [j, -i] : rot === 2 ? [-i, -j] : rot === 3 ? [-j, i] : [i, j];
    out.push([cell[0] + dx, cell[1] + dz]);
  }
  return out;
}

const [CX] = BORGO.stanza.corridoio;
/** Le celle di una stanza dove si passa (niente mobili a terra): dove sbuca il corridoio, quella davanti alla porta in fondo e le scale (#386). */
const passaggi = (s: Stanza, livello: number): readonly (readonly [number, number])[] => [...(s.id === 'terra' ? [[CX, s.pavimento[3] - 1] as const] : []), ...(s.retro ? [s.retro] : []), ...scaleDi(livello).filter((c) => c.stanza === s.id).map((c) => c.cell)];
/** Il livello della casa di un lotto. */
export const livelloLotto = (lot: LotState | null | undefined): number => livelloCasa(lot?.casa);

export const mobile = (id: string): MobileDef | null => MOBILI.find((m) => m.id === id) ?? null;
export const finitura = (tipo: Finitura, id: string): StanzaFinitura | null => (tipo === 'pavimento' ? BORGO.pavimenti : BORGO.carte).find((f) => f.id === id) ?? null;
export const casaDi = (lot: LotState | null | undefined): CasaState => lot?.casa ?? {};
/** Una finitura è tua: quella di serie (monete 0) o comprata. */
export function possiedeFinitura(lot: LotState | null, tipo: Finitura, id: string): boolean {
  const f = finitura(tipo, id);
  return !!f && (!(f.monete ?? 0) || (casaDi(lot).finiture ?? []).includes(id));
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
  const liv = livelloLotto(lot), stanza = Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1]) ? stanzaAt(liv, c) : null;
  if (!stanza) return { code: 'posizione', msg: 'Fuori dalla stanza' };
  const mie = celleMobile(m, c, p.rot ?? 0);
  if (!mie.every((q) => stanzaAt(liv, q)?.id === stanza.id)) return { code: 'posizione', msg: 'Non ci sta: esce dalla stanza' };
  const [X0, Z0, X1] = stanza.pavimento;
  if (m.posto === 'parete') {
    const ok = p.muro === 'n' ? c[1] === Z0 && !(stanza.retro && c[0] === stanza.retro[0]) : p.muro === 'o' ? c[0] === X0 : p.muro === 'e' ? c[0] === X1 - 1 : false;
    if (!ok) return { code: 'posizione', msg: 'Questo si appende a un muro' };
    return arredi.some((a) => a.muro === p.muro && same(a.cell, c)) ? { code: 'cella', msg: 'Su questo muro c’è già qualcosa' } : null;
  }
  if (p.muro) return { code: 'posizione', msg: 'Questo va per terra' };
  if (mie.some((q) => passaggi(stanza, liv).some((r) => same(r, q)))) return { code: 'posizione', msg: 'Qui si passa: lascia libero' };
  const occupate = (q: readonly [number, number]) => arredi.some((a) => {
    if (a.muro) return false;
    const d = mobile(a.mobile);
    return d ? celleMobile(d, a.cell, a.rot ?? 0).some((r) => same(r, q)) : same(a.cell, q);
  }) || lot.buildings.some((b) => same(b.cell, q)) || lot.decor.some((d) => same(d.cell, q));
  if (mie.some(occupate)) return { code: 'cella', msg: 'Cella occupata' };
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

/** Compra un mobile al negozio: monete spese, uno in più nel magazzino. */
export function compraMobile(lot0: LotState, id: string, nowMs: number): LotState {
  const m = mobile(id);
  if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
  const lot = spendi(advance(lot0, nowMs), m.monete), c = casaDi(lot), mag = { ...(c.magazzino ?? {}) };
  mag[id] = (mag[id] ?? 0) + 1;
  return conCasa(lot, { ...c, magazzino: mag });
}
/** Compra un mobile della vetrina di oggi (#384): il negozio vende solo quello che espone, il resto torna un altro giorno. */
export function compraMobileDelGiorno(lot0: LotState, id: string, nowMs: number): LotState {
  if (!mobile(id)) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
  if (!inVetrina(nowMs, id)) throw new EconomyError('requisito', 'Oggi non è in vendita: la vetrina cambia ogni giorno a mezzanotte');
  return compraMobile(lot0, id, nowMs);
}
/** I mobili a muro vanno col muro: se la stanza cresce, quelli sul muro che si sposta si riappendono al muro nuovo (stessa posizione di lato). */
function riancora(a: PlacedMobile, vecchie: readonly Stanza[], nuove: readonly Stanza[]): PlacedMobile {
  if (!a.muro) return a;
  const v = vecchie.find((s) => a.cell[0] >= s.pavimento[0] && a.cell[0] < s.pavimento[2] && a.cell[1] >= s.pavimento[1] && a.cell[1] < s.pavimento[3]);
  const n = v && nuove.find((s) => s.id === v.id);
  if (!v || !n) return a;
  const [x0, z0, x1] = n.pavimento;
  return { ...a, cell: a.muro === 'n' ? [a.cell[0], z0] : a.muro === 'o' ? [x0, a.cell[1]] : [x1 - 1, a.cell[1]] };
}
/** Il mobiliere ingrandisce la casa di un livello (#386): costa monete (borgo.json `casa.livelli`, #414). `da` = il livello che il giocatore
 *  vede adesso: se nel frattempo è cambiato (doppio tocco, altro dispositivo) niente si paga due volte. */
export function ampliaCasa(lot0: LotState, da: number, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), liv = livelloLotto(lot);
  if (da !== liv) throw new EconomyError('livello', 'La casa è già cambiata: guarda com’è adesso');
  const next = prossimoAmpliamento(liv);
  if (!next) throw new EconomyError('livello', 'La casa è già grande al massimo');
  const pagato = spendi(lot, next.monete), c = casaDi(pagato);
  const vecchie = stanzeDi(liv), nuove = stanzeDi(liv + 1);
  return conCasa(pagato, { ...c, livello: liv + 1, arredi: (c.arredi ?? []).map((a) => riancora(a, vecchie, nuove)) });
}
/** Compra la carta o il pavimento della vetrina di oggi (#393): come i mobili, il negozio vende solo quello che espone. Quello che hai già resta «unico». */
export function compraFinituraDelGiorno(lot0: LotState, tipo: Finitura, id: string, nowMs: number): LotState {
  if (!finitura(tipo, id)) throw new EconomyError('sconosciuto', tipo === 'pavimento' ? 'Pavimento sconosciuto' : 'Carta da parati sconosciuta');
  if (possiedeFinitura(lot0, tipo, id)) throw new EconomyError('unico', 'Ce l’hai già');
  if (!inVetrinaFinitura(nowMs, tipo, id)) throw new EconomyError('requisito', 'Oggi non è in vendita: la vetrina cambia ogni giorno a mezzanotte');
  return compraFinitura(lot0, tipo, id, nowMs);
}
/** Compra un pavimento o una carta da parati (una volta sola) e lo mette subito. */
export function compraFinitura(lot0: LotState, tipo: Finitura, id: string, nowMs: number): LotState {
  const f = finitura(tipo, id);
  if (!f) throw new EconomyError('sconosciuto', tipo === 'pavimento' ? 'Pavimento sconosciuto' : 'Carta da parati sconosciuta');
  if (possiedeFinitura(lot0, tipo, id)) throw new EconomyError('unico', 'Ce l’hai già');
  const lot = spendi(advance(lot0, nowMs), f.monete ?? 0), c = casaDi(lot);
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
  controlla(lot, m, { ...p, rot });
  const arredi = c.arredi ?? [], a: PlacedMobile = { id: `${id}-${nextN(arredi)}`, mobile: id, cell: [p.cell[0], p.cell[1]] };
  if (m.posto === 'parete') a.muro = p.muro!; else if (rot) a.rot = rot;
  const mag = { ...c.magazzino }; mag[id] = mag[id]! - 1; if (!mag[id]) delete mag[id];
  return conCasa(lot, { ...c, magazzino: mag, arredi: [...arredi, a] });
}
/** Sposta un mobile posato (stesse regole; la sua cella di adesso non conta come occupata). */
export function spostaMobile(lot0: LotState, id: string, p: PostoMobile, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), a = trova(lot, id), m = mobile(a.mobile);
  if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
  controlla(lot, m, { ...p, rot: a.rot ?? 0 }, id);
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
  const c = casaDi(lot), m = mobile(a.mobile);
  if (m) controlla(lot, m, { cell: a.cell, rot: ((a.rot ?? 0) + 1) % 4 }, id); // girato, un mobile lungo deve starci ancora
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
  controlla({ ...lot, buildings: lot.buildings.filter((x) => x.id !== b.id) }, { id: 'baule', nome: 'Baule', categoria: 'contenitori', monete: 1, posto: 'terra', forma: 'baule', colori: ['#8E5A2B'] }, { cell });
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
