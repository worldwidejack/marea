// Alberi dell'arena dei Templari (cipressi del cimitero, palme e lampioni): stanno solo sul bordo del campo e fermano l'eroe grandi come il
// tronco, non come la cella intera; prima un albero a due celle dal bordo lasciava davanti un muro invisibile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI } from '@marea/content/templari.ts';
import { templari } from '../src/templari/templari.ts';
import { C } from '../src/templari/mappa.ts';
import { moveCircle } from '../src/dungeon/map.ts';

test('alberi: tutti sul bordo, attaccati a una cella del campo (niente muro invisibile davanti)', () => {
  const s = templari.create({ seed: 1, opzioni: { subito: true } }), a = s.arena;
  const n = (t: string) => a.alberi.filter((x) => x.tipo === t).length;
  assert.ok(n('cipresso') >= 12 && n('palma') >= 6, `cipressi ${n('cipresso')}, palme ${n('palma')}`);
  for (const al of a.alberi) {
    const cx = Math.floor(al.x / a.tile), cz = Math.floor(al.z / a.tile);
    assert.equal(a.cell[cz * a.w + cx], C.fuori);
    const tocca = [[cx, cz + 1], [cx + 1, cz]].some(([x, z]) => a.cell[z! * a.w + x!] !== C.fuori);
    assert.ok(tocca, `${al.tipo} in ${cx},${cz} non tocca il campo`);
  }
});

test('alberi: l\'eroe arriva fino al tronco (raggio del tronco + il suo), non al bordo della cella', () => {
  const s = templari.create({ seed: 1, opzioni: { subito: true } }), a = s.arena, r = TEMPLARI.eroe.raggio;
  let provati = 0;
  for (const al of a.alberi) {
    const cx = Math.floor(al.x / a.tile), cz = Math.floor(al.z / a.tile);
    // ci si avvicina dalla cella a sud, se è calpestabile (dal campo), camminando dritti verso il tronco
    const sud = (cz + 1) * a.w + cx;
    if (s.gr.eroe.solid[sud] !== 0) continue;
    const p = { x: al.x, z: al.z + 1.5 };
    for (let i = 0; i < 120; i++) moveCircle(s.gr.eroe, p, 0, -0.02, r);
    const d = Math.sqrt((p.x - al.x) * (p.x - al.x) + (p.z - al.z) * (p.z - al.z));
    const voluto = TEMPLARI.alberi[al.tipo] + r;
    assert.ok(Math.abs(d - voluto) < 0.02, `${al.tipo} in ${cx},${cz}: fermo a ${d.toFixed(2)} m dal tronco, voluto ${voluto}`);
    assert.ok(d < a.tile / 2 + r - 0.05, `${al.tipo}: si ferma come prima (bordo della cella)`);
    provati++;
  }
  assert.ok(provati >= 5, `alberi provati: ${provati}`);
});
