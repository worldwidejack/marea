// Vista per il client (DungeonView), risultato (RunResult) e hash dello stato riassunto a fine partita. Vista e risultato sono quelli
// dell'eroe di turno (`s.cur`); insieme la vista ha anche i compagni.
import type { RunResult } from '../rpg/types.ts';
import { hashJson } from '../hash.ts';
import type { CompagnoView, DungeonView, EnemyAnim, HeroAnim } from './types.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, finita, parte } from './state.ts';
import { pesoZaino } from './loot.ts';
import { vicinoUscita } from './hero.ts';
import { altareSotto, salvatoQui } from './altari.ts';
import { BOSS_AREA_RAGGIO, HZ } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const roundBag = (b: Record<string, number>): Record<string, number> => {
  const o: Record<string, number> = {};
  for (const k of Object.keys(b).sort()) o[k] = r2(b[k]!);
  return o;
};

export function heroAnim(s: DungeonState): { anim: HeroAnim; t: number } {
  const h = s.hero;
  if (s.outcome === 'morto') return { anim: 'morto', t: 1 };
  const ph = h.actDur > 0 ? Math.min(1, h.actT / h.actDur) : 0;
  switch (h.act) {
    case 'carica': return { anim: 'carica', t: h.carica };
    case 'swing': return { anim: 'attacca', t: ph };
    case 'tende': return { anim: 'tende', t: h.carica };
    case 'tira': return { anim: 'tira', t: ph };
    case 'lancia': return { anim: 'lancia', t: ph };
    case 'beve': return { anim: 'beve', t: ph };
    default:
  }
  if (h.hurt > 0) return { anim: 'colpito', t: 0 };
  return { anim: h.running ? 'corre' : h.moving ? 'cammina' : 'fermo', t: 0 };
}

function enemyAnim(e: Enemy): { anim: EnemyAnim; t: number } {
  const ph = e.stDur > 0 ? Math.min(1, e.stT / e.stDur) : 0;
  if (e.st === 'morto') return { anim: 'morto', t: 1 };
  if (e.st === 'prepara' || e.st === 'colpisce' || e.st === 'recupera') return { anim: e.st, t: ph };
  if (e.hurt > 0) return { anim: 'colpito', t: 0 };
  return { anim: e.st, t: 0 };
}

export function viewOf(s: DungeonState): DungeonView {
  const h = s.hero, rh = s.runHero, ha = heroAnim(s);
  return {
    dungeon: s.dungeon, tick: s.tick, done: s.done, outcome: s.outcome,
    hero: {
      x: h.x, z: h.z, fx: h.fx, fz: h.fz, anim: ha.anim, t: ha.t, carica: h.act === 'carica' || h.act === 'tende' ? h.carica : 0,
      ...(ha.anim === 'attacca' ? { stile: h.stile } : {}),
      vita: h.vita, magicka: h.magicka, stamina: h.stamina, max: { ...rh.max },
      ricaricaMagia: h.cdMagia / HZ, frecce: h.frecce, pozioni: h.pozioni, protetto: h.protetto > 0, arma: h.arma.id,
    },
    nemici: s.enemies.map((e) => {
      const a = enemyAnim(e);
      return { id: e.id, tipo: e.tipo, model: e.def.model, x: e.x, z: e.z, fx: e.fx, fz: e.fz, anim: a.anim, t: a.t, vita: Math.max(0, e.vita), max: e.max, alleato: e.alleato, sanguina: e.bleedT > 0, boss: !!e.def.boss, ...(e.capo ? { capo: true } : {}), ...(e.st === 'prepara' && e.area ? { area: e.def.portata * BOSS_AREA_RAGGIO } : {}) };
    }),
    proiettili: s.proj.map((p) => ({ id: p.id, tipo: p.tipo, x: p.x, y: p.y, z: p.z, vx: p.vx, vz: p.vz })),
    bottini: s.loot.map((l) => ({ id: l.id, x: l.x, z: l.z, tipo: l.tipo, vuoto: parte(s, l).vuoto })),
    uscita: { x: s.map.exit.x, z: s.map.exit.z },
    vicinoUscita: vicinoUscita(s),
    altari: s.map.altari.map((a, i) => ({ x: a.x, z: a.z, attivo: s.salvato?.altare === i })),
    lanterna: s.done ? -1 : altareSotto(s), salvatoQui: salvatoQui(s),
    salvato: s.salvato ? { bottino: { ...s.salvato.bottino }, monete: s.salvato.monete } : null,
    zaino: { peso: r2(pesoZaino(s)), max: rh.caricoMax, monete: s.monete, bottino: { ...s.bottino } },
    eventi: s.eventi,
    io: s.cur, compagni: s.eroi.length > 1 ? compagni(s) : [], finita: finita(s),
  };
}

/** Insieme: gli altri eroi visti dall'eroe di turno. */
function compagni(s: DungeonState): CompagnoView[] {
  const out: CompagnoView[] = [];
  for (let i = 0; i < s.eroi.length; i++) {
    if (i === s.cur) continue;
    out.push(conEroe(s, i, () => {
      const h = s.hero, ha = heroAnim(s);
      return {
        i, x: h.x, z: h.z, fx: h.fx, fz: h.fz, anim: ha.anim, t: ha.t, carica: h.act === 'carica' || h.act === 'tende' ? h.carica : 0,
        ...(ha.anim === 'attacca' ? { stile: h.stile } : {}),
        vita: h.vita, max: s.runHero.max.vita, arma: h.arma.id, protetto: h.protetto > 0, done: s.done, outcome: s.outcome,
      };
    }));
  }
  return out;
}

/** Hash dello stato riassunto: posizione e barre dell'eroe, nemici, bottino, contatori. Insieme: le parti di tutti gli eroi. */
export function hashOf(s: DungeonState): number {
  const nemici = s.enemies.map((e) => [e.id, e.tipo, r3(e.vita), r3(e.x), r3(e.z), e.st]);
  if (s.eroi.length > 1) {
    return hashJson({
      v: s.v, d: s.dungeon, seed: s.seed, tick: s.tick, nemici,
      loot: s.loot.map((l) => [l.id, l.vuoto ? 1 : 0, ...(l.altri ?? []).map((p) => (p.vuoto ? 1 : 0))]),
      eroi: s.eroi.map((_, i) => conEroe(s, i, () => parteHash(s))),
    });
  }
  return hashJson({ v: s.v, d: s.dungeon, seed: s.seed, tick: s.tick, nemici, loot: s.loot.map((l) => [l.id, l.vuoto ? 1 : 0]), ...parteHash(s) });
}
/** La parte dell'eroe di turno nell'hash (da solo le chiavi sono quelle di sempre: hashJson le ordina). */
function parteHash(s: DungeonState): Record<string, unknown> {
  const h = s.hero;
  return {
    outcome: s.outcome,
    hero: [r3(h.x), r3(h.z), r3(h.vita), r3(h.magicka), r3(h.stamina), h.frecce, h.pozioni],
    bottino: roundBag(s.bottino), monete: s.monete, uccisi: roundBag(s.uccisi), usati: roundBag(s.usati),
    danni: [r3(s.danniFatti), r3(s.danniPresi)],
    salvato: s.salvato ? [s.salvato.altare, s.salvato.tick, s.salvato.monete, roundBag(s.salvato.bottino)] : null, cadute: s.cadute,
    // v5: zaino ed equipaggiamento cambiati dal menu, lanterna di partenza e di uscita
    zaino: [s.stato ? Object.keys(s.equip).sort().map((k) => [k, s.equip[k as keyof typeof s.equip]]) : null, roundBag(s.buttati), roundBag(s.rotti), s.hero.arma.id],
    lanterne: [s.partenza, s.uscitaLanterna],
  };
}

export function resultOf(s: DungeonState): RunResult {
  return {
    done: s.done, outcome: s.outcome, ticks: s.tick,
    bottino: { ...s.bottino }, monete: s.monete, xp: roundBag(s.xp), usati: { ...s.usati }, rotti: { ...s.rotti }, usura: { ...s.usura },
    uccisi: { ...s.uccisi }, danniFatti: r2(s.danniFatti), danniPresi: r2(s.danniPresi),
    salvato: s.salvato ? { bottino: { ...s.salvato.bottino }, monete: s.salvato.monete } : null, cadute: s.cadute,
    capo: s.enemies.some((e) => e.capo && e.st === 'morto'),
    ...(s.uscitaLanterna >= 0 ? { lanterna: s.uscitaLanterna } : {}),
    ...(s.stato ? { equip: { ...s.equip } } : {}),
    ...(Object.keys(s.buttati).length ? { buttati: { ...s.buttati } } : {}),
    hash: hashOf(s),
  };
}
