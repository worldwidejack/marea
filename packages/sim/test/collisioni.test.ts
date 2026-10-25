// Collisioni del Borgo Marea: forme dei solidi (cerchi e rettangoli ruotati), l'avatar che si ferma e scivola, la gente che passeggia
// per percorsi che non entrano mai in niente (rete a quadretti + A* + filo tirato), sul Borgo vero di islands.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, COLLISIONI, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { GENTE } from '@marea/content/porto.ts';
import { BOTTEGHE, BOTTEGHE_IDS } from '@marea/content/botteghe.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';
import { stepAvatar, newAvatar } from '../src/world/avatar.ts';
import { gridFromRows } from '../src/world/grid.ts';
import { createOstacoli, penetra, posaForma, solidoDi, spingiFuori } from '../src/world/ostacoli.ts';
import type { Solido } from '../src/world/ostacoli.ts';
import { cercaPercorso, creaRete } from '../src/world/cammino.ts';
import { createRng } from '../src/rng.ts';
import { NO_INPUT } from '../src/types.ts';

const PS = COLLISIONI.passeggio;
/** Un prato 20×20 celle (40 m) con la P e la B, tutto calpestabile tranne il bordo d'acqua. */
const prato = () => {
  const rows = Array.from({ length: 20 }, (_, z) => Array.from({ length: 20 }, (_, x) => (x === 0 || z === 0 || x === 19 || z === 19 ? '~' : 'g')).join(''));
  return gridFromRows('prova', rows, 2, { cx: 5, cz: 5 }, { cx: 0, cz: 0 });
};
const dentro = (os: readonly Solido[], x: number, z: number, r: number) => Math.max(0, ...os.map((o) => penetra(o, x, z, r).d));

test('collisioni: cerchio e rettangolo ruotato spingono fuori lungo la normale giusta', () => {
  const c = solidoDi({ r: 1 }, 10, 10);
  const p = spingiFuori([c], 10.5, 10, 0.5);
  assert.ok(Math.abs(p.x - 11.5) < 1e-6 && Math.abs(p.z - 10) < 1e-6, JSON.stringify(p));
  // rettangolo 4×1 (X×Z) girato di 90°: diventa 1 largo in X e 4 lungo in Z
  const b = solidoDi({ box: [4, 1] }, 0, 0, Math.PI / 2);
  assert.ok(penetra(b, 0.9, 0, 0.3).d < 0, 'a 0,9 m sul lato corto girato si è fuori');
  assert.ok(penetra(b, 0, 1.9, 0.3).d > 0, 'a 1,9 m sul lato lungo girato si è dentro');
  const q = spingiFuori([b], 0.2, 1, 0.3);
  assert.ok(Math.abs(q.x - 0.8) < 1e-6, `esce dal lato più vicino in X: ${q.x}`);
  // `at` si gira con l'oggetto (convenzione three: x' = x cos + z sin, z' = −x sin + z cos)
  const s = solidoDi({ r: 0.2, at: [1, 0] }, 0, 0, Math.PI / 2);
  assert.ok(Math.abs(s.x) < 1e-6 && Math.abs(s.z + 1) < 1e-6, JSON.stringify(s));
});

test('collisioni: l\'avatar si ferma contro la casa, ci scivola lungo e, se ci nasce dentro, ne esce', () => {
  const map = prato(), ost = createOstacoli();
  posaForma(ost, 'casa_a', 20, 20);
  const casa = ost.fissi;
  let a = newAvatar(14, 20);
  for (let i = 0; i < 180; i++) { a = stepAvatar(a, { ...NO_INPUT, mx: 1 }, map, ost); assert.ok(dentro(casa, a.x, a.z, 0.35) < 0.03, `dentro la casa al tick ${i}`); }
  assert.ok(a.x > 18 && a.x < 18.4, `fermo davanti al muro: ${a.x}`);
  // in diagonale scivola lungo il muro (si sposta in z)
  const z0 = a.z;
  for (let i = 0; i < 30; i++) a = stepAvatar(a, { ...NO_INPUT, mx: 1, my: 1 }, map, ost);
  assert.ok(a.z > z0 + 1, `scivola: ${z0} → ${a.z}`);
  // nato dentro la casa: camminando ne esce
  let b = newAvatar(20, 20);
  for (let i = 0; i < 90; i++) b = stepAvatar(b, { ...NO_INPUT, mx: -1 }, map, ost);
  assert.ok(dentro(casa, b.x, b.z, 0.35) < 0.03 && b.x < 18.5, `uscito: ${b.x}`);
  // una persona è un solido mobile: ci si ferma contro, tolta si passa
  const ost2 = createOstacoli();
  ost2.mobile('gigi', { x: 20, z: 10, r: PS.raggio });
  let c = newAvatar(16, 10);
  for (let i = 0; i < 120; i++) c = stepAvatar(c, { ...NO_INPUT, mx: 1 }, map, ost2);
  assert.ok(c.x < 20 - PS.raggio - 0.34, `fermo davanti a Gigi: ${c.x}`);
  ost2.mobile('gigi', null);
  for (let i = 0; i < 60; i++) c = stepAvatar(c, { ...NO_INPUT, mx: 1 }, map, ost2);
  assert.ok(c.x > 21, `Gigi non c'è più: si passa (${c.x})`);
});

test('cammino: il percorso gira attorno ai solidi senza mai toccarli, e null se la meta è chiusa', () => {
  const map = prato(), ost = createOstacoli();
  // un muro di siepi da nord a sud (z 3,3-30,3) con un varco a ogni capo
  for (let z = 4; z < 30; z += 1.4) posaForma(ost, 'siepe', 20, z, Math.PI / 2);
  const rete = creaRete(map, ost.fissi, { riquadro: [2, 2, 38, 38], raggio: PS.raggio, margine: PS.margine, passo: PS.passo });
  const p = cercaPercorso(rete, { x: 10, z: 10 }, { x: 30, z: 10 });
  assert.ok(p && p.length >= 3, 'serve un giro attorno al muro');
  for (let i = 1; i < p.length; i++) {
    const a: { x: number; z: number } = p[i - 1]!, b: { x: number; z: number } = p[i]!, n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05);
    for (let k = 0; k <= n; k++) {
      const x: number = a.x + ((b.x - a.x) * k) / n, z: number = a.z + ((b.z - a.z) * k) / n;
      assert.ok(dentro(ost.fissi, x, z, PS.raggio) <= 0, `tocca un solido in ${x.toFixed(2)},${z.toFixed(2)}`);
      assert.ok(map.walkable(x, z), 'in acqua');
    }
  }
  assert.ok(p.some((q) => q.z > 29.6 || q.z < 3.3), 'passa da uno dei due varchi');
  // meta dentro una siepe: non si arriva
  assert.equal(cercaPercorso(rete, { x: 10, z: 10 }, { x: 20, z: 8.2 }), null);
});

test('Borgo Marea: ogni cosa solida ha la sua forma e la gente va da un capo all\'altro senza entrare in niente', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS), T = arch.tile;
  const borgo = arch.places.find((p) => p.role === 'porto')!;
  const at = (c: readonly [number, number]) => ({ x: (borgo.origin[0] + c[0] + 0.5) * T, z: (borgo.origin[1] + c[1] + 0.5) * T });
  const ost = createOstacoli();
  const SOTTILI = new Set(['filo_borgo', 'filo_lanterne']); // festoni appesi in alto: si passa sotto
  for (const p of arch.props) if (p.island === borgo.island && !SOTTILI.has(p.k)) assert.ok(posaForma(ost, p.k, p.x, p.z, p.rot) > 0, `manca la forma di ${p.k} in collisioni.json`);
  for (const b of arch.buildings) if (b.island === borgo.island) assert.ok(posaForma(ost, b.kind, b.x, b.z, b.rot) > 0, `manca la forma dell'edificio ${b.kind}`);
  for (const id of ['mercante', 'bacheca', 'contrabbando'] as const) { const q = GENTE.posti[id], w = at(q.at); posaForma(ost, id === 'mercante' ? 'banco_mercante' : id === 'contrabbando' ? 'banco_contrabbando' : 'bacheca', w.x, w.z, q.rot); }
  for (const id of BOTTEGHE_IDS) { const q = BOTTEGHE[id].posto; if (q) { const w = at(q.at); assert.ok(posaForma(ost, 'bottega_' + id, w.x, w.z, q.rot + Math.PI) > 0, id); } }
  // il davanti di ogni banco e bottega si raggiunge
  const rete = creaRete(arch.map, ost.fissi, { riquadro: [borgo.origin[0] * T, borgo.origin[1] * T, (borgo.origin[0] + borgo.w) * T, (borgo.origin[1] + borgo.h) * T], raggio: PS.raggio, margine: PS.margine, passo: PS.passo });
  const fronti = [...(['mercante', 'bacheca', 'contrabbando'] as const).map((id) => GENTE.posti[id]), ...BOTTEGHE_IDS.flatMap((id) => (BOTTEGHE[id].posto ? [BOTTEGHE[id].posto!] : []))];
  for (const f of fronti) { const w = at(f.fronte), q = rete.vicino(w.x, w.z, f.raggio); assert.ok(q, `il davanti in ${f.fronte.join(',')} è chiuso`); }
  // chi passeggia parte vicino al suo primo punto, nella zona grande
  const passanti = GENTE.gente.filter((p) => p.velocita > 0 && p.ruolo !== 'mercante' && p.ruolo !== 'contrabbandiere');
  assert.ok(passanti.length >= 8, `passeggiano ${passanti.length}`);
  for (const p of passanti) { const w = at(p.giro[0]!); assert.ok(rete.vicino(w.x, w.z, 3), `${p.id} parte in un posto chiuso`); }
  // 30 percorsi tra mete a caso: ogni punto a più di `raggio` da ogni solido
  const mete = rete.aperti(), rng = createRng(7);
  assert.ok(mete.length > 5000, `mete ${mete.length}`);
  for (let k = 0; k < 30; k++) {
    const a = mete[rng.int(0, mete.length - 1)]!, b = mete[rng.int(0, mete.length - 1)]!;
    const p = cercaPercorso(rete, a, b);
    assert.ok(p, `da ${a.x},${a.z} a ${b.x},${b.z} non si arriva (sono nella stessa zona)`);
    for (let i = 1; i < p.length; i++) {
      const u: { x: number; z: number } = p[i - 1]!, v: { x: number; z: number } = p[i]!, n = Math.ceil(Math.hypot(v.x - u.x, v.z - u.z) / 0.1);
      for (let s = 0; s <= n; s++) { const x: number = u.x + ((v.x - u.x) * s) / n, z: number = u.z + ((v.z - u.z) * s) / n; assert.ok(dentro(ost.vicini(x, z, 1), x, z, PS.raggio) <= 0 && arch.map.walkable(x, z), `percorso ${k} tocca in ${x.toFixed(1)},${z.toFixed(1)}`); }
    }
  }
});

test('Isola delle Corse: ogni cosa solida ha la sua forma e dal molo si arriva a piedi a ogni porta', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS), T = arch.tile;
  const corse = arch.places.find((p) => p.island === 'corse')!;
  const CALPESTABILI = new Set(['strada', 'rotatoria', 'chiazza_neve']); // piatte: si cammina sopra
  const ost = createOstacoli();
  for (const p of arch.props) if (p.island === corse.island && !CALPESTABILI.has(p.k)) assert.ok(posaForma(ost, p.k, p.x, p.z, p.rot, 1, corse.island) > 0, `manca la forma di ${p.k} in collisioni.json`);
  assert.ok(ost.fissi.length > 60, `solidi sull'isola: ${ost.fissi.length}`);
  // il faro dell'isola è il suo, non quello del Borgo (r 1,3)
  assert.ok(posaForma(createOstacoli(), 'faro', 0, 0, 0, 1, corse.island) > 1 && posaForma(createOstacoli(), 'faro', 0, 0) === 1, 'il faro delle Corse ha la sua forma');
  const rete = creaRete(arch.map, ost.fissi, { riquadro: [corse.origin[0] * T, corse.origin[1] * T, (corse.origin[0] + corse.w) * T, (corse.origin[1] + corse.h) * T], raggio: PS.raggio, margine: PS.margine, passo: PS.passo });
  const da = rete.vicino(corse.spawn.x, corse.spawn.z, 3);
  assert.ok(da, 'lo sbarco è chiuso');
  // le cinque porte (e il davanti dell'arco del via) si raggiungono: i pilastri non chiudono il varco
  const porte = arch.props.filter((p) => p.island === corse.island && p.k.startsWith('porta_'));
  assert.equal(porte.length, Object.keys(MINIGAMES_CFG.corse.porte).length, 'una porta per ogni zona di corse.json');
  for (const p of porte) {
    const a = rete.vicino(p.x, p.z, 2);
    assert.ok(a, `${p.k}: il varco è chiuso`);
    const via = cercaPercorso(rete, da!, a!);
    assert.ok(via, `dal molo non si arriva a ${p.k}`);
    for (let i = 1; i < via.length; i++) {
      const u: { x: number; z: number } = via[i - 1]!, v: { x: number; z: number } = via[i]!, n = Math.ceil(Math.hypot(v.x - u.x, v.z - u.z) / 0.1);
      for (let s = 0; s <= n; s++) { const x: number = u.x + ((v.x - u.x) * s) / n, z: number = u.z + ((v.z - u.z) * s) / n; assert.ok(dentro(ost.vicini(x, z, 1), x, z, PS.raggio) <= 0, `verso ${p.k} si tocca un solido in ${x.toFixed(1)},${z.toFixed(1)}`); }
    }
  }
});
