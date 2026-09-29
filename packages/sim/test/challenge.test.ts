// Sfide differite: flusso completo con replay della Regata, idempotenza delle operazioni per lotto, rifiuto/scadenza/parità,
// Colpo di coda, e l'invariante del libro mastro sotto operazioni concorrenti, ripetute e interrotte (come tra due Durable Object).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { acceptChallenge, actionError, closeOutcome, holdStake, isExpired, newChallenge, playTurn, refundsFor, releaseStake } from '../src/economy/challenge.ts';
import type { Release } from '../src/economy/challenge.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { EconomyError, ZERO, add, total } from '../src/economy/types.ts';
import type { Challenge, LotState, Resources } from '../src/economy/types.ts';
import { potFor } from '../src/economy/wager.ts';
import { lazyAutopilot, regata } from '../src/minigames/regata/regata.ts';
import type { MinigameResult } from '../src/minigames/types.ts';
import { packInputs, quantize, replay } from '../src/replay.ts';
import type { PackedInputs } from '../src/replay.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';

const H = 3_600_000, DAY = 24 * H;
const T = { rows: ['~~~~~~', '~gLgL~', '~gLgL~', '~.P..~', '~.dd.~', '~,B,,~'] };
const P = BALANCE.perleMedaglia;

/** Lotto con Tavolo al livello dato e risorse date (generate: il libro mastro parte in pari). */
function lotWith(owner: string, res: Resources, tavolo = 1, t = 0): LotState {
  const l = newLot(owner, t, T);
  const buildings = tavolo ? [...l.buildings, { id: 'tavolo-2', building: 'tavolo', level: tavolo, cell: [2, 1] as [number, number], buffer: 0, lastMs: t }] : l.buildings;
  return { ...l, buildings, resources: { ...res }, ledger: { generated: { ...res }, spent: { ...ZERO } } };
}
function play(seed: number, pilot: 'buono' | 'pigro'): PackedInputs {
  const s = regata.create({ seed, difficulty: 2 });
  const log: InputFrame[] = [];
  const rng = createRng(seed);
  while (!s.done) { const f = quantize(pilot === 'pigro' ? lazyAutopilot(s) : regata.autopilot(s, rng)); log.push(f); regata.step(s, f); }
  return packInputs(log);
}
const fake = (score: number, medal: MinigameResult['medal'] = null): MinigameResult => ({ done: true, score, medal, detail: {} });

test('sfida alla Regata: A gioca con l’autopilot, B accetta e gioca peggio, A prende il piatto e le Perle, ledger in pari', () => {
  const stake: Resources = { legno: 20, pietra: 0, perle: 0 };
  let a = lotWith('a', { legno: 400, pietra: 160, perle: 0 });
  let b = lotWith('b', { legno: 300, pietra: 100, perle: 0 }, 0);
  let c = newChallenge({ id: 'c1', minigame: 'regata', from: 'a', to: 'b', stake, seed: 777, nowMs: 0 });
  assert.equal(c.state, 'gioca_sfidante');
  assert.equal(c.expiresMs, BALANCE.wager.scadenzaOre * H);
  assert.equal(actionError(c, 'b', 'accept', 0), 'Aspetta che lo sfidante giochi il suo turno');
  a = holdStake(a, c.id, stake, 'apri', 0);
  assert.deepEqual(a.escrow, stake);
  const ra = replay('regata', c.seed, c.difficulty, play(c.seed, 'buono'));
  c = playTurn(c, 'a', ra);
  assert.equal(c.state, 'aperta');
  assert.equal(actionError(c, 'a', 'play', 1), 'Non è il tuo turno');
  assert.equal(actionError(c, 'b', 'accept', 1), null);
  b = holdStake(b, c.id, stake, 'accetta', 10);
  c = acceptChallenge(c, a, b);
  assert.equal(c.colpoDiCoda, false);
  const rb = replay('regata', c.seed, c.difficulty, play(c.seed, 'pigro'));
  assert.ok(ra.score > rb.score, `autopilot ${ra.score} vs pigro ${rb.score}`);
  c = playTurn(c, 'b', rb);
  const out = closeOutcome(c, 20);
  assert.equal(out.challenge.winner, 'from');
  assert.equal(out.challenge.state, 'chiusa');
  for (const r of out.releases) {
    if (r.owner === 'a') a = releaseStake(a, c.id, r.release, 20);
    else b = releaseStake(b, c.id, r.release, 20);
  }
  assert.equal(a.resources.legno, 400 + 20);
  assert.equal(b.resources.legno, 300 - 20);
  assert.equal(a.resources.perle, Math.max(ra.medal ? P[ra.medal] : 0, P.sconfitta));
  assert.equal(b.resources.perle, Math.max(rb.medal ? P[rb.medal] : 0, P.sconfitta));
  assert.deepEqual(add(a.escrow, b.escrow), ZERO);
  assert.equal(checkInvariant([a, b]), null);
});

test('idempotenza: hold e release ripetuti non addebitano né pagano due volte; release senza hold non fa niente', () => {
  const stake: Resources = { legno: 15, pietra: 5, perle: 0 };
  let a = lotWith('a', { legno: 100, pietra: 100, perle: 5 });
  a = holdStake(a, 'x', stake, 'apri', 0);
  const again = holdStake(a, 'x', stake, 'apri', 0);
  assert.deepEqual(again.resources, a.resources);
  assert.deepEqual(again.escrow, stake);
  const win: Release = { esito: 'vinta', pot: potFor(stake, true), medal: 'oro' };
  const w1 = releaseStake(a, 'x', win, 10);
  const w2 = releaseStake(w1, 'x', win, 10);
  assert.deepEqual(w2.resources, w1.resources);
  assert.equal(w1.resources.legno, 100 - 15 + 45);
  assert.deepEqual(holdStake(w2, 'x', stake, 'apri', 20).escrow, ZERO, 'una sfida regolata non si rimette in escrow');
  assert.deepEqual(releaseStake(w2, 'mai-vista', { esito: 'rimborso' }, 30).resources, w2.resources);
  assert.equal(checkInvariant([w2]), null);
});

test('rifiuto, scadenza (anche dopo l’accettazione) e parità: rimborso pieno', () => {
  const stake: Resources = { legno: 10, pietra: 10, perle: 0 };
  let a = lotWith('a', { legno: 500, pietra: 500, perle: 3 }, 1, 0);
  let b = lotWith('b', { legno: 500, pietra: 500, perle: 0 }, 0);
  // rifiutata
  let c = newChallenge({ id: 'r', minigame: 'regata', from: 'a', to: 'b', stake, seed: 1, nowMs: 0 });
  a = holdStake(a, 'r', stake, 'apri', 0);
  c = playTurn(c, 'a', fake(9000, 'argento'));
  assert.equal(actionError(c, 'a', 'decline', 1), 'Solo chi è sfidato può rispondere');
  const dec = refundsFor(c, 'rifiutata', 5);
  assert.deepEqual(dec.releases.map((r) => r.owner), ['a']);
  a = releaseStake(a, 'r', dec.releases[0]!.release, 5);
  assert.deepEqual(a.resources, { legno: 500, pietra: 500, perle: 3 });
  // scaduta dopo l'accettazione
  let e = newChallenge({ id: 'e', minigame: 'regata', from: 'a', to: 'b', stake, seed: 2, nowMs: 10 });
  a = holdStake(a, 'e', stake, 'apri', 10);
  e = playTurn(e, 'a', fake(8000));
  b = holdStake(b, 'e', stake, 'accetta', 20);
  e = acceptChallenge(e, a, b);
  assert.ok(!isExpired(e, e.expiresMs - 1));
  assert.ok(isExpired(e, e.expiresMs));
  assert.equal(actionError(e, 'b', 'play', e.expiresMs), 'Sfida scaduta');
  const exp = refundsFor(e, 'scaduta', e.expiresMs);
  assert.deepEqual(exp.releases.map((r) => r.owner), ['a', 'b']);
  a = releaseStake(a, 'e', { esito: 'rimborso' }, e.expiresMs);
  b = releaseStake(b, 'e', { esito: 'rimborso' }, e.expiresMs);
  assert.deepEqual(b.resources, { legno: 500, pietra: 500, perle: 0 });
  // parità
  let p = newChallenge({ id: 'p', minigame: 'regata', from: 'a', to: 'b', stake, seed: 3, nowMs: DAY });
  a = holdStake(a, 'p', stake, 'apri', DAY);
  p = acceptChallenge(playTurn(p, 'a', fake(100, 'bronzo')), a, holdStake(b, 'p', stake, 'accetta', DAY));
  b = holdStake(b, 'p', stake, 'accetta', DAY);
  const tie = closeOutcome(playTurn(p, 'b', fake(100, 'bronzo')), DAY + 1);
  assert.equal(tie.challenge.winner, 'pari');
  a = releaseStake(a, 'p', tie.releases[0]!.release, DAY + 1);
  b = releaseStake(b, 'p', tie.releases[1]!.release, DAY + 1);
  assert.equal(a.resources.legno, 500);
  assert.equal(b.resources.perle, P.bronzo, 'anche in parità la medaglia vale Perle');
  assert.equal(checkInvariant([a, b]), null);
});

test('Colpo di coda: chi risponde, povero, vince 1,5× il piatto; errori di creazione in italiano', () => {
  const stake: Resources = { legno: 20, pietra: 0, perle: 0 };
  let a = lotWith('ricco', { legno: 2000, pietra: 2000, perle: 0 }, 2);
  let b = lotWith('povero', { legno: 60, pietra: 0, perle: 0 }, 0);
  let c = newChallenge({ id: 'k', minigame: 'regata', from: 'ricco', to: 'povero', stake, seed: 9, nowMs: 0 });
  a = holdStake(a, 'k', stake, 'apri', 0);
  c = playTurn(c, 'ricco', fake(5000));
  b = holdStake(b, 'k', stake, 'accetta', 1);
  c = acceptChallenge(c, a, b);
  assert.ok(c.colpoDiCoda);
  const out = closeOutcome(playTurn(c, 'povero', fake(6000, 'oro')), 2);
  assert.deepEqual(out.challenge.pot, { legno: 60, pietra: 0, perle: 0 });
  b = releaseStake(b, 'k', out.releases[1]!.release, 2);
  a = releaseStake(a, 'k', out.releases[0]!.release, 2);
  assert.equal(b.resources.legno, 60 - 20 + 60);
  assert.equal(checkInvariant([a, b]), null);
  const bad = (o: Partial<Parameters<typeof newChallenge>[0]>) => () => newChallenge({ id: 'z', minigame: 'regata', from: 'a', to: 'b', stake, seed: 1, nowMs: 0, ...o });
  assert.throws(bad({ to: 'a' }), (e: unknown) => e instanceof EconomyError && /te stesso/.test(e.message));
  assert.throws(bad({ minigame: 'scacchi' }), (e: unknown) => e instanceof EconomyError && e.code === 'sconosciuto');
  assert.throws(bad({ stake: { legno: 5, pietra: 0, perle: 0 } }), (e: unknown) => e instanceof EconomyError && e.code === 'posta');
  assert.throws(() => holdStake(lotWith('x', { legno: 999, pietra: 0, perle: 0 }), 'q', { legno: 51, pietra: 0, perle: 0 }, 'apri', 0), (e: unknown) => e instanceof EconomyError && e.code === 'tetto');
});

/**
 * Coordinatore finto come quello del server: la sfida sta in un registro, le operazioni sui lotti sono messaggi in volo che possono
 * arrivare in ritardo, due volte, o perdersi (e allora il coordinatore le rimanda). Invariante controllata dopo OGNI passo.
 */
test('invariante sotto concorrenza: 3.000 passi con sfide che si incrociano, messaggi duplicati/persi, rifiuti e scadenze', () => {
  const rng = createRng('sfide-concorrenti');
  const owners = ['a', 'b', 'c', 'd', 'e'];
  const lots = new Map(owners.map((o, i) => [o, lotWith(o, { legno: 80 + i * 400, pietra: 60 + i * 300, perle: 4 + i * 10 }, 1 + (i % 3))]));
  type HoldOp = { owner: string; cid: string; kind: 'hold'; hold: 'apri' | 'accetta'; stake: Resources };
  type Op = HoldOp | { owner: string; cid: string; kind: 'release'; release: Release };
  type Row = { c: Challenge; pending: Op[]; after: Challenge | null; holding: HoldOp | null };
  const rows = new Map<string, Row>();
  let now = 0, n = 0, closed = 0, refunded = 0, rejected = 0, dup = 0;
  const apply = (op: Op): boolean => {
    const l = lots.get(op.owner)!;
    try {
      lots.set(op.owner, op.kind === 'hold' ? holdStake(l, op.cid, op.stake, op.hold, now) : releaseStake(l, op.cid, op.release, now));
      return true;
    } catch (e) { assert.ok(e instanceof EconomyError, String(e)); return false; }
  };
  const check = (step: number) => {
    const err = checkInvariant([...lots.values()]);
    assert.equal(err, null, `passo ${step}: ${err}`);
    for (const l of lots.values()) {
      for (const k of ['legno', 'pietra', 'perle'] as const) assert.ok(l.resources[k] >= 0 && l.escrow[k] >= 0, `${l.owner} ${k} negativo`);
      const held = Object.values(l.holds ?? {}).reduce((s, r) => add(s, r), { ...ZERO });
      assert.deepEqual(held, l.escrow, `${l.owner}: escrow diverso dalla somma delle poste`);
    }
  };
  const finish = (row: Row, out: { challenge: Challenge; releases: { owner: string; release: Release }[] }) => {
    row.after = out.challenge;
    row.pending = out.releases.map((r) => ({ owner: r.owner, cid: row.c.id, kind: 'release', release: r.release }));
  };
  for (let step = 0; step < 3000; step++) {
    now += rng.int(0, 12) * 60_000;
    const r = rng.next();
    const active = [...rows.values()].filter((x) => !x.after && !x.holding);
    if (r < 0.06) {
      const from = rng.pick(owners); let to = rng.pick(owners); if (to === from) to = owners[(owners.indexOf(from) + 1) % owners.length]!;
      const stake: Resources = { legno: rng.int(0, 30), pietra: rng.int(0, 20), perle: rng.int(0, 3) ? 0 : rng.int(0, 5) };
      let c: Challenge;
      try { c = newChallenge({ id: `s${n++}`, minigame: 'regata', from, to, stake, seed: rng.int(0, 1e9), nowMs: now }); } catch { rejected++; continue; }
      rows.set(c.id, { c, pending: [], after: null, holding: { owner: from, cid: c.id, kind: 'hold', hold: 'apri', stake } });
    } else if (r < 0.26) {
      const row = [...rows.values()].find((x) => x.holding && rng.next() < 0.5);
      if (!row || !row.holding) continue;
      const op = row.holding;
      if (rng.next() < 0.15) continue; // messaggio perso: il coordinatore riproverà
      const ok = apply(op);
      if (rng.next() < 0.3) { apply(op); dup++; } // consegnato due volte
      row.holding = null;
      if (!ok) { if (op.hold === 'apri') rows.delete(row.c.id); rejected++; continue; }
      if (op.hold === 'accetta') row.c = acceptChallenge(row.c, lots.get(row.c.from)!, lots.get(row.c.to)!);
    } else if (r < 0.62 && active.length) {
      const row = rng.pick(active);
      const c = row.c;
      if (isExpired(c, now)) { finish(row, refundsFor(c, 'scaduta', now)); continue; }
      if (c.state === 'gioca_sfidante') row.c = playTurn(c, c.from, fake(rng.int(0, 20), rng.pick(['oro', 'argento', null] as const)));
      else if (c.state === 'aperta') {
        if (rng.next() < 0.25) finish(row, refundsFor(c, 'rifiutata', now));
        else row.holding = { owner: c.to, cid: c.id, kind: 'hold', hold: 'accetta', stake: c.stake };
      } else if (c.state === 'accettata') finish(row, closeOutcome(playTurn(c, c.to, fake(rng.int(0, 20), rng.pick(['bronzo', null] as const))), now));
    } else {
      const withOps = [...rows.values()].filter((x) => x.pending.length);
      if (!withOps.length) continue;
      const row = rng.pick(withOps);
      const i = rng.int(0, row.pending.length - 1);
      const op = row.pending[i]!;
      if (rng.next() < 0.15) continue; // perso
      assert.ok(apply(op), 'un regolamento non deve mai fallire');
      if (rng.next() < 0.3) { apply(op); dup++; }
      row.pending.splice(i, 1);
      if (!row.pending.length && row.after) { if (row.after.state === 'chiusa') closed++; else refunded++; rows.delete(row.c.id); }
    }
    check(step);
  }
  // quiete: si chiude tutto (scadenza), si consegnano gli holds e i regolamenti rimasti
  now += 2 * DAY;
  for (const row of rows.values()) {
    if (row.holding) { if (apply(row.holding) && row.holding.hold === 'accetta') row.c = acceptChallenge(row.c, lots.get(row.c.from)!, lots.get(row.c.to)!); row.holding = null; }
    if (!row.after) finish(row, refundsFor(row.c, 'scaduta', now));
    for (const op of row.pending) assert.ok(apply(op));
  }
  check(-1);
  for (const l of lots.values()) assert.deepEqual(l.escrow, ZERO, `${l.owner}: escrow non vuoto a fine giro`);
  assert.ok(closed > 50 && refunded > 10, `chiuse ${closed}, rimborsate ${refunded}`);
  assert.ok(total([...lots.values()].reduce((s, l) => add(s, l.resources), { ...ZERO })) > 0);
  assert.ok(dup > 20);
});

test('isPackedInputs: forma, tetto dei tick, valori fuori scala', async () => {
  const { isPackedInputs } = await import('../src/replay.ts');
  assert.ok(isPackedInputs([[10, 32, -32, 1, 0], [5, 0, 0, 0, 1]], 100));
  assert.ok(!isPackedInputs([[101, 0, 0, 0, 0]], 100));
  assert.ok(!isPackedInputs([[60, 0, 0, 0, 0], [41, 0, 0, 0, 0]], 100));
  assert.ok(!isPackedInputs([[1, 33, 0, 0, 0]], 100));
  assert.ok(!isPackedInputs([[0, 0, 0, 0, 0]], 100));
  assert.ok(!isPackedInputs([[1, 0.5, 0, 0, 0]], 100));
  assert.ok(!isPackedInputs([[1, 0, 0, 2, 0]], 100));
  assert.ok(!isPackedInputs([[1, 0, 0, 0]], 100));
  assert.ok(!isPackedInputs({}, 100));
});
