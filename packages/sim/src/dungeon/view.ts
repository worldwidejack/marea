// Vista per il client (DungeonView), risultato (RunResult) e hash dello stato riassunto a fine partita. Vista e risultato sono quelli
// dell'eroe di turno (`s.cur`); insieme la vista ha anche i compagni.
import type { RunResult } from '../rpg/types.ts';
import { hashJson } from '../hash.ts';
import type { CompagnoView, DungeonView, EnemyAnim, HeroAnim } from './types.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, finita, parte } from './state.ts';
import { cellOf } from './map.ts';
import { pesoZaino } from './loot.ts';
import { vicinoUscita } from './hero.ts';
import { altareSotto, salvatoQui } from './altari.ts';
import { livello, valvolaVicina } from './acque.ts';
import { areaRaggio } from './enemies.ts';
import { alRiparo, nelVento, statoVento, timoneVicino } from './vento.ts';
import { alto, schermato } from './muove.ts';
import { inGetto, statoLava } from './fuoco.ts';
import { HZ } from './tuning.ts';

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
      ricaricaMagia: h.cdMagia / HZ, frecce: h.frecce, pozioni: h.pozioni, protetto: h.protetto > 0, arma: h.arma.id, rallentato: h.lento > 0,
      ...(s.correnti.length ? { vento: !s.done && nelVento(s), riparo: !s.done && alRiparo(s) } : {}), ...(h.spT > 0 ? { spinto: true } : {}),
      ...(fucina(s) ? { brucia: h.brucia > 0, bagnato: !s.done && inGetto(s, h.x, h.z) } : {}),
    },
    nemici: s.enemies.map((e) => {
      const a = enemyAnim(e);
      return { id: e.id, tipo: e.tipo, model: e.def.model, x: e.x, z: e.z, fx: e.fx, fz: e.fz, anim: a.anim, t: a.t, vita: Math.max(0, e.vita), max: e.max, alleato: e.alleato, sanguina: e.bleedT > 0, boss: !!e.def.boss, ...(e.capo ? { capo: true } : {}), ...(e.st === 'prepara' && e.area ? { area: areaRaggio(e.def) } : {}), ...(e.st === 'prepara' && e.tiro ? { tiro: true } : {}), ...archivio(s, e) };
    }),
    proiettili: s.proj.map((p) => ({ id: p.id, tipo: p.tipo, x: p.x, y: p.y, z: p.z, vx: p.vx, vz: p.vz })),
    bottini: s.loot.map((l) => ({ id: l.id, x: l.x, z: l.z, tipo: l.tipo, vuoto: parte(s, l).vuoto })),
    uscita: { x: s.map.exit.x, z: s.map.exit.z },
    vicinoUscita: vicinoUscita(s),
    altari: s.map.altari.map((a, i) => ({ x: a.x, z: a.z, attivo: s.salvato?.altare === i })),
    lanterna: s.done ? -1 : altareSotto(s), salvatoQui: salvatoQui(s),
    salvato: s.salvato ? { bottino: { ...s.salvato.bottino }, monete: s.salvato.monete } : null,
    acque: s.bacini.map((b) => ({ n: b.n, livello: livello(b) })),
    valvole: s.map.valvole.map((v) => ({ x: v.x, z: v.z, n: v.n, aperta: !!s.bacini.find((b) => b.n === v.n)?.aperta })),
    vicinoValvola: !s.done && s.map.valvole.length > 0 && valvolaVicina(s) >= 0,
    venti: s.map.venti.map((v) => ({ n: v.n, dx: v.dx, dz: v.dz, ...statoVento(s, v) })),
    timoni: s.map.timoni.map((t) => ({ x: t.x, z: t.z, n: t.n, fermo: !!s.correnti.find((c) => c.n === t.n)?.ferma })),
    vicinoTimone: !s.done && s.map.timoni.length > 0 && timoneVicino(s) >= 0,
    geyser: s.geyser.map((g) => ({ id: g.id, x: g.x, z: g.z, r: g.r, getto: g.t > g.avviso, t: g.t > g.avviso ? Math.min(1, (g.t - g.avviso) / g.getto) : Math.min(1, g.t / g.avviso), ...(g.spinta !== undefined ? { bomba: true } : {}), ...(g.magma ? { magma: true } : {}) })),
    lave: s.map.lave.map((v) => ({ n: v.n, ...statoLava(s, v) })),
    fuochi: s.fuochi.map((f) => ({ id: f.id, x: f.x, z: f.z, r: f.r, t: Math.max(0, Math.min(1, 1 - (f.fine - s.tick) / f.durata)) })),
    zaino: { peso: r2(pesoZaino(s)), max: rh.caricoMax, monete: s.monete, bottino: { ...s.bottino } },
    eventi: s.eventi,
    io: s.cur, compagni: s.eroi.length > 1 ? compagni(s) : [], finita: finita(s),
  };
}

/** Archivio: chi vola alto, chi sta sulle grate, la molla, gli anelli-scudo, l'attacco dell'Astrolabio (e dove arriva il raggio).
 *  Fucina: il Mastro Forgiatore (muove `asciutto`). */
function archivio(s: DungeonState, e: Enemy): Partial<DungeonView['nemici'][number]> {
  const d = e.def;
  if (!d.muove && !d.molla) return {};
  const o: Partial<DungeonView['nemici'][number]> = {};
  if (alto(s, e)) o.alto = true;
  if (d.muove === 'grate' && s.map.grata[cellOf(s.map, e.x, e.z)]) o.grata = true;
  if (e.molla && e.st === 'recupera') o.molla = true;
  if (d.astrolabio) {
    if (schermato(s, e)) o.schermo = true;
    if (e.modo && (e.st === 'prepara' || e.st === 'colpisce')) o.attacco = e.modo;
    if (e.mira && e.modo === 'raggio' && (e.st === 'prepara' || e.st === 'colpisce')) o.mira = [r2(e.x + e.mira.dx * e.mira.len), r2(e.z + e.mira.dz * e.mira.len)];
  }
  // Fucina, il Mastro Forgiatore: attacco in corso, la linea della carica mentre la prepara, spento dalla cascata
  if (d.forgiatore) {
    if (e.spento) o.spento = true;
    if (e.modo && (e.st === 'prepara' || e.st === 'colpisce')) o.attacco = e.modo;
    if (e.mira && e.modo === 'carica' && e.st === 'prepara') o.mira = [r2(e.x + e.mira.dx * e.mira.len), r2(e.z + e.mira.dz * e.mira.len)];
  }
  return o;
}
/** La Fucina ha lava o cascate (negli altri dungeon niente chiavi in più: vista e hash restano quelli di sempre). */
const fucina = (s: DungeonState): boolean => s.map.lave.length > 0 || s.map.getti.length > 0;

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
      v: s.v, d: s.dungeon, seed: s.seed, tick: s.tick, nemici, ...acqueHash(s),
      loot: s.loot.map((l) => [l.id, l.vuoto ? 1 : 0, ...(l.altri ?? []).map((p) => (p.vuoto ? 1 : 0))]),
      eroi: s.eroi.map((_, i) => conEroe(s, i, () => parteHash(s))),
    });
  }
  return hashJson({ v: s.v, d: s.dungeon, seed: s.seed, tick: s.tick, nemici, loot: s.loot.map((l) => [l.id, l.vuoto ? 1 : 0]), ...acqueHash(s), ...parteHash(s) });
}
/** Drenaggio: bacini e geyser nell'hash; Archivio: correnti ferme e bombe; Fucina: fuoco (negli altri dungeon niente chiave: l'hash resta
 *  quello di sempre). */
function acqueHash(s: DungeonState): Record<string, unknown> {
  const o: Record<string, unknown> = s.bacini.length ? { acque: s.bacini.map((b) => [b.n, b.aperta ? 1 : 0, b.scolo]), geyser: s.geyser.map((g) => [g.id, g.t, g.colpiti.length]) } : {};
  if (s.correnti.length) { o['venti'] = s.correnti.map((c) => [c.n, c.ferma ? 1 : 0]); o['bombe'] = s.geyser.map((g) => [g.id, g.t, g.colpiti.length]); }
  // Fucina: chiazze di fuoco, chi brucia, il Mastro spento
  if (fucina(s)) o['fucina'] = [s.fuochi.map((f) => [f.id, f.fine]), s.eroi.map((r) => r.hero.brucia), s.enemies.filter((e) => e.spento).map((e) => e.id)];
  return o;
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
