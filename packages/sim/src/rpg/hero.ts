// Personaggio GDR (CONTRACTS §15): nascita, esperienza, numeri derivati e fotografia per il dungeon. Puro.
// Crescita alla Skyrim (docs/RPG.md §3): l'xp di un'abilità la fa salire; ogni livello d'abilità dà al personaggio xp pari al nuovo livello
// (× RPG.xp.personaggioPerLivelloSkill); ogni livello del personaggio = 1 scelta (+perLivello a una barra) e 1 punto perk.
import { RPG, SKILLS } from '@marea/content/rpg.ts';
import type { SkillId } from '@marea/content/rpg.ts';
import type { LotState } from '../economy/types.ts';
import { buildRunHero, carriedOf } from './derived.ts';
import type { HeroDerived, HeroState, RunHero } from './types.ts';

export function newHero(): HeroState {
  const P = RPG.partenza;
  const skill = {} as HeroState['skill'];
  for (const s of SKILLS) skill[s] = { lv: RPG.livelli.skillIniziale, xp: 0 };
  return {
    v: 1, livello: 1, xp: 0, scelte: 0, punti: { vita: 0, magicka: 0, stamina: 0 }, perkPunti: 0, perk: [], skill,
    inv: { ...P.inv }, equip: { ...P.equip } as HeroState['equip'], magie: [...P.magie], monete: P.monete, usura: {}, discese: 0, morti: 0,
  };
}
/** Il personaggio del lotto (lot.hero ?? newHero()). */
export function heroOf(lot: LotState): HeroState { return lot.hero ?? newHero(); }

/** xp per passare dal livello `lv` di un'abilità al successivo. */
export function skillXpNeeded(lv: number): number { return RPG.livelli.xpSkill.base + RPG.livelli.xpSkill.perLivello * lv; }
/** xp per passare dal livello `lv` del personaggio al successivo. */
export function heroXpNeeded(lv: number): number { return RPG.livelli.xpPersonaggio.base + RPG.livelli.xpPersonaggio.perLivello * (lv - 1); }

export function heroDerived(h: HeroState): HeroDerived {
  const r = buildRunHero(h);
  const skillProssimo = {} as Record<SkillId, number>;
  for (const s of SKILLS) {
    const st = h.skill[s] ?? { lv: RPG.livelli.skillIniziale, xp: 0 };
    skillProssimo[s] = st.lv >= RPG.livelli.skillMax ? 0 : skillXpNeeded(st.lv);
  }
  // velocita = colpi al secondo dell'arma in mano col malus dell'armatura (arco: tiri a piena tensione al secondo)
  return {
    max: r.max, regen: r.regen, carico: r.carico, caricoMax: r.caricoMax, difesa: r.armatura.difesa, malus: r.armatura.malus,
    danno: r.arma.danno, velocita: Math.round((1 / Math.max(0.01, r.arma.tempo * (1 + r.armatura.malus))) * 100) / 100,
    xpProssimo: heroXpNeeded(h.livello), skillProssimo,
  };
}
/** Fotografia per una spedizione: tutti i numeri già con perk, anelli, vesti, armatura. */
export function runHeroOf(h: HeroState): RunHero { return buildRunHero(h); }

/** Esperienza di abilità: sale di livello l'abilità e, a cascata, il personaggio (scelte e perkPunti). Pura. */
export function gainSkillXp(h: HeroState, skill: SkillId, xp: number): HeroState {
  if (!Number.isFinite(xp) || xp <= 0) return h;
  const L = RPG.livelli;
  const cur = h.skill[skill] ?? { lv: L.skillIniziale, xp: 0 };
  if (cur.lv >= L.skillMax) return h;
  let lv = cur.lv, sx = cur.xp + xp, heroXp = h.xp;
  const perLv = RPG.xp.personaggioPerLivelloSkill ?? 1;
  while (lv < L.skillMax && sx >= skillXpNeeded(lv)) {
    sx -= skillXpNeeded(lv);
    lv++;
    heroXp += lv * perLv;
  }
  if (lv >= L.skillMax) sx = 0;
  let livello = h.livello, scelte = h.scelte, perkPunti = h.perkPunti;
  while (heroXp >= heroXpNeeded(livello)) {
    heroXp -= heroXpNeeded(livello);
    livello++; scelte++; perkPunti++;
  }
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  return { ...h, livello, scelte, perkPunti, xp: r(heroXp), skill: { ...h.skill, [skill]: { lv, xp: r(sx) } } };
}
/** Peso trasportato (zaino). */
export function carried(h: HeroState): number { return carriedOf(h); }
