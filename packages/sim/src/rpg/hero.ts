// Personaggio GDR (CONTRACTS §15): nascita, esperienza, numeri derivati e fotografia per il dungeon. Puro. STUB di WP0: lo riempie R-rpg.
import type { SkillId } from '@marea/content/rpg.ts';
import type { LotState } from '../economy/types.ts';
import type { HeroDerived, HeroState, RunHero } from './types.ts';

export function newHero(): HeroState { throw new Error('TODO R-rpg: newHero'); }
/** Il personaggio del lotto (lot.hero ?? newHero()). */
export function heroOf(lot: LotState): HeroState { return lot.hero ?? newHero(); }
export function heroDerived(h: HeroState): HeroDerived { void h; throw new Error('TODO R-rpg: heroDerived'); }
/** Fotografia per una spedizione: tutti i numeri già con perk, anelli, vesti, armatura. */
export function runHeroOf(h: HeroState): RunHero { void h; throw new Error('TODO R-rpg: runHeroOf'); }
/** Esperienza di abilità: sale di livello l'abilità e, a cascata, il personaggio (scelte e perkPunti). Pura. */
export function gainSkillXp(h: HeroState, skill: SkillId, xp: number): HeroState { void h; void skill; void xp; throw new Error('TODO R-rpg: gainSkillXp'); }
/** Peso trasportato (zaino). */
export function carried(h: HeroState): number { void h; throw new Error('TODO R-rpg: carried'); }
