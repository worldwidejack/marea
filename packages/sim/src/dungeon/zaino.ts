// Zaino nel dungeon (dungeon v5, docs/RPG.md §4): azioni dal menu registrate col tick e rigiocate dal server (DungeonAzioni).
// equip = cambia equipaggiamento, anche con quello raccolto qui: RunHero si rifà da `stato` (il personaggio all'entrata) con lo zaino di
// adesso · butta = via dallo zaino, prima quello raccolto qui e poi quello portato da casa. Consumi (pozioni, frecce, armi rotte): prima
// quello portato da casa (usati / rotti, li toglie il server a fine spedizione), poi quello raccolto qui (esce dal bottino).
// Pura e deterministica (regola di dungeon/types.ts).
import { buildRunHero } from '../rpg/derived.ts';
import { equipError } from '../rpg/bag.ts';
import { EQUIP_SLOTS } from '../rpg/types.ts';
import type { EquipSlot, HeroState } from '../rpg/types.ts';
import type { DungeonEvent } from './types.ts';
import type { Bag, DungeonState } from './state.ts';
import { add } from './state.ts';

function togli(bag: Bag, id: string, n: number): void {
  const left = (bag[id] ?? 0) - n;
  if (left > 0) bag[id] = left; else delete bag[id];
}

/** Quanti `id` portati da casa restano (né usati, né rotti, né buttati); 0 senza `stato`. */
export function daCasa(s: DungeonState, id: string): number {
  if (!s.stato) return 0;
  return Math.max(0, (s.stato.inv[id] ?? 0) - (s.usati[id] ?? 0) - (s.rotti[id] ?? 0) - (s.buttati[id] ?? 0));
}

/** Zaino di adesso: quello portato da casa meno usati, rotti e buttati, più il bottino raccolto qui. */
export function invNow(s: DungeonState): Bag {
  const out: Bag = {};
  for (const id of [...new Set([...Object.keys(s.stato?.inv ?? {}), ...Object.keys(s.bottino)])].sort()) {
    const n = daCasa(s, id) + (s.bottino[id] ?? 0);
    if (n > 0) out[id] = n;
  }
  return out;
}

/** Il personaggio com'è adesso nel dungeon (per la scheda: zaino, equipaggiamento, monete); null senza `stato`. */
export function heroNow(s: DungeonState): HeroState | null {
  if (!s.stato) return null;
  return { ...s.stato, inv: invNow(s), equip: { ...s.equip }, usura: { ...s.stato.usura, ...s.usura }, monete: s.stato.monete + s.monete };
}

/** Consuma un oggetto (pozione bevuta, freccia tirata, arma rotta): prima quelli portati da casa, contati in `into` (usati o rotti), poi
 *  quelli raccolti qui, che escono dal bottino. Senza `stato` sempre in `into`, come fino al v4. */
export function consuma(s: DungeonState, id: string, into: Bag): void {
  if (s.stato && daCasa(s, id) <= 0 && (s.bottino[id] ?? 0) > 0) { togli(s.bottino, id, 1); return; }
  add(into, id, 1);
}

/** RunHero rifatto da `stato` con lo zaino e l'equipaggiamento di adesso. `carico` e `pesi` restano quelli dell'entrata (il peso lo conta
 *  pesoZaino dallo zaino di adesso). Le barre restano dove sono, tagliate ai massimi nuovi; frecce e pozioni pronte = quelle nello zaino.
 *  Cambiando arma l'azione in corso (colpo, carica, arco teso) si interrompe. */
export function rebuild(s: DungeonState): void {
  const st = s.stato;
  if (!st) return;
  const h = s.hero, old = s.runHero;
  const rh = buildRunHero({ ...st, inv: invNow(s), equip: s.equip, usura: { ...st.usura, ...s.usura } });
  s.runHero = { ...rh, carico: old.carico, pesi: old.pesi };
  h.vita = Math.min(h.vita, rh.max.vita); h.magicka = Math.min(h.magicka, rh.max.magicka); h.stamina = Math.min(h.stamina, rh.max.stamina);
  const cambia = h.arma.id !== rh.arma.id || h.arma.kind !== rh.arma.kind;
  h.arma = { ...rh.arma, traits: { ...rh.arma.traits } };
  if (cambia) {
    h.colpiFragile = rh.arma.usura ?? 0;
    // unici del Mausoleo: l'arma nuova parte carica (pressione, molle) e senza ritmo
    h.pressione = rh.arma.traits.lame?.cariche ?? 0; h.molla = rh.arma.traits.carillon?.colpi ?? 0; h.mollaT = 0; h.ritmo = 0; h.tic = -1; h.rintocco = false;
    if (h.act === 'press' || h.act === 'carica' || h.act === 'swing' || h.act === 'tende') {
      h.act = 'idle'; h.actT = 0; h.actDur = 0; h.carica = 0; h.caricato = false; h.colpiti = []; h.colpito = false;
    }
  }
  h.frecce = rh.frecce ? rh.frecce.n : 0;
  h.pozioni = rh.pozione !== null ? rh.pozioni[rh.pozione]?.n ?? 0 : 0;
  if (!rh.armatura.barriera) h.barr = 0; // tolta l'Armatura del Moto Perpetuo, la Barriera si spegne
}

/** Cambia equipaggiamento (item null = togli). null se non si può: niente `stato`, oggetto che non hai, slot sbagliato, niente da cambiare. */
export function equipNow(s: DungeonState, slot: EquipSlot, item: string | null): DungeonEvent[] | null {
  const h = heroNow(s);
  if (!h || !EQUIP_SLOTS.includes(slot) || (s.equip[slot] ?? null) === item) return null;
  if (item !== null && equipError(h, slot, item)) return null;
  const e = { ...s.equip };
  if (item === null) delete e[slot]; else e[slot] = item;
  s.equip = e;
  rebuild(s);
  return [{ t: 'equip', slot, item }];
}

/** Butta via n oggetti (al massimo quelli che hai): prima dal bottino, poi da quello portato da casa. Gli slot rimasti senza si svuotano. */
export function buttaNow(s: DungeonState, id: string, n: number): DungeonEvent[] | null {
  if (typeof id !== 'string' || !Number.isInteger(n) || n < 1) return null;
  const qui = s.bottino[id] ?? 0, tot = Math.min(n, qui + daCasa(s, id));
  if (tot < 1) return null;
  const dalBottino = Math.min(tot, qui);
  if (dalBottino > 0) togli(s.bottino, id, dalBottino);
  if (tot > dalBottino) add(s.buttati, id, tot - dalBottino);
  if (s.stato && Object.values(s.equip).includes(id)) {
    const left = invNow(s)[id] ?? 0, e = { ...s.equip };
    for (const sl of EQUIP_SLOTS) {
      if (sl === 'magia' || e[sl] !== id) continue;
      if (left < (sl === 'anello2' && e.anello1 === id ? 2 : 1)) delete e[sl];
    }
    s.equip = e;
    rebuild(s);
  }
  return [{ t: 'buttato', item: id, n: tot }];
}
