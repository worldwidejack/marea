// Magia in mano e mira col mouse (dungeon v6): tabella delle direzioni, log con la mira (formato 2, il 1 si legge ancora), arco e magie che
// vanno dove punta il cursore, C alterna arma e magia, la A lancia con la magia in mano, equip dal menu e dall'isola, replay (anche della squadra).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newLot } from '../src/economy/actions.ts';
import { dungeon, createPartyRun, stepParty } from '../src/dungeon/dungeon.ts';
import type { DungeonState } from '../src/dungeon/dungeon.ts';
import { AIM_N, aimDir, aimIndex } from '../src/dungeon/mira.ts';
import { decodeDungeon, encodeDungeon, isPackedDungeon, packDungeon, quantizeDungeon, replayDungeon, replayParty, unpackDungeon } from '../src/dungeon/replay.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonInput, PackedDungeon } from '../src/dungeon/types.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { finishDungeon, startDungeon } from '../src/rpg/run.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import { heroOf, newHero } from '../src/rpg/hero.ts';
import { SQ_MIRA_MAX, isSqInput } from '../../protocol/src/squadra.ts';
import { createRng } from '../src/rng.ts';
import { conEroe } from '../src/dungeon/state.ts';
import { arena, heroBase, inp, playAuto, run } from './dungeon_util.ts';

const T0 = 1_800_000_000_000;
const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');
const ARCO = { id: 'arco_ferro', kind: 'arco', skill: 'arceria', classe: null, danno: 14, tempo: 0.9, portata: 0, carica: 0.9, caricaMolt: 1, gittata: 28, traits: {} } as const;
const FRECCE = { id: 'frecce_ferro', n: 5, danno: 6, gittata: 6, gravita: 7, traits: {} } as const;
const arcoHero = () => heroBase({ arma: { ...ARCO }, frecce: { ...FRECCE } });
/** Bersaglio fermo e addormentato a (dx, dz) dall'eroe. */
function dummy(s: DungeonState, dx: number, dz: number, vita = 1000) {
  const e = newEnemy(s, 'bandito', s.hero.x + dx, s.hero.z + dz);
  e.vita = e.max = vita; e.st = 'dorme';
  return e;
}
/** Direzione di volo del primo proiettile, normalizzata. */
const volo = (s: DungeonState): [number, number] => { const p = s.proj[0]!, l = Math.sqrt(p.vx * p.vx + p.vz * p.vz); return [p.vx / l, p.vz / l]; };
const vicino = (a: readonly [number, number], b: readonly [number, number], tol = 1e-6) => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
/** Partenza vera dell'eroe di partenza (katana di legno, Fiammata preparata, arco e frecce nello zaino), con `stato` per i cambi dal menu. */
function partenza(mano = false): DungeonState {
  const h = newHero();
  const st = mano ? { ...h, equip: { ...h.equip, mano: 'magia' as const } } : h;
  return dungeon.create({ seed: 3, dungeon: 'grotta', hero: buildRunHero(st), stato: st });
}

test('mira: ogni indice è un versore e aimIndex lo ritrova; fuori scala o assente = nessuna mira', () => {
  for (let i = 1; i <= AIM_N; i++) {
    const [x, z] = aimDir(i)!;
    assert.ok(Math.abs(x * x + z * z - 1) < 1e-12, `versore ${i}`);
    assert.equal(aimIndex(x, z), i);
    assert.equal(aimIndex(x * 5, z * 5), i, 'la lunghezza non conta');
  }
  assert.deepEqual([aimIndex(1, 0), aimIndex(0, 1), aimIndex(-1, 0), aimIndex(0, -1), aimIndex(0, 0)], [1, 61, 121, 181, 0]);
  for (const m of [0, -1, AIM_N + 1, 1.5, NaN, undefined]) assert.equal(aimDir(m), null, String(m));
  assert.equal(SQ_MIRA_MAX, AIM_N, 'il protocollo della squadra conosce lo stesso massimo');
});

test('mira: il log con la mira (formato 2) fa il giro senza perdite; senza mira resta il formato 1 di sempre', () => {
  const frames: DungeonInput[] = [inp({ a: true, m: 5 }), inp({ a: true, m: 5 }), inp({ a: true, m: 7 }), inp({ mx: 0.5 }), inp({ a: true }), inp({ a: true, m: AIM_N })].map(quantizeDungeon);
  const p = packDungeon(frames);
  assert.deepEqual(p, [[2, 0, 0, 1, 5], [1, 0, 0, 1, 7], [1, 4, 0, 0], [1, 0, 0, 1], [1, 0, 0, 1, AIM_N]], 'righe uguali si fondono solo con la stessa mira');
  assert.deepEqual(unpackDungeon(p), frames);
  assert.ok(isPackedDungeon(p, 100));
  const s = encodeDungeon(p);
  assert.equal(Buffer.from(s, 'base64')[0], 2, 'con la mira è il formato 2');
  assert.deepEqual(decodeDungeon(s, 100), p);
  // senza nessuna mira: formato 1, righe a 4 elementi, identico a prima
  const q: PackedDungeon = [[5, 1, 2, 3], [200, -1, 0, 1]];
  assert.equal(Buffer.from(encodeDungeon(q), 'base64')[0], 1);
  assert.deepEqual(decodeDungeon(encodeDungeon(q), 1000), q);
  // un log del formato 1 scritto a mano si legge ancora
  assert.deepEqual(decodeDungeon(b64([1, 0x08, 0x05]), 100), [[1, 0, 0, 1]]);
  assert.deepEqual(decodeDungeon(b64([2, 0x08, 0x05, 7]), 100), [[1, 0, 0, 1, 7]], 'e uno del formato 2');
  // forma: la mira va da 0 a AIM_N, intera, e le righe hanno 4 o 5 numeri
  for (const bad of [[[1, 0, 0, 0, AIM_N + 1]], [[1, 0, 0, 0, -1]], [[1, 0, 0, 0, 1.5]], [[1, 0, 0, 0, 1, 1]]]) assert.equal(isPackedDungeon(bad, 10), false, JSON.stringify(bad));
  assert.equal(decodeDungeon(b64([2, 0x08, 0x05, AIM_N + 1]), 100), null, 'byte di mira fuori scala');
  assert.equal(decodeDungeon(b64([2, 0x08, 0x05]), 100), null, 'riga del formato 2 senza il byte di mira');
  // quantizzazione: una mira non valida diventa «nessuna mira»
  assert.equal(quantizeDungeon({ ...inp(), m: 0 }).m, undefined);
  assert.equal(quantizeDungeon({ ...inp(), m: AIM_N + 3 }).m, undefined);
  assert.equal(quantizeDungeon({ ...inp(), m: 9 }).m, 9);
  // protocollo della squadra: [mx, my, bit, mira?]
  assert.ok(isSqInput([0, 0, 1]) && isSqInput([0, 0, 1, 5]) && isSqInput([0, 0, 1, 0]));
  for (const bad of [[0, 0, 1, SQ_MIRA_MAX + 1], [0, 0, 1, -1], [0, 0, 1, 2.5], [0, 0, 1, 5, 5], [0, 0]]) assert.equal(isSqInput(bad), false, JSON.stringify(bad));
});

test('mira: l’arco tira dove punta il mouse (anche se un nemico sta da un’altra parte); senza mira vale quella assistita', () => {
  const su = aimIndex(0, 1), dirSu = aimDir(su)!;
  // con la mira: nemico a destra (+x), cursore verso +z
  const s = arena(arcoHero());
  s.hero.x = 3;
  dummy(s, 6, 0);
  run(s, 1, inp({ a: true, m: su }));
  assert.equal(s.hero.act, 'tende');
  assert.ok(vicino([s.hero.fx, s.hero.fz], dirSu), 'tendendo l’eroe guarda il cursore');
  run(s, 20, inp({ a: true, mx: 1, m: su })); // si muove di lato tendendo: la faccia resta sul cursore
  assert.ok(vicino([s.hero.fx, s.hero.fz], dirSu), 'camminando l’eroe non si gira verso dove va');
  run(s, 1, inp({ m: su })); // rilascio
  assert.equal(s.proj.length, 1);
  assert.ok(vicino(volo(s), dirSu, 1e-9), `la freccia va verso il cursore: ${volo(s)}`);
  // un altro angolo, con l'eroe fermo
  const s2 = arena(arcoHero());
  const m2 = aimIndex(-1, -1);
  run(s2, 1, inp({ a: true, m: m2 })); run(s2, 1, inp({ m: m2 }));
  assert.ok(vicino(volo(s2), aimDir(m2)!, 1e-9));
  // senza mira: la freccia va verso il nemico (+x) come sempre
  const s3 = arena(arcoHero());
  s3.hero.z = 10;
  dummy(s3, 8, 0);
  run(s3, 30, inp({ a: true })); run(s3, 1);
  assert.ok(volo(s3)[0] > 0.99 && Math.abs(volo(s3)[1]) < 0.02, `assistita: ${volo(s3)}`);
});

test('mira: la magia in mano parte dove punta il mouse e la mira può essere diversa a ogni lancio', () => {
  const s = arena(heroBase());
  dummy(s, 6, 0);
  const m = aimIndex(0, -1);
  const ev = run(s, 1, inp({ c: true, a: true, m }));
  assert.ok(ev.some((e) => e.t === 'magia'));
  assert.equal(s.proj[0]!.tipo, 'magia');
  assert.ok(vicino(volo(s), aimDir(m)!, 1e-9));
  assert.ok(vicino([s.hero.fx, s.hero.fz], aimDir(m)!), 'l’eroe guarda dove ha lanciato');
  // senza mira: assistita, verso il nemico a +x
  const t = arena(heroBase());
  dummy(t, 6, 0);
  run(t, 1, inp({ c: true, a: true }));
  assert.ok(volo(t)[0] > 0.99);
  // l’evocazione compare davanti, dalla parte del cursore
  const e = arena(heroBase({ magie: [{ id: 'lupo_spettrale', scuola: 'evocazione', costo: 40, ricarica: 2, danno: 0, velocita: 0, raggio: 0, sanguina: 0, evoca: 'lupo_spettrale', durata: 20 }] }));
  run(e, 1, inp({ c: true, a: true, m: aimIndex(0, 1) }));
  const lupo = e.enemies.find((x) => x.alleato)!;
  assert.ok(lupo.z > e.hero.z + 0.5 && Math.abs(lupo.x - e.hero.x) < 0.5, 'il lupo nasce verso +z');
});

test('mani: C alterna arma e magia; con la magia in mano la A lancia, con l’arma colpisce', () => {
  const s = arena(heroBase());
  const e = dummy(s, 1.5, 0);
  assert.equal(s.hero.incanta, false);
  assert.equal(dungeon.view(s).hero.magia, undefined, 'con l’arma in mano la vista non ha la magia');
  const ev = run(s, 1, inp({ c: true }));
  assert.deepEqual(ev.filter((x) => x.t === 'mano'), [{ t: 'mano', magia: 'fiammata' }]);
  assert.equal(s.hero.incanta, true);
  assert.equal(dungeon.view(s).hero.magia, 'fiammata');
  run(s, 1); // C rilasciato
  // la A lancia: niente colpo di mischia
  const ev2 = [...run(s, 1, inp({ a: true })), ...run(s, 70)];
  assert.ok(ev2.some((x) => x.t === 'magia' && x.id === 'fiammata'));
  assert.equal(s.hero.magicka < 100, true, 'ha pagato la magia');
  // C di nuovo: l’arma torna in mano, la A colpisce di mischia (nessuna magia)
  run(s, 60);
  const ev3 = run(s, 1, inp({ c: true }));
  assert.deepEqual(ev3.filter((x) => x.t === 'mano'), [{ t: 'mano', magia: null }]);
  assert.equal(dungeon.view(s).hero.magia, undefined);
  const mag0 = s.hero.magicka;
  const ev4 = [...run(s, 1, inp({ a: true })), ...run(s, 60)];
  assert.ok(!ev4.some((x) => x.t === 'magia'), 'con l’arma in mano la A non lancia');
  assert.ok(ev4.some((x) => x.t === 'colpo' && x.su === 'nemico' && x.id === e.id), 'colpo di mischia');
  assert.ok(s.hero.magicka >= mag0);
  // C e A nello stesso tick: prima si prende la magia, poi si lancia
  run(s, 30);
  assert.ok(run(s, 1, inp({ c: true, a: true })).some((x) => x.t === 'magia'));
  // senza magia preparata C non fa niente
  const senza = arena(heroBase({ magie: [], magia: null }));
  assert.deepEqual(run(senza, 1, inp({ c: true })).filter((x) => x.t === 'mano'), []);
  assert.equal(senza.hero.incanta, false);
});

test('mani: A tenuta rilancia le magie d’attacco appena sono pronte (non le evocazioni); il costo in Magicka le ferma', () => {
  const s = arena(heroBase());
  dummy(s, 8, 0);
  run(s, 1, inp({ c: true }));
  const lanci = run(s, 300, inp({ a: true })).filter((e) => e.t === 'magia').length;
  assert.ok(lanci >= 3 && lanci <= 7, `lanci in 5 s: ${lanci}`);
  assert.ok(!run(s, 300, inp({ a: true })).some((e) => e.t === 'senzaMagicka'), 'tenendo premuto non si ripete l’avviso di Magicka finita');
  const ev = arena(heroBase({ magie: [{ id: 'lupo_spettrale', scuola: 'evocazione', costo: 10, ricarica: 1, danno: 0, velocita: 0, raggio: 0, sanguina: 0, evoca: 'lupo_spettrale', durata: 20 }] }));
  run(ev, 1, inp({ c: true }));
  assert.equal(run(ev, 400, inp({ a: true })).filter((e) => e.t === 'evocato').length, 1, 'un’evocazione sola per tocco');
});

test('mani: dal menu preparare una magia la mette in mano, l’arma resta equipaggiata a riposo e si rimpugna; il tasto C scrive l’equipaggiamento', () => {
  const s = partenza();
  assert.equal(s.hero.incanta, false);
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'magia', item: 'fiammata' })!.length, 1, 'stessa magia ma le mani avevano l’arma: cambia');
  assert.equal(s.hero.incanta, true);
  assert.equal(s.equip.mano, 'magia');
  assert.equal(s.equip.arma, 'katana_legno', 'l’arma resta equipaggiata');
  assert.equal(s.hero.arma.id, 'katana_legno');
  assert.equal(dungeon.view(s).hero.magia, 'fiammata');
  assert.equal(dungeon.result(s).equip!.mano, 'magia', 'la spedizione restituisce le mani');
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'magia', item: 'fiammata' }), null, 'già in mano');
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'arma', item: 'katana_legno' }), 'impugnare l’arma a riposo la rimette in mano');
  assert.equal(s.hero.incanta, false);
  assert.equal(s.equip.mano, undefined);
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'arma', item: 'katana_legno' }), null, 'già in mano');
  // slot «mano» diretto (l'isola e la scheda lo usano per rimettere l'arma)
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'mano', item: 'magia' }));
  assert.equal(s.hero.incanta, true);
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'mano', item: null }));
  assert.equal(s.hero.incanta, false);
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'mano', item: null }), null);
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'mano', item: 'arma' }), null, 'in mano solo la magia');
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'magia', item: 'fulmine' }), null, 'non conosci questa magia');
  // il tasto C fa lo stesso e lo scrive nell'equipaggiamento
  run(s, 1, inp({ c: true }));
  assert.equal(s.hero.incanta, true);
  assert.equal(s.equip.mano, 'magia');
  run(s, 2); run(s, 1, inp({ c: true }));
  assert.equal(s.equip.mano, undefined);
  // togliere la magia libera le mani
  dungeon.act(s, { t: 'equip', slot: 'mano', item: 'magia' });
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'magia', item: null }));
  assert.equal(s.hero.incanta, false);
  assert.equal(s.equip.mano, undefined);
  assert.equal(s.runHero.magia, null);
  // il cambio interrompe il colpo in corso
  const t = partenza();
  run(t, 3, inp({ a: true }));
  assert.equal(t.hero.act, 'press');
  dungeon.act(t, { t: 'equip', slot: 'magia', item: 'fiammata' });
  assert.equal(t.hero.act, 'idle');
});

test('mani: si parte con la magia in mano se il personaggio la teneva; senza magia preparata non esiste', () => {
  const s = partenza(true);
  assert.equal(s.hero.incanta, true);
  assert.equal(s.runHero.manoMagia, true);
  // equip.mano senza magia preparata: ignorato
  const h = newHero(), senza = { ...h, equip: { ...h.equip, mano: 'magia' as const }, magie: [] as string[] };
  delete (senza.equip as Record<string, string>)['magia'];
  assert.equal(buildRunHero(senza).manoMagia, undefined);
});

test('mani sull’isola: preparare una magia la mette in mano, impugnare l’arma o togliere la magia la libera; si salva a fine spedizione', () => {
  const lot = newLot('jack', T0, null);
  const base = heroOf(lot);
  assert.equal(base.equip.mano, undefined);
  const inMano = heroOf(applyRpgAction(lot, { t: 'equip', slot: 'magia', item: 'fiammata' }, T0));
  assert.equal(inMano.equip.mano, 'magia');
  assert.equal(inMano.equip.arma, 'katana_legno');
  const lot2 = applyRpgAction(lot, { t: 'equip', slot: 'magia', item: 'fiammata' }, T0);
  assert.equal(heroOf(applyRpgAction(lot2, { t: 'equip', slot: 'mano', item: null }, T0)).equip.mano, undefined);
  assert.equal(heroOf(applyRpgAction(lot2, { t: 'equip', slot: 'arma', item: 'katana_legno' }, T0)).equip.mano, undefined);
  assert.equal(heroOf(applyRpgAction(lot2, { t: 'equip', slot: 'magia', item: null }, T0)).equip.mano, undefined);
  // le mani prendono la magia preparata anche da sole; senza magia preparata no
  assert.equal(heroOf(applyRpgAction(applyRpgAction(lot2, { t: 'equip', slot: 'mano', item: null }, T0), { t: 'equip', slot: 'mano', item: 'magia' }, T0)).equip.mano, 'magia');
  const nuda = applyRpgAction(lot, { t: 'equip', slot: 'magia', item: null }, T0);
  assert.throws(() => applyRpgAction(nuda, { t: 'equip', slot: 'mano', item: 'magia' }, T0), /Prepara/);
  assert.deepEqual(parseRpgAction({ t: 'equip', slot: 'mano', item: null }), { t: 'equip', slot: 'mano', item: null });
  assert.deepEqual(parseRpgAction({ t: 'equip', slot: 'mano', item: 'magia' }), { t: 'equip', slot: 'mano', item: 'magia' });
  // fine spedizione: le mani con la magia restano così, anche cadendo (la magia non si perde)
  const aperta = startDungeon(lot, 'grotta', 3, T0), p = aperta.dungeon!.pending!;
  const s = dungeon.create({ seed: p.seed, dungeon: 'grotta', hero: p.hero, stato: p.stato ?? null });
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'magia', item: 'fiammata' }));
  const r = dungeon.result(s);
  assert.equal(heroOf(finishDungeon(aperta, { ...r, done: true, outcome: 'uscito' }, T0 + 1).lot).equip.mano, 'magia');
  assert.equal(heroOf(finishDungeon(aperta, { ...r, done: true, outcome: 'morto' }, T0 + 1).lot).equip.mano, 'magia');
  assert.equal(heroOf(finishDungeon(aperta, { ...dungeon.result(dungeon.create({ seed: p.seed, dungeon: 'grotta', hero: p.hero, stato: p.stato ?? null })), done: true, outcome: 'uscito' }, T0 + 1).lot).equip.mano, undefined);
});

test('replay: la partita con mira e magia in mano si rigioca uguale (da solo e in squadra)', () => {
  const mira = (f: DungeonInput, st: DungeonState): DungeonInput => (f.a ? { ...f, m: ((st.tick * 7) % AIM_N) + 1 } : f);
  const { s, log } = playAuto('grotta', 7, heroBase(), mira);
  const p = packDungeon(log);
  assert.ok(p.some((r) => r.length === 5), 'il log ha delle righe con la mira');
  assert.ok(isPackedDungeon(p, dungeon.maxTicks));
  assert.deepEqual(decodeDungeon(encodeDungeon(p), dungeon.maxTicks), p);
  assert.deepEqual(replayDungeon(7, 'grotta', heroBase(), decodeDungeon(encodeDungeon(p), dungeon.maxTicks)!), dungeon.result(s));
  // la mira conta: lo stesso log senza le mire dà un'altra partita
  const senza = packDungeon(log.map((f) => { const { m: _m, ...resto } = f; return resto; }));
  assert.notEqual(replayDungeon(7, 'grotta', heroBase(), senza).hash, dungeon.result(s).hash);
  // squadra: due eroi, uno con mira e uno senza, log da replayParty
  const eroi = [{ hero: heroBase() }, { hero: heroBase() }];
  const q = createPartyRun({ seed: 5, dungeon: 'grotta', eroi });
  const rngs = eroi.map((_, i) => createRng(5 + i)), logs: DungeonInput[][] = eroi.map(() => []);
  for (let t = 0; t < 4000 && !q.eroi.every((e) => e.done); t++) {
    const fr = q.eroi.map((e, i) => (e.done ? inp() : conEroe(q, i, () => quantizeDungeon(i === 0 ? mira(dungeon.autopilot(q, rngs[i]!), q) : dungeon.autopilot(q, rngs[i]!)))));
    fr.forEach((x, i) => logs[i]!.push(x));
    stepParty(q, fr);
  }
  const live = q.eroi.map((_, i) => conEroe(q, i, () => dungeon.result(q)));
  assert.deepEqual(replayParty(5, 'grotta', eroi, { inputs: logs.map((l) => packDungeon(l)), azioni: [[], []] }), live);
});
