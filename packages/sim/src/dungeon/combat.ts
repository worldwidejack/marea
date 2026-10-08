// Danni: eroe → nemico (arma × tratti − armatura), nemico → eroe (difesa/(difesa+k) e moltiplicatori per tipo), morte e bottino.
import { RPG } from '@marea/content/rpg.ts';
import type { SkillId, Traits } from '@marea/content/rpg.ts';
import type { DungeonState, Enemy } from './state.ts';
import { add, ev, nuovoBottino, secToTicks } from './state.ts';
import { rollLoot } from './loot.ts';
import { moveCircle } from './map.ts';
import { risveglio } from './altari.ts';
import { COLPITO_TICKS, DANNO_MIN, MONETE_COLPO, SANGUINA_TICKS, SPINTA } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Somma dei buff attivi per una chiave (pozioni). */
export function buff(s: DungeonState, mod: string): number {
  let v = 0;
  for (const b of s.hero.buffs) if (b.mod === mod) v += b.valore;
  return v;
}

export type HitSrc = {
  danno: number; traits: Traits; magico: boolean;
  /** Abilità a cui va l'xp del danno (mischia) o null. */
  skill: SkillId | null;
  caricato: boolean; dirX: number; dirZ: number;
  /** Chi colpisce: eroe (anche frecce e magie) o alleato. */
  daAlleato: boolean;
};

/** Danno di un colpo su un nemico (prima di applicarlo). */
export function dannoSu(e: Enemy, src: HitSrc): number {
  const bonus = src.traits.bonusVs?.[e.def.kind] ?? 1;
  let d = src.danno * bonus;
  if (src.magico) d *= 1 - (e.def.resistMagia ?? 0);
  else d -= e.def.armatura * (1 - (src.traits.penetra ?? 0));
  return Math.max(DANNO_MIN, d);
}

/** Applica un colpo dell'eroe (o di un alleato) a un nemico: danno, sanguinamento, spinta, aggro, morte. Ritorna il danno. */
export function hitEnemy(s: DungeonState, e: Enemy, src: HitSrc): number {
  if (e.st === 'morto' || e.alleato) return 0;
  const d = dannoSu(e, src);
  e.vita -= d;
  e.hurt = COLPITO_TICKS;
  if (s.eroi.length > 1) e.ultimo = s.cur; // insieme: a chi va il sanguinamento (l'eroe di turno, o il padrone dell'alleato)
  ev(s, { t: 'colpo', x: r2(e.x), z: r2(e.z), danno: Math.round(d), su: 'nemico', id: e.id, ...(src.caricato ? { caricato: true } : {}) });
  if (!src.daAlleato) {
    s.danniFatti += d;
    if (src.skill) add(s.xp, src.skill, d);
    // arco d'oro: monete a ogni colpo (probabilità)
    const mc = src.traits.moneteColpo ?? 0;
    if (mc > 0 && s.rng.next() < mc) { const n = s.rng.int(MONETE_COLPO[0], MONETE_COLPO[1]); s.monete += n; ev(s, { t: 'monete', n }); }
  }
  if (src.traits.sanguina) { e.bleed = Math.max(e.bleed, src.traits.sanguina); e.bleedT = SANGUINA_TICKS; }
  e.dropRaro = !!src.traits.dropRaro;
  e.dropMolt = src.traits.dropMolt ?? 1;
  // sbilancia o attacco caricato: interrompe la preparazione dei non-boss e spinge
  if ((src.traits.sbilancia || src.caricato) && !e.def.boss) {
    if (e.st === 'prepara') { e.st = 'recupera'; e.stT = 0; e.stDur = secToTicks(e.def.recupero); }
    if (src.traits.sbilancia) moveCircle(s.map, e, src.dirX * SPINTA, src.dirZ * SPINTA, e.def.raggio);
  }
  if (!e.aggro) wake(s, e);
  if (e.vita <= 0) kill(s, e);
  return d;
}

export function wake(s: DungeonState, e: Enemy): void {
  if (e.aggro || e.alleato || e.st === 'morto') return;
  e.aggro = true;
  if (e.st === 'dorme' || e.st === 'veglia') { e.st = 'insegue'; e.stT = 0; }
  ev(s, { t: 'aggro', id: e.id });
}

export function kill(s: DungeonState, e: Enemy): void {
  e.vita = 0; e.st = 'morto'; e.stT = 0; e.bleed = 0; e.bleedT = 0;
  ev(s, { t: 'morte', id: e.id, tipo: e.tipo });
  if (e.alleato) return;
  add(s.uccisi, e.tipo, 1);
  // rng per nemico (dal suo id): l'ordine delle uccisioni non cambia il bottino
  const r = rollLoot(e.def.loot, s.rng.fork(`loot:${e.id}`), { molt: e.dropMolt, raro: e.dropRaro });
  const vuoto = r.monete === 0 && Object.keys(r.items).length === 0;
  s.loot.push(nuovoBottino(s, { id: s.nextId++, x: e.x, z: e.z, tipo: 'cadavere', items: r.items, monete: r.monete, vuoto, pieno: false }));
}

export type HurtKind = 'taglio' | 'contundente' | 'magia';
/** Colpo su eroe: difesa dell'armatura (+ buff), moltiplicatori per tipo, monete dell'armatura d'oro, morte (o risveglio all'altare). */
export function hitHero(s: DungeonState, danno: number, kind: HurtKind, x: number, z: number): void {
  const h = s.hero, a = s.runHero.armatura;
  if (s.done || h.protetto > 0) return;
  const difesa = Math.max(0, a.difesa + buff(s, 'difesa'));
  const k = RPG.armatura?.k ?? 100;
  const tipo = kind === 'magia' ? a.vsMagia : kind === 'contundente' ? a.vsContundente : a.vsTaglio;
  const resist = kind === 'magia' ? Math.min(0.9, buff(s, 'resistMagia')) : 0;
  const d = Math.max(DANNO_MIN, danno * (1 - difesa / (difesa + k)) * tipo * (1 - resist));
  h.vita -= d;
  h.hurt = COLPITO_TICKS;
  s.danniPresi += d;
  ev(s, { t: 'colpo', x: r2(x), z: r2(z), danno: Math.round(d), su: 'eroe' });
  const ms = a.moneteSuColpito;
  if (ms > 0) {
    const n = Math.floor(ms) + (s.rng.next() < ms - Math.floor(ms) ? 1 : 0);
    if (n > 0) { s.monete += n; ev(s, { t: 'monete', n }); }
  }
  if (h.vita <= 0) {
    if (s.salvato) risveglio(s);
    else { h.vita = 0; s.done = true; s.outcome = 'morto'; }
  }
}
