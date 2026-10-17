// Arena PvP (docs/ARENA.md §2): il set del duello. Si sceglie all'ingresso del colosseo tra quello che hai (zaino e Forziere) e si salva col
// personaggio (HeroState.arena); non tocca l'equipaggiamento dei dungeon né lo zaino: in Arena non si consuma e non si perde niente.
// Dal set la fotografia del duello (ArenaEroe): una RunHero «arena» (100/100/100, danni senza one-shot) per ogni slot rapido, con l'arma o la
// magia di quello slot in mano e, per gli archi, ARENA.frecce frecce del tipo scelto; più le pozioni rapide (una per bottone, per round).
import { ARENA } from '@marea/content/arena.ts';
import { buildRunHero } from './derived.ts';
import { hasItem, itemDef } from './items.ts';
import type { ArenaLoadout, ArenaSlot, HeroState, RunHero, RunPotion } from './types.ts';

/** Quanti `id` hai (il server: zaino + Forziere; il client: lo zaino del lotto). */
export type Possiede = (id: string) => number;
export const possiedeZaino = (h: HeroState): Possiede => (id) => h.inv[id] ?? 0;

/** La fotografia del duello: una RunHero per slot rapido (null = slot vuoto) e le pozioni rapide (n = 1 ciascuna, per round). */
export type ArenaEroe = { varianti: (RunHero | null)[]; pozioni: RunPotion[] };

export const slotArma = (s: ArenaSlot | null | undefined): s is { arma: string; frecce?: string } => !!s && typeof s === 'object' && 'arma' in s;
export const slotMagia = (s: ArenaSlot | null | undefined): s is { magia: string } => !!s && typeof s === 'object' && 'magia' in s;
const kind = (id: string | undefined): string | null => (id && hasItem(id) ? itemDef(id).kind : null);

/** Il set del duello: quello salvato, o quello di partenza fatto dall'equipaggiamento (arma in mano, un altro arco dello zaino, la magia
 *  preparata, la pozione rapida e un'altra pozione). */
export function loadoutDi(h: HeroState): ArenaLoadout {
  if (h.arena) return h.arena;
  const e = h.equip, slot: (ArenaSlot | null)[] = [];
  const frecce = e.frecce && (h.inv[e.frecce] ?? 0) > 0 ? { frecce: e.frecce } : {};
  if (e.arma && (h.inv[e.arma] ?? 0) > 0) slot.push({ arma: e.arma, ...(kind(e.arma) === 'arco' ? frecce : {}) });
  const arco = Object.keys(h.inv).filter((id) => (h.inv[id] ?? 0) > 0 && kind(id) === 'arco' && id !== e.arma).sort()[0];
  if (arco) slot.push({ arma: arco, ...frecce });
  if (e.magia && h.magie.includes(e.magia)) slot.push({ magia: e.magia });
  while (slot.length < ARENA.slot) slot.push(null);
  const pz = Object.keys(h.inv).filter((id) => (h.inv[id] ?? 0) > 0 && kind(id) === 'pozione').sort();
  const prima = e.pozione && (h.inv[e.pozione] ?? 0) > 0 ? e.pozione : pz[0] ?? null;
  const pozioni: (string | null)[] = [prima, pz.find((id) => id !== prima) ?? prima];
  while (pozioni.length < ARENA.pozioni) pozioni.push(null);
  const out: ArenaLoadout = { slot: slot.slice(0, ARENA.slot), pozioni: pozioni.slice(0, ARENA.pozioni) };
  for (const k of ['corpo', 'anello1', 'anello2'] as const) { const id = e[k]; if (id && (h.inv[id] ?? 0) > 0) out[k] = id; }
  if (out.anello1 && out.anello1 === out.anello2 && (h.inv[out.anello1] ?? 0) < 2) delete out.anello2;
  return out;
}

const nome = (id: string) => (hasItem(id) ? itemDef(id).nome : id);
/** Le voci del set una per una: null = va bene, altrimenti il motivo. `usate` = armi e magie già negli slot prima di questo. */
function erroreCorpo(id: string, ha: Possiede): string | null { return ['armatura', 'veste'].includes(kind(id) ?? '') && ha(id) >= 1 ? null : `Non hai: ${nome(id)}`; }
function erroreAnello(id: string, doppio: boolean, ha: Possiede): string | null { return kind(id) === 'anello' && ha(id) >= (doppio ? 2 : 1) ? null : `Non hai: ${nome(id)}`; }
function erroreSlot(h: HeroState, s: ArenaSlot, usate: Set<string>, ha: Possiede): string | null {
  if (slotMagia(s)) {
    if (typeof s.magia !== 'string' || !h.magie.includes(s.magia)) return 'Non conosci questa magia';
    return usate.has('magia:' + s.magia) ? 'La stessa magia due volte' : null;
  }
  if (!slotArma(s) || typeof s.arma !== 'string') return 'Set non valido';
  const k = kind(s.arma);
  if ((k !== 'arma' && k !== 'arco') || ha(s.arma) < 1) return `Non hai: ${nome(s.arma)}`;
  if (usate.has(s.arma)) return `${nome(s.arma)} due volte`;
  if (s.frecce !== undefined && (k !== 'arco' || kind(s.frecce) !== 'frecce' || (s.frecce !== ARENA.frecceBase && ha(s.frecce) < 1))) return `Non hai: ${nome(s.frecce)}`;
  return null;
}
const chiave = (s: ArenaSlot): string => (slotMagia(s) ? 'magia:' + s.magia : slotArma(s) ? s.arma : '');
function errorePozione(id: string, ha: Possiede): string | null { return kind(id) === 'pozione' && ha(id) >= 1 ? null : `Non hai: ${nome(id)}`; }

/** null se il set va bene per te, altrimenti il motivo in italiano. */
export function erroreLoadout(h: HeroState, l: ArenaLoadout, ha: Possiede): string | null {
  if (!l || typeof l !== 'object' || !Array.isArray(l.slot) || !Array.isArray(l.pozioni)) return 'Set non valido';
  if (l.slot.length !== ARENA.slot || l.pozioni.length !== ARENA.pozioni) return 'Set non valido';
  if (l.corpo !== undefined) { const e = erroreCorpo(l.corpo, ha); if (e) return e; }
  for (const k of ['anello1', 'anello2'] as const) { const id = l[k]; if (id !== undefined) { const e = erroreAnello(id, l.anello1 === l.anello2, ha); if (e) return e; } }
  const usate = new Set<string>();
  for (const s of l.slot) {
    if (s === null) continue;
    const e = erroreSlot(h, s, usate, ha);
    if (e) return e;
    usate.add(chiave(s));
  }
  if (!usate.size) return 'Metti almeno un’arma o una magia';
  for (const p of l.pozioni) if (p !== null) { const e = errorePozione(p, ha); if (e) return e; }
  return null;
}

/** Il set con solo quello che hai ancora (all'inizio del duello: nel frattempo puoi aver venduto o perso qualcosa). Può restare senza slot:
 *  allora si combatte coi pugni. */
export function pulisciLoadout(h: HeroState, l: ArenaLoadout, ha: Possiede): ArenaLoadout {
  const out: ArenaLoadout = { slot: Array.from({ length: ARENA.slot }, () => null), pozioni: Array.from({ length: ARENA.pozioni }, () => null) };
  if (!l || typeof l !== 'object') return out;
  if (typeof l.corpo === 'string' && !erroreCorpo(l.corpo, ha)) out.corpo = l.corpo;
  if (typeof l.anello1 === 'string' && !erroreAnello(l.anello1, false, ha)) out.anello1 = l.anello1;
  if (typeof l.anello2 === 'string' && !erroreAnello(l.anello2, l.anello2 === out.anello1, ha)) out.anello2 = l.anello2;
  const usate = new Set<string>();
  for (let i = 0; i < ARENA.slot; i++) {
    const s = Array.isArray(l.slot) ? l.slot[i] : null;
    if (!s || typeof s !== 'object' || erroreSlot(h, s, usate, ha)) continue;
    out.slot[i] = slotArma(s) ? { arma: s.arma, ...(typeof s.frecce === 'string' ? { frecce: s.frecce } : {}) } : { magia: (s as { magia: string }).magia };
    usate.add(chiave(s));
  }
  for (let i = 0; i < ARENA.pozioni; i++) { const p = Array.isArray(l.pozioni) ? l.pozioni[i] : null; if (typeof p === 'string' && !errorePozione(p, ha)) out.pozioni[i] = p; }
  return out;
}

/** Il personaggio con addosso solo il set (e lo slot `s`): da qui buildRunHero fa la RunHero del duello. */
function vestito(h: HeroState, l: ArenaLoadout, s: ArenaSlot | null, pozioni: readonly string[]): HeroState {
  const inv: Record<string, number> = {}, equip: HeroState['equip'] = {};
  const metti = (id: string, n = 1) => { inv[id] = (inv[id] ?? 0) + n; };
  if (l.corpo) { metti(l.corpo); equip.corpo = l.corpo; }
  if (l.anello1) { metti(l.anello1); equip.anello1 = l.anello1; }
  if (l.anello2) { metti(l.anello2); equip.anello2 = l.anello2; }
  if (slotArma(s)) {
    metti(s.arma); equip.arma = s.arma;
    if (kind(s.arma) === 'arco') { const f = s.frecce ?? ARENA.frecceBase; inv[f] = ARENA.frecce; equip.frecce = f; }
  } else if (slotMagia(s)) { equip.magia = s.magia; equip.mano = 'magia'; }
  for (const p of pozioni) metti(p);
  const { evocato: _patto, ...senza } = h; // in Arena niente creatura del Patto di sangue
  return { ...senza, inv, equip, usura: {} };
}

/** La fotografia del duello dal set (già pulito): una RunHero arena per slot, le pozioni rapide. Senza niente negli slot, i pugni. */
export function buildArenaEroe(h: HeroState, l: ArenaLoadout): ArenaEroe {
  const pz = l.pozioni.filter((p): p is string => typeof p === 'string');
  const snella = (rh: RunHero): RunHero => ({ ...rh, pozioni: [], pozione: null, pesi: {}, carico: 0 });
  const varianti = l.slot.map((s) => (s ? snella(buildRunHero(vestito(h, l, s, []), { arena: true })) : null));
  if (!varianti.some((v) => v)) varianti[0] = snella(buildRunHero(vestito(h, l, null, []), { arena: true }));
  const tutte = buildRunHero(vestito(h, l, null, pz), { arena: true }).pozioni;
  const pozioni = pz.map((id) => tutte.find((p) => p.id === id)).filter((p): p is RunPotion => !!p).map((p) => ({ ...p, n: 1 }));
  return { varianti, pozioni };
}
