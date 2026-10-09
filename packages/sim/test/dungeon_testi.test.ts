// Lore nei dungeon (`DungeonDef.testi`, docs/RPG.md §2c): la sim non la vede, qui si controlla che i testi stiano in piedi sulla mappa
// e che le regole di Riccardo reggano: poche voci obbligatorie e corte, letture facoltative raggiungibili e lontane dai bottoni.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, dungeonDef } from '@marea/content/rpg.ts';
import { parseDungeon } from '../src/dungeon/map.ts';

const MAX_VOCI = 4, MAX_VOCE = 140, MAX_SOTTO = 60;

/** Celle raggiungibili a piedi dalla scala coi bacini svuotati (le letture oltre l'acqua si leggono dopo la valvola). */
function raggiungibili(d: (typeof DUNGEONS)[number]): { seen: Uint8Array; w: number; h: number; solid: Uint8Array } {
  const m = parseDungeon(d), solid = m.solid.slice();
  for (const b of m.bacini) for (const i of b.celle) solid[i] = 0;
  const seen = new Uint8Array(m.w * m.h), q = [m.exit.cz * m.w + m.exit.cx];
  seen[q[0]!] = 1;
  while (q.length) {
    const i = q.pop()!, cx = i % m.w, cz = (i - cx) / m.w;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, nz = cz + dz, j = nz * m.w + nx;
      if (nx < 0 || nz < 0 || nx >= m.w || nz >= m.h || solid[j] || seen[j]) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return { seen, w: m.w, h: m.h, solid };
}

test('testi: il Drenaggio ha sottotitolo, 3 voci e 4 letture (2 libri, 2 incisioni)', () => {
  const t = dungeonDef('drenaggio').testi;
  assert.ok(t?.sottotitolo);
  assert.deepEqual(t.voci?.map((v) => v.id), ['ingresso', 'pompe', 'capoturno']);
  assert.deepEqual(t.letture?.map((l) => `${l.id}:${l.tipo}`), ['registro:libro', 'targa:incisione', 'manuale:libro', 'tacche:incisione']);
  assert.equal(t.voci?.filter((v) => v.capo).length, 1, 'parla un capo solo');
});

test('testi: poche voci e corte, zone dentro la mappa sul pavimento, id unici', () => {
  for (const d of DUNGEONS) {
    const t = d.testi;
    if (!t) continue;
    const m = parseDungeon(d), voci = t.voci ?? [];
    assert.ok(!t.sottotitolo || t.sottotitolo.length <= MAX_SOTTO, `${d.id}: sottotitolo lungo`);
    assert.ok(voci.length <= MAX_VOCI, `${d.id}: ${voci.length} voci obbligatorie (al massimo ${MAX_VOCI})`);
    assert.equal(new Set(voci.map((v) => v.id)).size, voci.length, `${d.id}: id delle voci doppi`);
    for (const v of voci) {
      assert.ok(v.testo.length > 0 && v.testo.length <= MAX_VOCE, `${d.id}/${v.id}: ${v.testo.length} caratteri (al massimo ${MAX_VOCE})`);
      assert.ok(v.chi.length > 0);
      const [x0, z0, x1, z1] = v.zona;
      assert.ok(x0 >= 0 && z0 >= 0 && x0 <= x1 && z0 <= z1 && x1 < m.w && z1 < m.h, `${d.id}/${v.id}: zona fuori mappa`);
      let pav = 0;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (m.floor.includes(z * m.w + x)) pav++;
      assert.ok(pav > 0, `${d.id}/${v.id}: zona senza pavimento`);
    }
    // le zone non si sovrappongono: in ogni stanza parla una voce sola
    for (const [i, a] of voci.entries()) for (const b of voci.slice(i + 1)) {
      const sopra = a.zona[0] <= b.zona[2] && b.zona[0] <= a.zona[2] && a.zona[1] <= b.zona[3] && b.zona[1] <= a.zona[3];
      assert.ok(!sopra, `${d.id}: zone di ${a.id} e ${b.id} sovrapposte`);
    }
  }
});

test('testi: letture raggiungibili, incisioni col muro a nord, lontane da scala, lanterne e valvole', () => {
  for (const d of DUNGEONS) {
    const letture = d.testi?.letture ?? [];
    if (!letture.length) continue;
    const m = parseDungeon(d), r = raggiungibili(d);
    assert.equal(new Set(letture.map((l) => l.id)).size, letture.length, `${d.id}: id delle letture doppi`);
    const lontano = (cx: number, cz: number, p: { cx: number; cz: number }, n: number) => Math.max(Math.abs(cx - p.cx), Math.abs(cz - p.cz)) >= n;
    for (const l of letture) {
      const [cx, cz] = l.at, i = cz * m.w + cx;
      assert.ok(l.titolo.length > 0 && l.righe.length > 0 && l.righe.every((x) => x.length > 0), `${d.id}/${l.id}: testo vuoto`);
      assert.ok(cx > 0 && cz > 0 && cx < m.w - 1 && cz < m.h - 1 && r.seen[i], `${d.id}/${l.id}: cella ${cx},${cz} non raggiungibile`);
      if (l.tipo === 'incisione') assert.equal(d.rows[cz - 1]?.[cx], '#', `${d.id}/${l.id}: l'incisione va su un muro a nord`);
      // il pannello della lanterna, il bottone della valvola e quello d'uscita non devono finire sopra LEGGI
      assert.ok(lontano(cx, cz, m.exit, 2), `${d.id}/${l.id}: troppo vicina alla scala`);
      for (const a of m.altari) assert.ok(lontano(cx, cz, a, 3), `${d.id}/${l.id}: troppo vicina a una lanterna`);
      for (const v of m.valvole) assert.ok(lontano(cx, cz, v, 2), `${d.id}/${l.id}: troppo vicina a una valvola`);
      for (const f of m.forzieri) assert.ok(lontano(cx, cz, f, 1), `${d.id}/${l.id}: sopra un forziere`);
    }
    for (const [i, a] of letture.entries()) for (const b of letture.slice(i + 1)) assert.ok(lontano(a.at[0], a.at[1], { cx: b.at[0], cz: b.at[1] }, 2), `${d.id}: ${a.id} e ${b.id} attaccate`);
  }
});
