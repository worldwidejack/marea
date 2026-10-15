// Gli eroi del menù d'ingresso (docs/TEMPLARI.md §4b): partono con le loro armi, la loro vita e (il Crociato) lo scudo; fanno più male
// con le loro armi; il super si carica uccidendo e si usa con SUPER (input e); il server rigioca la partita con l'eroe uguale; senza eroe
// la partita è quella di prima (stesso hash).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, armaDef, eroeDef, validateTemplari } from '@marea/content/templari.ts';
import { stepTemplari, stepTemplariInsieme, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { armaIn, nuovoZombie, usa, vitaOndata } from '../src/templari/stato.ts';
import { colpisci, ferisci } from '../src/templari/colpi.ts';
import { replayTemplari, replayTemplariInsieme } from '../src/templari/replay.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import { createRng } from '../src/rng.ts';
import type { TClasse } from '@marea/content/templari.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import type { TOpzioni } from '../src/templari/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number, inp: Partial<DungeonInput> = {}) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, { ...F, ...inp }); };
function partita(classe: TClasse | null, ondata = 6): TState {
  const s = templari.create({ seed: 7, opzioni: { subito: true, ...(classe ? { classi: [classe] } : {}) } });
  s.fase = 'combatti'; s.ondata = ondata; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  return s;
}
/** Uno zombie a `d` m davanti all'eroe, già in piedi e fermo. */
function davanti(s: TState, d: number, tipo = 'fante') {
  const h = s.eroe, z = nuovoZombie(s, tipo, h.x + h.fx * d, h.z + h.fz * d, 0);
  z.st = 'insegue'; z.vel = 0; z.fx = -h.fx; z.fz = -h.fz;
  return z;
}

test('i dati degli eroi sono validi: tre eroi, armi che esistono, barre da 1 a 5', () => {
  assert.deepEqual(validateTemplari(), []);
  assert.deepEqual(TEMPLARI.eroi.map((e) => e.id), ['crociato', 'bucaniera', 'arciere']);
});

test('ogni eroe parte con le sue armi e la sua vita; il Crociato con lo scudo sulle spalle', () => {
  for (const e of TEMPLARI.eroi) {
    const s = partita(e.id), h = s.eroe, v = templari.view(s);
    assert.equal(h.classe, e.id);
    assert.deepEqual(h.armi.map((x) => x?.id ?? null), e.armi);
    assert.equal(h.vita, e.vita); assert.equal(h.max, e.vita);
    assert.equal(!!h.scudo, !!e.scudo, e.id);
    assert.equal(v.eroe.classe, e.id); assert.equal(v.eroe.super, 0);
  }
  const s = partita(null);
  assert.equal(s.eroe.classe, null);
  assert.deepEqual(s.eroe.armi.map((x) => x?.id ?? null), [TEMPLARI.partenza.arma, null]);
  assert.equal(s.eroe.max, TEMPLARI.eroe.vita);
});

test('ognuno è più forte con le sue armi: danno, ricarica della Bucaniera, arco teso prima dall\'Arciere', () => {
  const cro = partita('crociato'), buc = partita('bucaniera'), arc = partita('arciere'), nes = partita(null);
  assert.equal(armaIn(cro).danno, armaDef('spada').danno * eroeDef('crociato')!.danno.mischia!);
  assert.equal(armaIn(nes).danno, armaDef('spada').danno);
  assert.equal(armaIn(buc).danno, armaDef('pistola').danno * eroeDef('bucaniera')!.danno.fuoco!);
  assert.ok(armaIn(buc).ricarica! < armaDef('pistola').ricarica!);
  assert.ok(armaIn(arc).tempo < armaDef('arco').tempo);
  assert.equal(armaIn(arc).danno, armaDef('arco').danno * eroeDef('arciere')!.danno.arco!);
  // la spada della Bucaniera è una spada qualunque
  buc.eroe.cur = 1;
  assert.equal(armaIn(buc).danno, armaDef('spada').danno);
});

test('il Crociato regge un colpo in più; la Zuppa di pietra gli dà +100 sulla sua vita', () => {
  const s = partita('crociato');
  s.eroe.scudo = null;
  for (let i = 0; i < 3; i++) ferisci(s, 45, s.eroe.x + s.eroe.fx, s.eroe.z + s.eroe.fz);
  assert.ok(!s.done && s.eroe.vita > 0, 'cade al terzo colpo');
  const z = partita('crociato');
  for (const k in z.fuochi) z.fuochi[k] = true;
  const p = z.arena.personaggi.find((x) => x.id === 'strega')!;
  z.eroe.x = p.x - p.fx * 0.6; z.eroe.z = p.z - p.fz * 0.6; z.eroe.punti = 10000;
  templari.act(z, { t: 'compra', da: 'strega', cosa: 'pietra' });
  assert.equal(z.eroe.max, eroeDef('crociato')!.vita + 100);
});

test('la Bucaniera corre più svelta del Crociato', () => {
  const a = partita('bucaniera'), b = partita('crociato');
  passi(a, 60, { mx: 0.6 }); passi(b, 60, { mx: 0.6 });
  const da = Math.abs(a.eroe.x - a.arena.spawn.x), db = Math.abs(b.eroe.x - b.arena.spawn.x);
  assert.ok(da > db * 1.1, `${da} contro ${db}`);
});

test('il super si carica uccidendo (non col super stesso) e senza eroe non c\'è', () => {
  const s = partita('crociato'), n = eroeDef('crociato')!.super.uccisioni;
  for (let i = 0; i < n - 1; i++) { const z = davanti(s, 1.2); colpisci(s, z, { danno: 1e6, mischia: true, caricato: false, dirX: 0, dirZ: 1, spinta: 0 }); }
  assert.ok(s.eroe.superK < 1 && s.eroe.superK > 0.9);
  s.eventi = [];
  const z = davanti(s, 1.2);
  colpisci(s, z, { danno: 1e6, mischia: true, caricato: false, dirX: 0, dirZ: 1, spinta: 0 });
  assert.equal(s.eroe.superK, 1);
  assert.ok(s.eventi.some((e) => e.t === 'superPronto'));
  const nes = partita(null), y = davanti(nes, 1.2);
  colpisci(nes, y, { danno: 1e6, mischia: true, caricato: false, dirX: 0, dirZ: 1, spinta: 0 });
  assert.equal(nes.eroe.superK, 0);
  // scarico non parte
  const t = partita('arciere');
  passi(t, 2, { e: true });
  assert.ok(!t.fiamme.length && !t.eventi.some((e) => e.t === 'super'));
});

test('Giudizio: uccide chi sta attorno (anche lo scudato da davanti), spinge via, non tocca chi è lontano', () => {
  const s = partita('crociato', 8);
  s.eroe.superK = 1;
  const vicino = davanti(s, 1.5), scudato = davanti(s, 2.5, 'scudato'), lontano = davanti(s, 9);
  passi(s, 1, { e: true });
  assert.equal(vicino.st, 'morto'); assert.equal(scudato.st, 'morto');
  assert.notEqual(lontano.st, 'morto');
  assert.equal(s.eroe.superK, 0, 'il super si scarica');
  assert.ok(s.eroe.intoccabile > s.tick, 'qualche istante intoccabile');
});

test('Bordata: tre cannonate cadono dove miri dopo un attimo; il boss perde una fetta, non muore', () => {
  const s = partita('bucaniera', 10);
  s.eroe.superK = 1;
  const z = davanti(s, 7), boss = davanti(s, 8, 'cavaliere');
  passi(s, 1, { e: true });
  assert.equal(s.cannonate.length, eroeDef('bucaniera')!.super.colpi);
  assert.notEqual(z.st, 'morto', 'subito no: le palle volano');
  passi(s, 90);
  assert.equal(s.cannonate.length, 0);
  assert.equal(z.st, 'morto');
  assert.ok(boss.st !== 'morto' && boss.vita < boss.max, `${boss.vita}/${boss.max}`);
});

test('Pioggia di frecce: un cerchio sul bersaglio che uccide chi ci sta sotto, poi finisce', () => {
  const s = partita('arciere', 8);
  s.eroe.superK = 1;
  const z = davanti(s, 6);
  passi(s, 1, { e: true });
  const f = s.fiamme.find((x) => x.frecce)!;
  assert.ok(f, 'niente pioggia');
  assert.ok(Math.abs(f.x - z.x) < 0.01 && Math.abs(f.z - z.z) < 0.01, 'non sul bersaglio');
  assert.equal(f.dps, vitaOndata(8) * eroeDef('arciere')!.super.danno);
  passi(s, 120);
  assert.equal(z.st, 'morto');
  assert.ok(templari.view(s).fiamme.some((x) => x.frecce));
  passi(s, 200);
  assert.ok(!s.fiamme.some((x) => x.frecce));
});

/** Una partita vera giocata dall'autopilota, coi suoi input. */
function gioca(opzioni: TOpzioni, ticks: number) {
  const s = templari.create({ seed: 11, opzioni }), rng = createRng(5), frames: DungeonInput[] = [];
  for (let i = 0; i < ticks && !s.done; i++) { const f = quantizeDungeon(templari.autopilot(s, rng)); frames.push(f); stepTemplari(s, f); }
  return { s, packed: packDungeon(frames) };
}

test('il server rigioca la partita con l\'eroe e torna uguale; con un altro eroe no', () => {
  const { s, packed } = gioca({ subito: true, classi: ['bucaniera'] }, 60 * 90);
  const r = templari.result(s);
  assert.ok(r.uccisioni > 0);
  assert.deepEqual(replayTemplari(11, { subito: true, classi: ['bucaniera'] }, packed), r);
  assert.notEqual(replayTemplari(11, { subito: true, classi: ['crociato'] }, packed).hash, r.hash);
});

test('senza eroe la partita è quella di prima: le opzioni non cambiano, l\'hash nemmeno', () => {
  const a = gioca({ subito: true }, 60 * 30), b = gioca({ subito: true, classi: [null] }, 60 * 30);
  assert.deepEqual(a.s.opzioni, { subito: true });
  assert.deepEqual(b.s.opzioni, { subito: true });
  assert.equal(templari.result(a.s).hash, templari.result(b.s).hash);
});

test('insieme: ognuno col suo eroe; il replay della squadra li usa', () => {
  const classi: (TClasse | null)[] = ['crociato', 'arciere'];
  const s = templari.create({ seed: 4, opzioni: { subito: true, eroi: 2, classi } }), rng = createRng(2);
  assert.deepEqual(s.eroi.map((h) => h.classe), classi);
  assert.equal(templari.view(s, 0).compagni[0]!.classe, 'arciere');
  const fr: DungeonInput[][] = [[], []];
  for (let i = 0; i < 60 * 40 && !s.done; i++) {
    const ins = [0, 1].map((k) => { usa(s, k); return quantizeDungeon(templari.autopilot(s, rng)); });
    usa(s, 0);
    ins.forEach((f, k) => fr[k]!.push(f));
    stepTemplariInsieme(s, ins);
  }
  const r = replayTemplariInsieme(4, fr.map((f) => packDungeon(f)), [null, null], 0, [], classi);
  assert.equal(r.hash, templari.result(s).hash);
});
