// Azioni del personaggio sull'isola (POST /api/rpg → DO Lot). Pure: advance(nowMs) prima, poi controlli, EconomyError in italiano, version + 1.
import { PERKS, RECIPES, RPG, spellDef } from '@marea/content/rpg.ts';
import { building } from '@marea/content';
import { advance } from '../economy/advance.ts';
import { pay } from '../economy/actions.ts';
import { EconomyError, ZERO } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { addTo, available, bagWeight, buildingLevel, chestCap, equipError, fixEquip, removeFrom, stow, takeItems } from './bag.ts';
import type { Bag } from './bag.ts';
import { caricoMaxOf, carriedOf, modsOf } from './derived.ts';
import { gainSkillXp, heroOf } from './hero.ts';
import { hasItem, itemDef } from './items.ts';
import { inVendita, offertaLosca, prezzoLosco } from './contrabbando.ts';
import type { EquipSlot, HeroState, ItemDef, RpgAction } from './types.ts';

export { parseRpgAction } from './parse.ts';

const HOUR = 3_600_000;
const err = (code: ConstructorParameters<typeof EconomyError>[0], msg: string): EconomyError => new EconomyError(code, msg);

function needItem(id: string): ItemDef {
  if (!hasItem(id)) throw err('oggetto', 'Oggetto sconosciuto');
  return itemDef(id);
}
function needBuilding(lot: LotState, id: string): number {
  const lv = buildingLevel(lot, id);
  if (lv < 1) throw err('edificio', `Serve: ${building(id).nome}`);
  return lv;
}
/** Ripone tutto (zaino, poi Forziere) o lancia 'peso' senza toccare niente. */
function stowAll(lot: LotState, h: HeroState, id: string, n: number): { hero: HeroState; forziere: Bag } {
  const s = stow(lot, h, id, n);
  if (s.perso > 0) throw err('peso', chestCap(lot) > 0 ? 'Zaino e Forziere sono pieni' : 'Zaino troppo pesante: costruisci un Forziere');
  return { hero: s.hero, forziere: s.forziere };
}
/** Toglie i materiali da zaino e Forziere; lancia 'materiale' se ne manca anche uno solo. */
function takeAll(lot: LotState, h: HeroState, cost: Record<string, number>): { hero: HeroState; forziere: Bag } {
  for (const [id, n] of Object.entries(cost)) {
    const have = available(lot, h, id);
    if (have < n) throw err('materiale', `Mancano ${n - have} × ${hasItem(id) ? itemDef(id).nome : id}`);
  }
  let hero = h, forziere = lot.forziere ?? {};
  for (const [id, n] of Object.entries(cost)) ({ hero, forziere } = takeItems({ ...lot, forziere }, hero, id, n));
  return { hero, forziere };
}

function equip(h: HeroState, slot: EquipSlot, id: string | null): HeroState {
  const e = { ...h.equip };
  if (id === null) { delete e[slot]; return { ...h, equip: e }; }
  if (slot !== 'magia') needItem(id);
  const why = equipError(h, slot, id);
  if (why) throw err(why.startsWith('Non hai') ? 'oggetto' : 'equip', why);
  e[slot] = id;
  return { ...h, equip: e };
}

function forgia(lot: LotState, h: HeroState, id: string, n: number): { hero: HeroState; forziere: Bag; lot: LotState } {
  const it = needItem(id);
  if (!it.forgia) throw err('oggetto', `${it.nome} non si può forgiare`);
  const lv = needBuilding(lot, 'banco');
  if (lv < it.forgia.banco) throw err('livello', `Serve il Banco da Lavoro di livello ${it.forgia.banco}`);
  const sconto = Math.max(-0.9, modsOf(h).materialiForgia ?? 0);
  let legno = 0;
  const cost: Record<string, number> = {};
  for (const [c, q] of Object.entries(it.forgia.costo)) {
    const tot = Math.max(1, Math.ceil(q * (1 + sconto))) * n;
    if (c === 'risorsa:legno') legno += tot; else cost[c] = (cost[c] ?? 0) + tot;
  }
  if (legno > 0 && lot.resources.legno < legno) throw new EconomyError('risorse', `Mancano ${legno - lot.resources.legno} di Legno`, { ...ZERO, legno: legno - lot.resources.legno });
  let { hero, forziere } = takeAll(lot, h, cost);
  ({ hero, forziere } = stowAll({ ...lot, forziere }, hero, id, n * (it.forgia.n ?? 1)));
  const lot2 = legno > 0 ? pay(lot, { ...ZERO, legno }) : lot;
  hero = gainSkillXp(hero, 'forgiatura', (RPG.xp.forgia ?? 15) * it.forgia.banco * n);
  return { hero, forziere, lot: lot2 };
}

function alchimia(lot: LotState, h: HeroState, ricetta: string, n: number): { hero: HeroState; forziere: Bag } {
  const r = RECIPES.find((x) => x.id === ricetta);
  if (!r) throw err('sconosciuto', 'Ricetta sconosciuta');
  needBuilding(lot, 'alchimia');
  if ((h.skill.alchimia?.lv ?? 0) < r.livello) throw err('livello_skill', `Serve Alchimia ${r.livello}`);
  const cost: Record<string, number> = {};
  for (const [id, q] of Object.entries(r.ingredienti)) cost[id] = q * n;
  let { hero, forziere } = takeAll(lot, h, cost);
  ({ hero, forziere } = stowAll({ ...lot, forziere }, hero, r.risultato, r.n * n));
  hero = gainSkillXp(hero, 'alchimia', ((RPG.xp.alchimia ?? 12) + r.livello * (RPG.xp.alchimiaPerLivello ?? 0)) * n);
  return { hero, forziere };
}

/** Raccoglie la Serra: ingredienti a rotazione nel Forziere (se c'è), altrimenti nello zaino; quello che non ci sta resta nella Serra. */
function serra(lot: LotState, h: HeroState): { hero: HeroState; forziere: Bag; lot: LotState } {
  const b = lot.buildings.find((x) => x.building === 'serra');
  if (!b || b.level < 1) throw err('edificio', `Serve: ${building('serra').nome}`);
  const items = building('serra').producesItems ?? [];
  const k = Math.floor(b.buffer);
  if (k < 1 || !items.length) return { hero: h, forziere: lot.forziere ?? {}, lot };
  const cap = chestCap(lot);
  let hero = h, forziere = lot.forziere ?? {}, room = cap > 0 ? cap - bagWeight(forziere) : caricoMaxOf(h) - carriedOf(h), taken = 0;
  const off = Math.floor(lot.nowMs / HOUR) % items.length;
  for (; taken < k; taken++) {
    const id = items[(off + taken) % items.length]!;
    const p = hasItem(id) ? itemDef(id).peso : 0;
    if (p > room + 1e-9) break;
    room -= p;
    if (cap > 0) forziere = addTo(forziere, id, 1); else hero = { ...hero, inv: addTo(hero.inv, id, 1) };
  }
  if (taken === 0) throw err('peso', cap > 0 ? 'Il Forziere è pieno' : 'Zaino troppo pesante');
  return { hero, forziere, lot: { ...lot, buildings: lot.buildings.map((x) => (x.id === b.id ? { ...x, buffer: x.buffer - taken } : x)) } };
}

export function applyRpgAction(lot0: LotState, a: RpgAction, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  let h = heroOf(lot);
  let forziere = lot.forziere;
  switch (a.t) {
    case 'attributo':
      if (h.scelte < 1) throw err('livello', 'Nessun livello da assegnare');
      h = { ...h, scelte: h.scelte - 1, punti: { ...h.punti, [a.attr]: (h.punti[a.attr] ?? 0) + 1 } };
      break;
    case 'perk': {
      const p = PERKS.find((x) => x.id === a.perk);
      if (!p) throw err('sconosciuto', 'Perk sconosciuto');
      if (h.perk.includes(p.id)) throw err('unico', `Hai già: ${p.nome}`);
      if (h.perkPunti < 1) throw err('perk', 'Nessun punto perk: sali di livello');
      if ((h.skill[p.skill]?.lv ?? 0) < p.livello) throw err('livello_skill', `Serve l'abilità a ${p.livello}`);
      if (p.richiede && !h.perk.includes(p.richiede)) throw err('perk', `Serve prima: ${PERKS.find((x) => x.id === p.richiede)?.nome ?? p.richiede}`);
      h = { ...h, perkPunti: h.perkPunti - 1, perk: [...h.perk, p.id] };
      break;
    }
    case 'equip': h = equip(h, a.slot, a.item); break;
    case 'leggi': {
      const it = needItem(a.item);
      if (it.kind !== 'libro' || !it.insegna) throw err('oggetto', `${it.nome} non è un libro`);
      if ((h.inv[it.id] ?? 0) < 1) throw err('oggetto', `Non hai: ${it.nome}`);
      const s = spellDef(it.insegna);
      if (h.magie.includes(s.id)) throw err('unico', `Conosci già: ${s.nome}`);
      h = { ...h, inv: removeFrom(h.inv, it.id, 1), magie: [...h.magie, s.id], equip: h.equip.magia ? h.equip : { ...h.equip, magia: s.id } };
      break;
    }
    case 'forgia': ({ hero: h, forziere, lot } = forgia(lot, h, a.item, a.n ?? 1)); break;
    case 'alchimia': ({ hero: h, forziere } = alchimia(lot, h, a.ricetta, a.n ?? 1)); break;
    case 'compra': {
      const prezzo = RPG.bottega[a.item];
      if (prezzo === undefined || !hasItem(a.item)) throw err('oggetto', 'Il Banco non lo vende');
      needBuilding(lot, 'banco');
      const tot = prezzo * a.n;
      if (h.monete < tot) throw err('risorse', `Monete insufficienti: ne servono ${tot}`);
      ({ hero: h, forziere } = stowAll(lot, h, a.item, a.n));
      h = { ...h, monete: h.monete - tot };
      break;
    }
    case 'deposita': {
      const it = needItem(a.item);
      const cap = chestCap(lot);
      if (cap <= 0) throw err('edificio', `Serve: ${building('forziere').nome}`);
      if ((h.inv[it.id] ?? 0) < a.n) throw err('oggetto', `Non hai abbastanza: ${it.nome}`);
      const eq = Object.entries(h.equip).filter(([s, id]) => s !== 'magia' && id === it.id).length;
      if ((h.inv[it.id] ?? 0) - a.n < eq) throw err('equip', `Togli prima ${it.nome} dall'equipaggiamento`);
      const f = lot.forziere ?? {};
      if (bagWeight(f) + it.peso * a.n > cap + 1e-9) throw err('peso', 'Il Forziere è pieno: miglioralo per farci stare di più');
      h = { ...h, inv: removeFrom(h.inv, it.id, a.n) };
      forziere = addTo(f, it.id, a.n);
      break;
    }
    case 'preleva': {
      const it = needItem(a.item);
      if (chestCap(lot) <= 0) throw err('edificio', `Serve: ${building('forziere').nome}`);
      const f = lot.forziere ?? {};
      if ((f[it.id] ?? 0) < a.n) throw err('oggetto', `Nel Forziere non c'è abbastanza: ${it.nome}`);
      if (carriedOf(h) + it.peso * a.n > caricoMaxOf(h) + 1e-9) throw err('peso', 'Zaino troppo pesante');
      h = { ...h, inv: addTo(h.inv, it.id, a.n) };
      forziere = removeFrom(f, it.id, a.n);
      break;
    }
    case 'butta': {
      // gli slot che restano senza l'oggetto si svuotano (fixEquip in fondo): la UI chiede conferma prima
      const it = needItem(a.item);
      if ((h.inv[it.id] ?? 0) < a.n) throw err('oggetto', `Non hai abbastanza: ${it.nome}`);
      h = { ...h, inv: removeFrom(h.inv, it.id, a.n) };
      break;
    }
    case 'serra': ({ hero: h, forziere, lot } = serra(lot, h)); break;
    case 'contrabbando': {
      // al Porto: si compra nello zaino, si vende dallo zaino (quello che hai addosso no)
      const it = needItem(a.item);
      if (a.op === 'compra') {
        if (!inVendita(nowMs, it.id)) throw err('oggetto', 'Oggi non lo vende');
        const tot = prezzoLosco(it.id) * a.n;
        if (h.monete < tot) throw err('risorse', `Monete insufficienti: ne servono ${tot}`);
        if (carriedOf(h) + it.peso * a.n > caricoMaxOf(h) + 1e-9) throw err('peso', 'Zaino troppo pesante');
        h = { ...h, monete: h.monete - tot, inv: addTo(h.inv, it.id, a.n) };
      } else {
        if ((h.inv[it.id] ?? 0) < a.n) throw err('oggetto', `Non hai abbastanza: ${it.nome}`);
        const eq = Object.entries(h.equip).filter(([s, id]) => s !== 'magia' && id === it.id).length;
        if ((h.inv[it.id] ?? 0) - a.n < eq) throw err('equip', `Togli prima ${it.nome} dall'equipaggiamento`);
        const paga = offertaLosca(it.id, a.n);
        if (paga < 1) throw err('oggetto', 'Non vale niente: non lo prende');
        h = { ...h, monete: h.monete + paga, inv: removeFrom(h.inv, it.id, a.n) };
      }
      break;
    }
    default: throw err('sconosciuto', 'Azione sconosciuta');
  }
  const out: LotState = { ...lot, version: lot.version + 1, hero: fixEquip(h) };
  if (forziere !== undefined) out.forziere = forziere;
  return out;
}
