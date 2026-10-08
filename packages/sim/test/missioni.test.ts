// Missioni del giorno della Bacheca (#64): scelta deterministica per giorno + persona, contatori di oggi, RISCUOTI una volta sola,
// azzeramento a mezzanotte UTC, libro mastro in pari. Più i contenuti del Porto (gente.json, missioni.json) validi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENTE, MISSIONI, validatePorto } from '@marea/content/porto.ts';
import { newLot } from '../src/economy/actions.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { eventiPartita, eventiRaccolta, finoAlCambio, giornoDi, missioniDelGiorno, missioniOf, riscuotiMissione, tracciaMissioni } from '../src/economy/missioni.ts';
import { EconomyError, add } from '../src/economy/types.ts';

const DAY = 86_400_000, T0 = 20_000 * DAY + 3_600_000; // un'ora dopo la mezzanotte UTC

test('porto: gente e missioni validi (un mercante, tipi che il server sa contare, abbastanza gruppi)', () => {
  assert.deepEqual(validatePorto(), []);
  assert.ok(GENTE.gente.length >= 3 && GENTE.gente.every((p) => p.battute.length >= 2));
});

test('missioni: stesse per stesso giorno e persona, cambiano tra persone e giorni; mai due dello stesso gruppo', () => {
  const day = giornoDi(T0);
  const a = missioniDelGiorno('ada', day), a2 = missioniDelGiorno('ada', day);
  assert.deepEqual(a, a2);
  assert.equal(a.length, MISSIONI.alGiorno);
  let diverse = 0;
  for (let d = 0; d < 40; d++) {
    const m = missioniDelGiorno('ada', day + d);
    const gruppi = m.map((x) => MISSIONI.tipi.find((t) => t.tipo === x.tipo)!.gruppo ?? x.tipo);
    assert.equal(new Set(gruppi).size, m.length, `gruppo ripetuto il giorno ${d}: ${m.map((x) => x.tipo)}`);
    for (const x of m) {
      const t = MISSIONI.tipi.find((y) => y.tipo === x.tipo)!;
      assert.ok(x.n >= t.n[0] && x.n <= t.n[1] && (x.n - t.n[0]) % t.passo === 0, `${x.tipo}: n ${x.n}`);
      assert.ok(!x.testo.includes('{n}'));
    }
    if (JSON.stringify(m) !== JSON.stringify(missioniDelGiorno('bruno', day + d))) diverse++;
  }
  assert.ok(diverse >= 30, `ada e bruno hanno quasi sempre le stesse missioni (${diverse}/40 diverse)`);
  const tipi = new Set<string>();
  for (let d = 0; d < 200; d++) for (const m of missioniDelGiorno('ada', day + d)) tipi.add(m.tipo);
  assert.equal(tipi.size, MISSIONI.tipi.length, 'in 200 giorni escono tutti i tipi');
});

test('missioni: i contatori salgono, RISCUOTI paga una volta sola, libro mastro in pari', () => {
  const l0 = newLot('ada', T0);
  const m = missioniOf(l0, T0).list;
  assert.ok(m.every((x) => x.fatto === 0 && !x.compiuta && !x.riscossa));
  const first = m[0]!;
  assert.throws(() => riscuotiMissione(l0, first.i, T0), (e) => e instanceof EconomyError && e.code === 'missione');
  // a metà: non basta
  let l1 = tracciaMissioni(l0, { [first.tipo]: first.n - 1 }, T0 + 1000);
  if (first.n > 1) assert.throws(() => riscuotiMissione(l1, first.i, T0 + 2000), (e) => e instanceof EconomyError && /Non ancora/.test(e.message));
  l1 = tracciaMissioni(l1, { [first.tipo]: 5, nonEsiste: 3 }, T0 + 2000);
  const st = missioniOf(l1, T0 + 2000).list[0]!;
  assert.ok(st.compiuta && st.fatto === st.n, 'compiuta');
  const out = riscuotiMissione(l1, first.i, T0 + 3000);
  assert.deepEqual(out.premio, first.premio);
  assert.deepEqual(out.lot.resources, add(l1.resources, first.premio));
  assert.equal(checkInvariant([out.lot], { legno: 0, pietra: 0, perle: 0 }), null);
  assert.ok(missioniOf(out.lot, T0 + 3000).list[0]!.riscossa);
  assert.throws(() => riscuotiMissione(out.lot, first.i, T0 + 4000), (e) => e instanceof EconomyError && /già riscosso/.test(e.message));
  assert.throws(() => riscuotiMissione(out.lot, 7, T0 + 4000), (e) => e instanceof EconomyError && e.code === 'sconosciuto');
});

test('missioni: a mezzanotte UTC contatori e riscosse si azzerano, le missioni cambiano', () => {
  const l0 = newLot('ada', T0);
  const tipi = missioniOf(l0, T0).list.map((x) => x.tipo);
  const l1 = tracciaMissioni(l0, Object.fromEntries(tipi.map((t) => [t, 999])), T0);
  assert.ok(missioniOf(l1, T0).list.every((x) => x.compiuta));
  const domani = T0 + finoAlCambio(T0) + 10;
  assert.equal(giornoDi(domani), giornoDi(T0) + 1);
  assert.ok(missioniOf(l1, domani).list.every((x) => x.fatto === 0 && !x.riscossa));
  const l2 = tracciaMissioni(l1, { partite: 1 }, domani);
  assert.equal(l2.missioni?.day, giornoDi(domani));
  assert.deepEqual(Object.keys(l2.missioni!.prog), ['partite']);
});

test('missioni: eventi di partite e raccolte; zero eventi = lotto invariato', () => {
  assert.deepEqual(eventiPartita('oro'), { partite: 1, medaglia: 1, oro: 1 });
  assert.deepEqual(eventiPartita(null), { partite: 1, medaglia: 0, oro: 0 });
  const l0 = newLot('ada', T0);
  const l1 = { ...l0, ledger: { ...l0.ledger, generated: add(l0.ledger.generated, { legno: 30, pietra: 0, perle: 0 }) } };
  assert.deepEqual(eventiRaccolta(l0, l1), { legno: 30, pietra: 0 });
  assert.equal(tracciaMissioni(l0, { legno: 0 }, T0), l0);
});
