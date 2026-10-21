// Perk dell'albero (11 ott 2026): numeri derivati (forgiato, Riserva, Grandi Magie) e effetti nel dungeon (Taglio Critico, Colpo fatale,
// Carica massima, Automira, Arciere Mobile, Scarica, evocazioni potenziate, Patto di sangue), più il bit E nel log degli input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPG } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { decodeDungeon, encodeDungeon, frameOfRiga, isPackedDungeon, packDungeon, quantizeDungeon, replayDungeon, unpackDungeon } from '../src/dungeon/replay.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { HOLD_TICKS } from '../src/dungeon/tuning.ts';
import { newLot } from '../src/economy/actions.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import { finishDungeon, startDungeon } from '../src/rpg/run.ts';
import type { HeroState, RunHero, RunPerk } from '../src/rpg/types.ts';
import { arena, heroBase, inp, katana, run } from './dungeon_util.ts';

const heroCon = (perk: string[], o: Partial<HeroState> = {}): HeroState => ({ ...newHero(), perk, ...o });
const conPerk = (perk: RunPerk, o: Partial<RunHero> = {}): RunHero => heroBase({ perk, ...o });
function dummy(s: DungeonState, tipo: string, dx = 1.5, vita = 1000, dz = 0): Enemy {
  const e = newEnemy(s, tipo, s.hero.x + dx, s.hero.z + dz);
  e.vita = e.max = vita; e.st = 'dorme';
  return e;
}
const colpiSu = (ev: DungeonState['eventi'], id: number): number[] => ev.flatMap((x) => (x.t === 'colpo' && x.su === 'nemico' && x.id === id ? [x.danno] : []));
/** Tiene A finché il colpo non è carico, poi lo lascia partire. */
function caricato(s: DungeonState, extra = 0): DungeonState['eventi'] {
  const n = Math.ceil(s.runHero.arma.carica * (1 + s.runHero.armatura.malus) * 60) + HOLD_TICKS + 5 + extra;
  return [...run(s, n, inp({ a: true })), ...run(s, 70)];
}
const arcoHero = (perk?: RunPerk): RunHero => heroBase({
  arma: { id: 'arco_ferro', kind: 'arco', skill: 'arceria', classe: null, danno: 14, tempo: 0.9, portata: 0, carica: 0.9, caricaMolt: 1, gittata: 28, traits: {} },
  frecce: { id: 'frecce_ferro', n: 20, danno: 6, gittata: 6, gravita: 7, traits: {} },
  ...(perk ? { perk } : {}),
});

test('perk forgiati: Corazzaio, Armaiolo e Cinghie valgono solo per ciò che hai forgiato', () => {
  const con = (id: string, slot: 'corpo' | 'arma', perk: string[]): RunHero => {
    const h = heroCon(perk);
    return runHeroOf({ ...h, inv: { ...h.inv, [id]: 1 }, equip: { ...h.equip, [slot]: id } });
  };
  const base = con('armatura_bronzo', 'corpo', []), corazza = con('armatura_bronzo', 'corpo', ['fo_parsimonia', 'fo_corazzaio']);
  assert.equal(corazza.armatura.difesa, base.armatura.difesa + 15);
  const nuda = runHeroOf({ ...heroCon(['fo_parsimonia', 'fo_corazzaio']), equip: {}, inv: {} });
  assert.equal(nuda.armatura.difesa, 0, 'senza armatura forgiata niente difesa');
  const spada = con('katana_bronzo', 'arma', []), armaiolo = con('katana_bronzo', 'arma', ['fo_parsimonia', 'fo_armaiolo']);
  // +15 danni AL SECONDO: a colpo è 15 / colpi al secondo dell'arma (katana bronzo 1,7 → +8,8; martello 0,55 → +27)
  const colpiAlSec = 1 / spada.arma.tempo;
  assert.ok(Math.abs((armaiolo.arma.danno - spada.arma.danno) * colpiAlSec - 15) < 0.3, `${spada.arma.danno} → ${armaiolo.arma.danno}`);
  const martello = con('martello_bronzo', 'arma', []), martelloA = con('martello_bronzo', 'arma', ['fo_parsimonia', 'fo_armaiolo']);
  assert.ok(Math.abs((martelloA.arma.danno - martello.arma.danno) / martello.arma.tempo - 15) < 0.5, 'sul martello lento è tanto per colpo');
  assert.ok(martelloA.arma.danno - martello.arma.danno > 20 && armaiolo.arma.danno - spada.arma.danno < 10);
  const pesante = con('armatura_ferro', 'corpo', []), cinghie = con('armatura_ferro', 'corpo', ['fo_parsimonia', 'fo_corazzaio', 'fo_cinghie']);
  assert.ok(cinghie.armatura.malus < pesante.armatura.malus, `malus ${pesante.armatura.malus} → ${cinghie.armatura.malus}`);
});

test('perk: Riserva = +30 % di Magicka totale; Grandi Magie ingrandisce lo scoppio e il contatto', () => {
  const base = runHeroOf(newHero()), riserva = runHeroOf(heroCon(['ev_legame', 'ev_richiamo', 'ev_riserva']));
  assert.equal(riserva.max.magicka, Math.round(base.max.magicka * 1.3));
  assert.equal(riserva.max.vita, base.max.vita);
  const g = runHeroOf(heroCon(['di_fiamma', 'di_concentrazione', 'di_grandi'])).magie[0]!, n = base.magie[0]!;
  assert.equal(g.mole, 1.5);
  assert.equal(g.raggio, Math.round(n.raggio * 1.5 * 100) / 100);
  assert.equal(n.mole, undefined);
});

test('perk: RunHero.perk riassume gli effetti da dungeon (e non c\'è senza perk)', () => {
  assert.equal(runHeroOf(newHero()).perk, undefined);
  const p = runHeroOf(heroCon(['al_lama', 'al_polso', 'al_critico', 'ar_falco', 'ar_tensione', 'ar_automira', 'ar_automira2', 'ar_scarica', 'ar_arcomobile'])).perk!;
  assert.equal(p.sanguina, 0.5);
  assert.equal(p.automira, 2);
  assert.equal(p.scarica, true);
  assert.equal(p.arcoMobile, true);
  const v = runHeroOf(heroCon(['ev_legame', 'ev_richiamo', 'ev_cattivelle', 'ev_cresciute', 'ev_bastarde', 'ev_grosse', 'ev_patto', 'ev_sangue'], { evocato: 'lupo_spettrale' })).perk!;
  assert.deepEqual(v.alleati, { danno: 1.75, vita: 1.75, perenne: true, max: 1, banchetto: 0 });
  assert.equal(v.evocato, 'lupo_spettrale');
  assert.equal(runHeroOf(heroCon(['ev_legame', 'ev_patto'], { evocato: 'lupo_spettrale' })).perk, undefined, 'senza il Patto di sangue nessuno ti segue');
});

test('Taglio Critico: il caricato fa sanguinare (3 % al secondo per 10 s) e rallenta; i boss sanguinano un quinto', () => {
  const s = arena(conPerk({ sanguina: 1 })), e = dummy(s, 'bandito');
  colpiSu(caricato(s), e.id);
  const t = s.tick;
  assert.ok(e.emorr !== undefined && e.emorr > t, 'sanguina');
  assert.equal(e.lentoMolt, 0.7);
  const v = dungeon.view(s).nemici.find((x) => x.id === e.id)!;
  assert.ok(v.sanguina && v.lento);
  const v0 = e.vita, resto = e.emorr - s.tick;
  e.st = 'dorme'; e.aggro = false; // non si muove né colpisce: contiamo solo il sangue
  run(s, resto + 5);
  const perso = v0 - e.vita;
  assert.ok(Math.abs(perso - 30 * (resto / 60)) < 2, `perso ${perso.toFixed(0)} in ${(resto / 60).toFixed(1)} s su 1000: il 3 % al secondo`);
  assert.ok(resto > 8 * 60 && resto <= 10 * 60, 'dura 10 secondi dal colpo');
  // un normale tocco non fa niente
  const s2 = arena(conPerk({ sanguina: 1 })), e2 = dummy(s2, 'bandito');
  run(s2, 1, inp({ a: true })); run(s2, 80);
  assert.equal(e2.emorr, undefined);
  // il boss
  const s3 = arena(conPerk({ sanguina: 1 })), b = dummy(s3, 're_ossa', 1.5, 1000);
  caricato(s3);
  assert.ok(b.emorr !== undefined && Math.abs((b.emorrPct ?? 0) - 0.03 * 0.2) < 1e-9);
});

test('Taglio Critico: il rallentamento vale per i movimenti e per i tempi dei colpi (70 % dei tick)', () => {
  const s = arena(conPerk({ sanguina: 1 }));
  const e = dummy(s, 'bandito', 9);
  e.aggro = true; e.st = 'insegue'; e.lentoT = s.tick + 600; e.lentoMolt = 0.7; e.lentoAcc = 0;
  const s2 = arena(conPerk({ sanguina: 1 }));
  const f = dummy(s2, 'bandito', 9);
  f.aggro = true; f.st = 'insegue';
  run(s, 60); run(s2, 60);
  const lento = 9 - (e.x - s.hero.x), normale = 9 - (f.x - s2.hero.x);
  assert.ok(lento / normale > 0.6 && lento / normale < 0.8, `${lento.toFixed(2)} m contro ${normale.toFixed(2)} m`);
});

test('Colpo fatale: il caricato paralizza 4 s (i boss no); il nemico non attacca finché è fermo', () => {
  const s = arena(conPerk({ paralisi: 1 }), 1), e = dummy(s, 'bandito');
  caricato(s);
  assert.ok(e.paralisi !== undefined && e.paralisi > s.tick);
  const vita = s.hero.vita;
  assert.ok(dungeon.view(s).nemici.find((x) => x.id === e.id)!.paralizzato);
  const x0 = e.x;
  run(s, Math.max(0, e.paralisi - s.tick - 5));
  assert.equal(e.x, x0, 'fermo');
  assert.equal(s.hero.vita >= vita, true, 'non colpisce');
  run(s, 400);
  assert.ok(s.hero.vita < vita, 'finita la paralisi riprende a colpire');
  const b = arena(conPerk({ paralisi: 1 })), boss = dummy(b, 're_ossa');
  caricato(b);
  assert.equal(boss.paralisi, undefined, 'immune');
  // un tocco normale non paralizza
  const n = arena(conPerk({ paralisi: 1 })), en = dummy(n, 'bandito');
  run(n, 1, inp({ a: true })); run(n, 80);
  assert.equal(en.paralisi, undefined);
});

test('Carica massima: dopo 7 s il colpo uccide qualunque nemico; sui boss è il doppio del caricato; prima no', () => {
  const s = arena(conPerk({ massima: 7 })), e = dummy(s, 'bandito', 1.5, 5000);
  run(s, 6 * 60, inp({ a: true }));
  assert.ok(dungeon.view(s).hero.massima! < 1, 'ancora in carica');
  const ev = [...run(s, 90, inp({ a: true })), ...run(s, 1, inp({ a: true }))];
  assert.equal(dungeon.view(s).hero.massima, 1);
  assert.ok(ev.some((x) => x.t === 'caricaMassima'));
  const colpi = colpiSu([...ev, ...run(s, 80)], e.id);
  assert.equal(e.st, 'morto', `colpi ${colpi.join(',')}`);
  // lasciato prima dei 7 s è un caricato normale
  const p = arena(conPerk({ massima: 7 })), ep = dummy(p, 'bandito', 1.5, 5000);
  const c = colpiSu(caricato(p, 60), ep.id);
  assert.equal(ep.st !== 'morto', true);
  assert.ok(c.length === 1 && c[0]! < 100);
  // boss: doppio del caricato (danno 10 × 2.5 × 2 = 50), senza armatura
  const b = arena(conPerk({ massima: 1 })), boss = dummy(b, 're_ossa', 1.5, 5000);
  const cb = colpiSu([...run(b, 90, inp({ a: true })), ...run(b, 80)], boss.id);
  assert.deepEqual(cb, [50]);
});

test('Automira: la freccia curva verso il bersaglio vicino alla traiettoria (e senza perk lo manca)', () => {
  const tira = (perk?: RunPerk): Enemy => {
    const s = arena(arcoHero(perk));
    s.hero.x = 3; s.hero.z = 6;
    const e = dummy(s, 'bandito', 14, 1000, 1.6);
    run(s, 70, inp({ a: true, m: 1 })); // mira dritta a +x, niente mira assistita
    run(s, 1, inp({ m: 1 }));
    run(s, 80);
    return e;
  };
  assert.equal(tira().vita, 1000, 'senza Automira la freccia passa di lato');
  assert.ok(tira({ automira: 2 }).vita < 1000, 'con Automira plus colpisce');
  // lieve: ci arriva solo se è davvero vicino alla traiettoria
  const s = arena(arcoHero({ automira: 1 })); s.hero.x = 3; s.hero.z = 6;
  const vicino = dummy(s, 'bandito', 14, 1000, 0.9);
  run(s, 70, inp({ a: true, m: 1 })); run(s, 1, inp({ m: 1 })); run(s, 80);
  assert.ok(vicino.vita < 1000, 'Automira leggera prende chi mancheresti di poco');
});

test('Arciere Mobile: con l\'arco in tensione ti muovi a passo normale, senza il rallentamento', () => {
  const muovi = (perk?: RunPerk): number => {
    const s = arena(arcoHero(perk));
    s.hero.x = 3; s.hero.z = 6;
    run(s, 2, inp({ a: true, m: 1 }));
    const x0 = s.hero.x;
    run(s, 30, inp({ a: true, m: 1, mx: 1 }));
    assert.equal(dungeon.view(s).hero.anim, 'tende');
    return s.hero.x - x0;
  };
  const lento = muovi(), libero = muovi({ arcoMobile: true });
  assert.ok(libero > lento * 1.8, `${lento.toFixed(2)} m contro ${libero.toFixed(2)} m`);
  assert.ok(Math.abs(libero - 3.2 * 0.5 * (1 - 0.1)) < 0.2, `libero ${libero.toFixed(2)} m in mezzo secondo`);
});

test('Scarica: E tira 3 frecce una dopo l\'altra, poi 30 s di ricarica; senza perk o senz\'arco niente', () => {
  const s = arena(arcoHero({ scarica: true }));
  s.hero.x = 3; s.hero.z = 6;
  const ev = run(s, 1, inp({ e: true }));
  assert.ok(ev.some((x) => x.t === 'scarica'));
  run(s, 30, inp({ m: 1 }));
  assert.equal(s.usati['frecce_ferro'], 3);
  assert.equal(s.hero.frecce, 17);
  assert.equal(dungeon.view(s).hero.scarica! < 0.1, true);
  // la ricarica
  run(s, 1, inp()); run(s, 1, inp({ e: true })); run(s, 30);
  assert.equal(s.usati['frecce_ferro'], 3, 'ancora in ricarica');
  run(s, 30 * 60);
  assert.equal(dungeon.view(s).hero.scarica, 1);
  run(s, 1, inp({ e: true })); run(s, 30);
  assert.equal(s.usati['frecce_ferro'], 6);
  // senza il perk, E non fa niente
  const n = arena(arcoHero());
  run(n, 40, inp({ e: true }));
  assert.equal(n.usati['frecce_ferro'], undefined);
  assert.equal(dungeon.view(n).hero.scarica, undefined);
  // con meno di 3 frecce tira quelle che ha
  const p = arena(arcoHero({ scarica: true }));
  p.hero.frecce = 2;
  run(p, 40, inp({ e: true, m: 1 }));
  assert.equal(p.usati['frecce_ferro'], 2);
});

test('log degli input: il bit E fa il giro (pack, codec, forma di rete) e il formato senza E resta quello di prima', () => {
  const f = quantizeDungeon(inp({ e: true, a: true, m: 5 }));
  assert.equal(f.e, true);
  const p = packDungeon([f, f, inp(), inp({ e: true })]);
  assert.deepEqual(p, [[2, 0, 0, 17, 5], [1, 0, 0, 0], [1, 0, 0, 16]]);
  assert.ok(isPackedDungeon(p, 100));
  assert.deepEqual(decodeDungeon(encodeDungeon(p), 100), p);
  assert.deepEqual(unpackDungeon(p).map((x) => !!x.e), [true, true, false, true]);
  assert.equal(frameOfRiga([1, 0, 0, 16]).e, true);
  assert.equal(frameOfRiga([1, 0, 0, 15]).e, undefined);
  // senza E il formato è il 1 (o il 2 con la mira): stesse stringhe di sempre
  assert.equal(Buffer.from(encodeDungeon([[1, 0, 0, 0]]), 'base64')[0], 1);
  assert.equal(Buffer.from(encodeDungeon([[1, 0, 0, 0, 3]]), 'base64')[0], 2);
  assert.equal(Buffer.from(encodeDungeon([[1, 0, 0, 16]]), 'base64')[0], 3);
  assert.equal(decodeDungeon(Buffer.from([3, 8, 8, 0, 0, 2]).toString('base64'), 100), null, 'byte E fuori scala');
});

test('replay: una partita con la Scarica, passata per il codec di rete, dà lo stesso esito (il server rigioca E)', () => {
  const hero = arcoHero({ scarica: true, automira: 1 });
  const s = dungeon.create({ seed: 77, dungeon: 'grotta', hero });
  const frames = [];
  for (let i = 0; i < 400; i++) {
    const f = quantizeDungeon(inp({ e: i === 10 || i === 100, mx: i > 200 ? 1 : 0, ...(i % 40 < 20 ? { a: true, m: 12 } : {}) }));
    frames.push(f); dungeon.step(s, f);
  }
  const diretto = dungeon.result(s);
  assert.equal(s.usati['frecce_ferro'] !== undefined, true);
  const log = decodeDungeon(encodeDungeon(packDungeon(frames)), dungeon.maxTicks)!;
  assert.ok(log.some((r) => (r[3]! & 16) !== 0));
  const r = replayDungeon(77, 'grotta', hero, log);
  assert.equal(r.hash, diretto.hash);
  assert.deepEqual(r.usati, diretto.usati);
});

const lupo = { id: 'lupo_spettrale', scuola: 'evocazione' as const, costo: 40, ricarica: 2, danno: 0, velocita: 0, raggio: 0, sanguina: 0, evoca: 'lupo_spettrale', durata: 20 };
const evoca = (s: DungeonState): void => { run(s, 1, inp({ c: true, a: true })); run(s, 2); };

test('Evocazioni cattivelle/cresciute: l\'alleato ha più vita e più danno', () => {
  const s = arena(conPerk({ alleati: { danno: 1.75, vita: 1.5, perenne: false, max: 1, banchetto: 0 } }, { magie: [lupo] }));
  evoca(s);
  const a = s.enemies.find((x) => x.alleato)!;
  assert.equal(a.max, Math.round(a.def.vita * 1.5));
  assert.equal(a.vita, a.max);
  assert.equal(a.dannoM, 1.75);
  // il danno dell'alleato: colpisce un nemico vicino per danno × 1.75
  const t = dummy(s, 'bandito', 2.5, 1000); t.st = 'veglia';
  const v0 = t.vita;
  const ev = run(s, 200);
  const primo = colpiSu(ev, t.id)[0]!;
  assert.equal(primo, Math.round(a.def.danno * 1.75 - t.def.armatura), `colpo ${primo}`);
  assert.ok(t.vita < v0);
});

test('Patto di sangue: l\'evocazione non scade, resta finché vive, e riparte con te nella spedizione dopo', () => {
  const s = arena(conPerk({ alleati: { danno: 1, vita: 1, perenne: true, max: 1, banchetto: 0 } }, { magie: [lupo] }));
  evoca(s);
  const a = s.enemies.find((x) => x.alleato)!;
  run(s, 120 * 60);
  assert.notEqual(a.st, 'morto', 'dopo due minuti c\'è ancora');
  assert.equal(dungeon.result(s).evocato, 'lupo_spettrale');
  // morto: niente più
  a.vita = 0; a.st = 'morto';
  assert.equal(dungeon.result(s).evocato, null);
  // senza il perk il risultato non ha la chiave
  const n = arena(heroBase({ magie: [lupo] }));
  evoca(n);
  assert.equal('evocato' in dungeon.result(n), false);
  // la spedizione dopo parte con la creatura al fianco
  const d = arena(conPerk({ alleati: { danno: 1, vita: 1, perenne: true, max: 1, banchetto: 0 }, evocato: 'lupo_spettrale' }));
  const nuovo = d.enemies.find((x) => x.alleato);
  assert.ok(nuovo && nuovo.tipo === 'lupo_spettrale' && nuovo.scade === Number.MAX_SAFE_INTEGER);
  // uscendo dalla scala il lupo resta vivo nel risultato
  d.hero.x = d.map.exit.x + 0.5; d.hero.z = d.map.exit.z;
  run(d, 1, inp({ a: true }));
  assert.equal(d.outcome, 'uscito');
  assert.equal(dungeon.result(d).evocato, 'lupo_spettrale');
});

test('Patto di sangue: finishDungeon salva (o toglie) la creatura sul personaggio', () => {
  const l0 = newLot('jack', 1_800_000_000_000);
  const h0 = heroCon(['ev_legame', 'ev_richiamo', 'ev_patto', 'ev_sangue']);
  let l = startDungeon({ ...l0, hero: h0 }, 'grotta', 5, 1_800_000_001_000);
  const base = { done: true, outcome: 'uscito' as const, ticks: 100, bottino: {}, monete: 0, xp: {}, usati: {}, rotti: {}, usura: {}, uccisi: {}, danniFatti: 0, danniPresi: 0, hash: 1 };
  l = finishDungeon(l, { ...base, evocato: 'lupo_spettrale' }, 1_800_000_002_000).lot;
  assert.equal(l.hero!.evocato, 'lupo_spettrale');
  l = startDungeon(l, 'grotta', 6, 1_800_000_003_000);
  assert.equal(l.dungeon!.pending!.hero.perk!.evocato, 'lupo_spettrale');
  l = finishDungeon(l, { ...base, evocato: null }, 1_800_000_004_000).lot;
  assert.equal(l.hero!.evocato, undefined);
  // un risultato senza la chiave non tocca niente
  l = finishDungeon(startDungeon({ ...l, hero: { ...l.hero!, evocato: 'golem_evocato' } }, 'grotta', 7, 1_800_000_005_000), base, 1_800_000_006_000).lot;
  assert.equal(l.hero!.evocato, 'golem_evocato');
});

test('bilanciamento xp: le armi leggere/pesanti e la Distruzione salgono più piano di prima, Forgiatura e Alchimia più in fretta', () => {
  assert.ok(RPG.xpDanno!.distruzione! < 3 && RPG.xpDanno!.armiLeggere! < 1 && RPG.xpDanno!.armiPesanti! < 1);
  assert.ok(RPG.xp['forgia']! > 15 && RPG.xp['alchimia']! > 12);
  void katana;
});
