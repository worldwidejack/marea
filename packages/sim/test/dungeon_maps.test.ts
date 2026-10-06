// Mappe del Mondo Sotterraneo: forma, legenda, raggiungibilità dall'uscita, nemici e tabelle esistenti, ingressi sulle isole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS } from '@marea/content';
import { DUNGEONS, ENEMIES, LOOT } from '@marea/content/rpg.ts';
import { parseIsland } from '../src/world/grid.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { hasItem } from '../src/rpg/items.ts';

test('dungeon: tre mappe (grotta, cripta, vuoto) con stile, tile 2 e dimensioni da gioco', () => {
  assert.deepEqual(DUNGEONS.map((d) => d.id), ['grotta', 'cripta', 'vuoto']);
  for (const d of DUNGEONS) {
    assert.equal(d.tile, 2);
    assert.equal(d.stile, d.id === 'grotta' ? 'grotta' : d.id === 'cripta' ? 'cripta' : 'vuoto');
    const w = d.rows[0]!.length;
    assert.ok(d.rows.every((r) => r.length === w), `${d.id}: righe di lunghezza diversa`);
    assert.ok(w >= 36 && w <= 56 && d.rows.length >= 26 && d.rows.length <= 40, `${d.id}: ${w}×${d.rows.length}`);
  }
});

test('dungeon: una sola scala, lettere tutte in legenda, tutto il pavimento raggiungibile dall’uscita', () => {
  for (const d of DUNGEONS) {
    let scale = 0;
    for (const r of d.rows) for (const ch of r) {
      if (ch === '<') scale++;
      else if (ch !== '#' && ch !== '.' && ch !== ' ') assert.ok(d.legenda[ch], `${d.id}: '${ch}' senza legenda`);
    }
    assert.equal(scale, 1, `${d.id}: ${scale} scale`);
    const m = parseDungeon(d);
    // BFS a 4 vicini dalla scala sulle celle calpestabili
    const seen = new Uint8Array(m.w * m.h), q = [m.exit.cz * m.w + m.exit.cx];
    seen[q[0]!] = 1;
    while (q.length) {
      const i = q.pop()!, cx = i % m.w, cz = (i - cx) / m.w;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, nz = cz + dz, j = nz * m.w + nx;
        if (nx < 0 || nz < 0 || nx >= m.w || nz >= m.h || m.solid[j] || seen[j]) continue;
        seen[j] = 1; q.push(j);
      }
    }
    const lost = m.floor.filter((i) => !seen[i]);
    assert.equal(lost.length, 0, `${d.id}: celle irraggiungibili ${lost.map((i) => `${i % m.w},${Math.floor(i / m.w)}`).join(' ')}`);
    // il pavimento non tocca il bordo della mappa (niente uscite nel nulla)
    for (const i of m.floor) { const cx = i % m.w, cz = (i - cx) / m.w; assert.ok(cx > 0 && cz > 0 && cx < m.w - 1 && cz < m.h - 1, `${d.id}: pavimento sul bordo ${cx},${cz}`); }
    assert.ok(m.nemici.length >= 12, `${d.id}: ${m.nemici.length} nemici`);
    assert.ok(m.forzieri.length >= 3, `${d.id}: ${m.forzieri.length} forzieri`);
  }
});

test('dungeon: nemici, tabelle e libri esistono; i boss stanno in fondo (Cripta e Vuoto)', () => {
  const ids = new Set(ENEMIES.map((e) => e.id)), tab = new Set(LOOT.map((t) => t.id));
  for (const e of ENEMIES) assert.ok(tab.has(e.loot), `${e.id}: tabella ${e.loot} mancante`);
  for (const t of LOOT) for (const v of t.voci) {
    assert.ok(hasItem(v.item), `${t.id}: oggetto ${v.item} non nel catalogo`);
    assert.ok(v.p > 0 && v.p <= 1 && v.n[0] >= 1 && v.n[1] >= v.n[0], `${t.id}/${v.item}: voce strana`);
  }
  for (const d of DUNGEONS) {
    const m = parseDungeon(d);
    for (const n of m.nemici) assert.ok(ids.has(n.tipo), `${d.id}: nemico ${n.tipo}`);
    for (const f of m.forzieri) assert.ok(tab.has(f.tabella), `${d.id}: forziere ${f.tabella}`);
    for (const l of m.libri) assert.ok(hasItem(l.item) && l.item.startsWith('libro_'), `${d.id}: libro ${l.item}`);
    const boss = m.nemici.filter((n) => ENEMIES.find((e) => e.id === n.tipo)?.boss);
    if (d.id === 'grotta') { assert.equal(boss.length, 0); continue; }
    assert.equal(boss.length, 1, `${d.id}: un boss`);
    const b = boss[0]!, dist = Math.abs(b.cx - m.exit.cx) + Math.abs(b.cz - m.exit.cz);
    assert.ok(dist >= 20, `${d.id}: boss troppo vicino all'uscita (${dist})`);
  }
  for (const id of ['lupo_spettrale', 'scheletro_evocato']) assert.ok(ids.has(id), `alleato ${id}`);
});

test('dungeon: ingressi su celle calpestabili delle isole giuste (la Grotta raggiungibile a piedi dalla P)', () => {
  const dove: Record<string, string> = { grotta: 'selvaggia', cripta: 'porto', vuoto: 'neon' };
  for (const d of DUNGEONS) {
    assert.equal(d.ingresso.island, dove[d.id]);
    const def = ISLANDS.find((i) => i.id === d.ingresso.island)!;
    const g = parseIsland(def);
    const [cx, cz] = d.ingresso.at;
    assert.ok(g.walkable((cx + 0.5) * g.tile, (cz + 0.5) * g.tile), `${d.id}: ingresso su '${g.at(cx, cz)}'`);
    // raggiungibile a piedi dallo spawn P
    const sp = g.worldToCell(g.spawn.x, g.spawn.z);
    const seen = new Set([`${sp.cx},${sp.cz}`]), q = [[sp.cx, sp.cz] as [number, number]];
    while (q.length) {
      const [x, z] = q.pop()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
        if (seen.has(k) || !g.walkable((nx + 0.5) * g.tile, (nz + 0.5) * g.tile)) continue;
        seen.add(k); q.push([nx, nz]);
      }
    }
    assert.ok(seen.has(`${cx},${cz}`), `${d.id}: ingresso non raggiungibile dalla P`);
  }
  // la Grotta sta tra le rocce del nord
  const sel = parseIsland(ISLANDS.find((i) => i.id === 'selvaggia')!);
  const [gx, gz] = DUNGEONS[0]!.ingresso.at;
  assert.ok(gz < 15 && [[1, 0], [-1, 0], [0, -1]].some(([dx, dz]) => sel.at(gx + dx!, gz + dz!) === 'r'), 'la Grotta non è sotto le rocce');
});
