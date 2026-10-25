// Il Mercante in piazza: 4 cappelli e 4 vestiti al giorno, a caso, e chi esce un giorno non torna per i 2 giorni dopo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR } from '@marea/content';
import { buyAbito, newLot, ownsAbito, vetrinaMercante, vetrinaMercanteDel } from '../src/index.ts';
import { EconomyError } from '../src/economy/types.ts';

const DAY = 86_400_000;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code;

test('vetrina del Mercante: 4 + 4 diversi, a pagamento, e niente ritorni nei 2 giorni dopo', () => {
  const m = AVATAR.mercante, dal = m.dal;
  const visti: Record<'cappelli' | 'abiti', Set<string>> = { cappelli: new Set(), abiti: new Set() };
  for (let g = dal; g < dal + 120; g++) {
    const v = vetrinaMercanteDel(g);
    for (const t of ['cappelli', 'abiti'] as const) {
      const lista = t === 'cappelli' ? AVATAR.cappelli : AVATAR.abiti;
      assert.equal(v[t].length, m[t]);
      assert.equal(new Set(v[t]).size, m[t], `${t} tutti diversi il giorno ${g}`);
      for (const id of v[t]) { assert.ok((lista.find((x) => x.id === id)?.monete ?? 0) > 0, `${id} si paga`); visti[t].add(id); }
      for (let d = 1; d <= m.riposo; d++) {
        const prima = vetrinaMercanteDel(g - d)[t];
        if (g - d >= dal) for (const id of v[t]) assert.ok(!prima.includes(id), `${id} uscito il giorno ${g - d} e di nuovo il ${g}`);
      }
    }
  }
  assert.equal(visti.cappelli.size, AVATAR.cappelli.filter((h) => h.monete > 0).length, 'in quattro mesi passano tutti i cappelli');
  assert.equal(visti.abiti.size, AVATAR.abiti.filter((a) => a.monete > 0).length, 'e tutti i vestiti');
  assert.deepEqual(vetrinaMercanteDel(dal + 50), vetrinaMercanteDel(dal + 50), 'stesso giorno, stessa vetrina');
});

test('vestiti: i gratuiti sono di tutti, gli altri dal Mercante il giorno che li ha, una volta', () => {
  const t = (AVATAR.mercante.dal + 30) * DAY + 12 * 3_600_000;
  const oggi = vetrinaMercante(t).abiti, a = AVATAR.abiti.find((x) => x.id === oggi[0])!;
  const assente = AVATAR.abiti.find((x) => x.monete > 0 && !oggi.includes(x.id))!;
  let lot = { ...newLot('a', t), monete: a.monete + 5 };
  assert.ok(ownsAbito(lot, 'base') && ownsAbito(lot, 'salopette') && ownsAbito(lot, 'felpa'));
  assert.ok(!ownsAbito(lot, a.id));
  assert.throws(() => buyAbito(lot, assente.id, t), isErr('requisito'));
  assert.throws(() => buyAbito(lot, 'base', t), isErr('cappello'));
  lot = buyAbito(lot, a.id, t);
  assert.ok(ownsAbito(lot, a.id) && lot.monete === 5 && lot.posseduti?.includes(`abito:${a.id}`));
  assert.throws(() => buyAbito(lot, a.id, t), isErr('unico'));
});
