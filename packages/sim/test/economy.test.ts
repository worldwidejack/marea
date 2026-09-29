import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ISLANDS, building } from '@marea/content';
import { parseIsland } from '../src/world/grid.ts';
import { build, collect, collectAll, newLot, placeDecor, upgrade } from '../src/economy/actions.ts';
import { advance, bufferCap, storageCap } from '../src/economy/advance.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { applyMinigameResult } from '../src/economy/rewards.ts';
import { acceptWager, cancelWager, openWager, settle, tableInfo } from '../src/economy/wager.ts';
import { EconomyError, ZERO, add, total } from '../src/economy/types.ts';
import type { LotState, Resources } from '../src/economy/types.ts';
import { createRng } from '../src/rng.ts';

const H = 3_600_000, DAY = 24 * H;
const m = parseIsland(ISLANDS[0]!);
const cell = (i: number): [number, number] => [m.lots[i]!.cx, m.lots[i]!.cz];
const lvl = (id: string, l: number) => building(id).levels[l - 1]!;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
/** Un lotto ricco con tutto costruito al livello dato (per i test di wager e rewards). */
function richLot(owner: string, t: number, tavolo = 1, faro = 0): LotState {
  const l = newLot(owner, t, m);
  const rich: Resources = { legno: 5000, pietra: 5000, perle: 100 };
  const bs = [...l.buildings];
  if (tavolo) bs.push({ id: 'tavolo-2', building: 'tavolo', level: tavolo, cell: cell(0), buffer: 0, lastMs: t });
  if (faro) bs.push({ id: 'faro-3', building: 'faro', level: faro, cell: cell(1), buffer: 0, lastMs: t });
  return { ...l, buildings: bs, resources: rich, ledger: { generated: rich, spent: { ...ZERO } } };
}

test('segheria: costruisci, aspetta, raccogli; invariante ok', () => {
  const t0 = 1_000_000;
  let lot = newLot('jack', t0, m);
  lot = build(lot, 'segheria', cell(0), t0);
  assert.equal(lot.resources.legno, BALANCE.partenza.legno - lvl('segheria', 1).cost.legno);
  assert.ok(lot.construction);
  const end = t0 + lvl('segheria', 1).seconds * 1000;
  lot = advance(lot, end + 2 * H);
  assert.equal(lot.construction, null);
  const seg = lot.buildings.find((b) => b.building === 'segheria')!;
  assert.ok(Math.abs(seg.buffer - 2 * lvl('segheria', 1).rate!) < 1e-6, `buffer ${seg.buffer}`);
  const before = lot.resources.legno;
  lot = collect(lot, seg.id, end + 2 * H);
  assert.equal(lot.resources.legno, before + Math.floor(2 * lvl('segheria', 1).rate!));
  assert.equal(checkInvariant([lot]), null);
});

test('deposito in due tempi: pieno per bufferOre, poi lento fino al tetto; il magazzino fa da tetto', () => {
  let lot = newLot('a', 0, m);
  lot = build(lot, 'segheria', cell(1), 0);
  const r = lvl('segheria', 1).rate!;
  const T0 = lvl('segheria', 1).seconds * 1000;
  const bOre = BALANCE.bufferOre;
  const q = (BALANCE as unknown as { bufferLentoQuota?: number }).bufferLentoQuota ?? 0;
  const at = (h: number) => advance(lot, T0 + h * H).buildings.find((b) => b.building === 'segheria')!.buffer;
  assert.ok(Math.abs(at(bOre) - r * bOre) < 1e-6);
  assert.ok(Math.abs(at(bOre + 4) - r * (bOre + 4 * q)) < 1e-6, 'dopo bufferOre la velocità scende a bufferLentoQuota');
  const seg = advance(lot, T0 + 10_000 * H).buildings.find((b) => b.building === 'segheria')!;
  assert.ok(Math.abs(seg.buffer - bufferCap(seg)) < 1e-6, 'tetto del deposito');
  // lazy = a passi: stesso risultato che avanzare in un colpo
  let step = lot;
  for (let h = 1; h <= 30; h++) step = advance(step, T0 + h * H);
  assert.ok(Math.abs(step.buildings.find((b) => b.building === 'segheria')!.buffer - at(30)) < 1e-6);
  lot = { ...lot, resources: { ...lot.resources, legno: storageCap(lot) - 5 } };
  const after = collect(lot, 'segheria-2', T0 + 10 * H);
  assert.equal(after.resources.legno, storageCap(lot), 'si raccoglie fino al tetto del magazzino');
  assert.ok(after.buildings.find((b) => b.building === 'segheria')!.buffer > 0, 'il resto resta nel deposito');
});

test('cantiere unico; miglioramento: produce al livello vecchio fino alla fine del cantiere', () => {
  let lot = richLot('a', 0, 0);
  lot = build(lot, 'segheria', cell(2), 0);
  assert.throws(() => build(lot, 'cava', cell(3), 1000), isErr('cantiere'));
  const t1 = lvl('segheria', 1).seconds * 1000;
  lot = upgrade(lot, 'segheria-2', t1);
  assert.throws(() => upgrade(lot, 'segheria-2', t1 + 1), isErr('cantiere'));
  const t2 = t1 + lvl('segheria', 2).seconds * 1000;
  lot = advance(lot, t2 + H);
  const seg = lot.buildings.find((b) => b.id === 'segheria-2')!;
  assert.equal(seg.level, 2);
  const expect = (lvl('segheria', 1).rate! * (t2 - t1)) / H + lvl('segheria', 2).rate!;
  assert.ok(Math.abs(seg.buffer - expect) < 1e-6, `buffer ${seg.buffer} atteso ${expect}`);
});

test('errori in italiano: risorse (con manca), unico, cella, requisito, livello massimo, sconosciuto', () => {
  const lot = newLot('a', 0, m);
  const faro = lvl('faro', 1).cost;
  assert.throws(() => build({ ...lot, resources: { ...ZERO } }, 'faro', cell(0), 0), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.legno === faro.legno && (e as EconomyError).manca!.pietra === faro.pietra);
  const l2 = build(richLot('b', 0, 0), 'segheria', cell(0), 0);
  const l3 = advance(l2, H);
  assert.throws(() => build(l3, 'segheria', cell(1), H), isErr('unico'));
  assert.throws(() => build(l3, 'cava', cell(0), H), isErr('cella'));
  assert.throws(() => build({ ...l3, buildings: l3.buildings.filter((b) => b.building !== 'molo') }, 'cava', cell(1), H), isErr('requisito'));
  assert.throws(() => upgrade(l3, 'nessuno', H), isErr('sconosciuto'));
  const max = { ...l3, buildings: l3.buildings.map((b) => (b.building === 'segheria' ? { ...b, level: building('segheria').levels.length } : b)) };
  assert.throws(() => upgrade(max, 'segheria-2', H), isErr('livello'));
});

test('decorazioni: costano Perle, cella libera', () => {
  let lot = richLot('a', 0, 0);
  lot = placeDecor(lot, 'lanterna', [3, 3], 0, 0, 5);
  assert.equal(lot.resources.perle, 95);
  assert.throws(() => placeDecor(lot, 'lanterna', [3, 3], 0, 0, 5), isErr('cella'));
  assert.throws(() => placeDecor({ ...lot, resources: { ...lot.resources, perle: 1 } }, 'torii', [4, 4], 0, 0, 5), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.perle === 4);
  assert.equal(checkInvariant([lot]), null);
});

test('minigiochi: Perle per medaglia (mai zero), il Faro si accende solo con la vittoria e non si somma', () => {
  const P = BALANCE.perleMedaglia;
  let lot = richLot('a', 0, 0, 1);
  lot = applyMinigameResult(lot, { medal: 'oro' }, 0);
  assert.equal(lot.resources.perle, 100 + P.oro);
  const hours = lvl('faro', 1).boostHours!;
  assert.equal(lot.boostUntilMs, hours * H);
  lot = applyMinigameResult(lot, { medal: null, esito: 'sconfitta' }, H);
  assert.equal(lot.resources.perle, 100 + P.oro + P.sconfitta);
  assert.equal(lot.boostUntilMs, hours * H, 'la sconfitta non accende il Faro');
  lot = applyMinigameResult(lot, { medal: 'bronzo', esito: 'vittoria' }, H);
  assert.equal(lot.boostUntilMs, H + hours * H, 'si rinnova da adesso, non si somma');
  assert.equal(checkInvariant([lot]), null);
  // produzione col Faro: +boost solo dentro la finestra
  let s = richLot('s', 0, 0, 1);
  s = { ...s, buildings: [...s.buildings, { id: 'seg', building: 'segheria', level: 1, cell: cell(4), buffer: 0, lastMs: 0 }] };
  s = applyMinigameResult(s, { medal: 'oro' }, 0);
  const b = advance(s, 4 * H).buildings.find((x) => x.id === 'seg')!.buffer;
  const r = lvl('segheria', 1).rate!, k = lvl('faro', 1).boost!;
  assert.ok(Math.abs(b - r * (hours * k + (4 - hours))) < 1e-6, `buffer col Faro ${b}`);
});

test('wager: serve il Tavolo, posta tra minimo e tetto, sfide gratis poi 1 Perla, escrow e rimborso', () => {
  const t0 = 10 * DAY;
  assert.throws(() => openWager(richLot('a', t0, 0), { ...ZERO, legno: 20 }, t0), isErr('requisito'));
  let a = richLot('a', t0, 1);
  const T = lvl('tavolo', 1);
  assert.throws(() => openWager(a, { ...ZERO, legno: BALANCE.wager.min - 1 }, t0), isErr('posta'));
  assert.throws(() => openWager(a, { ...ZERO, legno: T.wagerMax! + 1 }, t0), isErr('tetto'));
  assert.throws(() => openWager(a, { ...ZERO, legno: 10.5 }, t0), isErr('posta'));
  const stake: Resources = { legno: 20, pietra: 10, perle: 0 };
  for (let i = 0; i < T.freeChallenges!; i++) a = openWager(a, stake, t0 + i);
  assert.equal(a.resources.perle, 100, 'le prime sono gratis');
  a = openWager(a, stake, t0 + 10);
  assert.equal(a.resources.perle, 100 - BALANCE.wager.costoExtraPerle, 'oltre le gratis costa una Perla');
  assert.deepEqual(a.escrow, { legno: 20 * (T.freeChallenges! + 1), pietra: 10 * (T.freeChallenges! + 1), perle: 0 });
  assert.equal(tableInfo(advance(a, t0 + DAY)).usedToday, 0, 'il giorno dopo si riparte');
  a = openWager(a, stake, t0 + DAY);
  assert.equal(a.resources.perle, 100 - BALANCE.wager.costoExtraPerle);
  const poor = { ...a, resources: { ...ZERO, perle: 0, legno: 20, pietra: 10 }, challenges: { day: Math.floor((t0 + DAY) / DAY), used: 99 } };
  assert.throws(() => openWager(poor, stake, t0 + DAY), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.perle === 1);
  const c = cancelWager(a, stake, t0 + DAY);
  assert.equal(c.resources.legno, a.resources.legno + 20);
  assert.throws(() => cancelWager({ ...a, escrow: { ...ZERO } }, stake, t0 + DAY), isErr('escrow'));
  assert.equal(checkInvariant([a]), null);
  assert.equal(checkInvariant([c]), null);
});

test('settle: vincita, parità, Colpo di coda solo per chi risponde', () => {
  const stake: Resources = { legno: 30, pietra: 0, perle: 10 };
  const rich = openWager(richLot('ricco', 0, 1), stake, 0);
  const poorBase = newLot('povero', 0, m);
  const poor = acceptWager({ ...poorBase, resources: { legno: 100, pietra: 0, perle: 20 }, ledger: { generated: { legno: 100, pietra: 0, perle: 20 }, spent: { ...ZERO } } }, stake, 0);
  const win = settle(rich, poor, stake, 'b');
  assert.ok(win.colpoDiCoda);
  assert.deepEqual(win.b.resources, add(poor.resources, { legno: 90, pietra: 0, perle: 30 }));
  assert.equal(checkInvariant([win.a, win.b]), null);
  const lose = settle(rich, poor, stake, 'a');
  assert.equal(lose.colpoDiCoda, false);
  assert.deepEqual(lose.a.resources, add(rich.resources, add(stake, stake)));
  assert.equal(checkInvariant([lose.a, lose.b]), null);
  const tie = settle(rich, poor, stake, null);
  assert.deepEqual(tie.a.resources, add(rich.resources, stake));
  assert.deepEqual(tie.b.escrow, ZERO);
  assert.equal(checkInvariant([tie.a, tie.b]), null);
});

test('invariante del libro mastro su 1.000 wager casuali tra 4 lotti (con Colpo di coda, parità, annulli, raccolte)', () => {
  const rng = createRng('ledger');
  let lots = ['a', 'b', 'c', 'd'].map((o, i) => {
    const l = richLot(o, 0, 1 + (i % 3), 1);
    const res = { legno: 50 + i * 900, pietra: 50 + i * 600, perle: 5 + i * 20 };
    return { ...l, resources: res, ledger: { generated: res, spent: { ...ZERO } }, buildings: [...l.buildings, { id: 'seg', building: 'segheria', level: 1, cell: cell(3), buffer: 0, lastMs: 0 }] };
  });
  let t = 0, settled = 0, cdc = 0, errors = 0;
  for (let i = 0; i < 1000; i++) {
    t += rng.int(1, 120) * 60_000;
    const ia = rng.int(0, 3);
    let ib = rng.int(0, 2);
    if (ib >= ia) ib++;
    const stake: Resources = { legno: rng.int(0, 40), pietra: rng.int(0, 30), perle: rng.int(0, 1) ? rng.int(0, 10) : 0 };
    try {
      let a = openWager(lots[ia]!, stake, t);
      let b: LotState;
      try { b = acceptWager(lots[ib]!, stake, t); } catch { a = cancelWager(a, stake, t); lots[ia] = a; errors++; continue; }
      const r = rng.next();
      const winner = r < 0.45 ? 'a' : r < 0.9 ? 'b' : null;
      const out = settle(a, b, stake, winner);
      if (out.colpoDiCoda) cdc++;
      lots[ia] = applyMinigameResult(out.a, { medal: winner === 'a' ? 'oro' : null, esito: winner === 'a' ? 'vittoria' : winner ? 'sconfitta' : 'parita' }, t);
      lots[ib] = applyMinigameResult(out.b, { medal: winner === 'b' ? 'argento' : null, esito: winner === 'b' ? 'vittoria' : winner ? 'sconfitta' : 'parita' }, t);
      settled++;
    } catch (e) {
      assert.ok(e instanceof EconomyError, String(e));
      errors++;
    }
    if (i % 7 === 0) lots = lots.map((l) => collectAll(l, t));
    const err = checkInvariant(lots);
    assert.equal(err, null, `wager ${i}: ${err}`);
    for (const l of lots) for (const k of ['legno', 'pietra', 'perle'] as const) assert.ok(l.resources[k] >= 0 && l.escrow[k] >= 0, `${l.owner} ${k} negativo`);
  }
  assert.ok(settled > 300, `regolati ${settled}`);
  assert.ok(cdc > 0, 'il Colpo di coda deve capitare');
  assert.ok(total(lots.reduce((s, l) => add(s, l.escrow), { ...ZERO })) === 0, 'escrow vuoto alla fine');
  console.log(`[marea] ledger: ${settled} wager regolati, ${cdc} colpi di coda, ${errors} rifiutati`);
});
