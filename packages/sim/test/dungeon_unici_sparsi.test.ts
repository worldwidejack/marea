// Gli unici sparsi nei dungeon (docs/UNICI.md): in ogni dungeon uno a terra, uno nei resti di un avventuriero e uno in uno scrigno (al
// Mausoleo niente resti), sempre lì e raggiungibili; si prendono a mano; i tratti nuovi `rubaVita` e `gelo` fanno quello che dicono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, spellDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { hitEnemy } from '../src/dungeon/combat.ts';
import { prendiNow } from '../src/dungeon/fruga.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { lootTable } from '../src/dungeon/tiri.ts';
import { hasItem, itemDef } from '../src/rpg/items.ts';
import { heroBase } from './dungeon_util.ts';

/** Gli unici di un dungeon fuori dal boss: a terra, nei resti, negli scrigni (voci al 100 %). */
function sparsi(id: string): { terra: string[]; resti: string[]; scrigni: string[] } {
  const d = DUNGEONS.find((x) => x.id === id)!, map = parseDungeon(d);
  const sicuri = (t: string) => lootTable(t).voci.filter((v) => v.p >= 1 && hasItem(v.item) && (itemDef(v.item).unico || itemDef(v.item).kind === 'libro')).map((v) => v.item);
  return { terra: map.oggetti.map((o) => o.item), resti: map.resti.flatMap((r) => sicuri(r.tabella)), scrigni: map.forzieri.flatMap((f) => sicuri(f.tabella)) };
}

test('unici sparsi: ogni dungeon ne ha almeno tre nuovi (due al Mausoleo), tutti unici, nessuno ripetuto', () => {
  const visti = new Set<string>();
  for (const d of DUNGEONS) {
    const u = sparsi(d.id), tutti = [...u.terra, ...u.resti, ...u.scrigni];
    assert.ok(u.terra.length >= 1 && u.scrigni.length >= 1, `${d.id}: uno a terra e uno in uno scrigno`);
    assert.ok(tutti.length >= (d.id === 'mausoleo' ? 2 : 3), `${d.id}: ${tutti.length} unici sparsi`);
    for (const it of tutti) {
      assert.ok(hasItem(it) && (itemDef(it).unico || itemDef(it).kind === 'libro'), `${d.id}: ${it} non è un unico né un libro`);
      assert.ok(!visti.has(it), `${it} sta in due posti`); visti.add(it);
      const def = itemDef(it);
      if (def.kind === 'libro') assert.ok(def.insegna, `${it}: che magia insegna?`);
    }
  }
});

test('unici sparsi: le celle sono raggiungibili dall’ingresso', () => {
  for (const d of DUNGEONS) {
    const R = d.rows, H = R.length, W = Math.max(...R.map((r) => r.length));
    const passa = (r: number, c: number) => { const ch = R[r]?.[c] ?? ' '; return ch !== '#' && ch !== ' '; };
    let st: [number, number] = [0, 0];
    R.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '<') st = [r, c]; }));
    const visto = new Set([st[0] * W + st[1]]), coda = [st];
    while (coda.length) {
      const [r, c] = coda.shift()!;
      for (const [a, b] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]] as const) if (a >= 0 && a < H && b >= 0 && b < W && passa(a, b) && !visto.has(a * W + b)) { visto.add(a * W + b); coda.push([a, b]); }
    }
    R.forEach((row, r) => [...row].forEach((ch, c) => { if ('%&$'.includes(ch)) assert.ok(visto.has(r * W + c), `${d.id}: «${ch}» in ${r},${c} non si raggiunge`); }));
  }
});

test('unici sparsi: nella partita ci sono, e quello a terra si prende a mano', () => {
  const s = dungeon.create({ seed: 7, dungeon: 'grotta', hero: heroBase() });
  const terra = s.loot.find((l) => l.tipo === 'oggetto')!, resti = s.loot.find((l) => l.tipo === 'resti')!;
  assert.deepEqual(terra.items, { unico_remo_contrabbandiere: 1 });
  assert.equal(resti.items['unico_giubba_furetto'], 1);
  assert.ok(s.loot.some((l) => l.tipo === 'forziere' && l.items['libro_lampo_faro'] === 1), 'lo scrigno col libro');
  assert.equal(prendiNow(s, terra.id), null, 'da lontano no');
  s.hero.x = terra.x + 0.5; s.hero.z = terra.z;
  assert.ok(prendiNow(s, terra.id));
  assert.equal(s.bottino['unico_remo_contrabbandiere'], 1);
  const v = dungeon.view(s).bottini.find((b) => b.id === terra.id)!;
  assert.equal(v.vuoto, true, 'preso: a terra non c’è più');
});

test('unici sparsi: rubaVita cura chi colpisce in mischia, gelo rallenta', () => {
  const s = dungeon.create({ seed: 3, dungeon: 'cripta', hero: heroBase() });
  const e = s.enemies.find((x) => !x.capo && !x.def.boss)!;
  e.vita = e.max = 1000;
  s.hero.vita = 10;
  const falce = itemDef('unico_falce_becchino').traits!, arpione = itemDef('unico_arpione_palombaro').traits!;
  const src = { danno: 40, magico: false, skill: null, caricato: false, dirX: 0, dirZ: 0, daAlleato: false } as const;
  const d = hitEnemy(s, e, { ...src, traits: falce, mischia: true });
  assert.ok(d > 0);
  assert.ok(Math.abs(s.hero.vita - (10 + d * falce.rubaVita!)) < 1e-6, `vita ${s.hero.vita} dopo ${d} di danno`);
  const prima = s.hero.vita;
  hitEnemy(s, e, { ...src, traits: falce });
  assert.equal(s.hero.vita, prima, 'una freccia o una magia non rubano vita');
  hitEnemy(s, e, { ...src, traits: arpione, mischia: true });
  assert.equal(e.lentoMolt, arpione.gelo!.molt);
  assert.ok((e.lentoT ?? 0) > s.tick);
});

test('unici sparsi: i libri insegnano magie che esistono', () => {
  let n = 0;
  for (const d of DUNGEONS) for (const it of Object.values(sparsi(d.id)).flat()) {
    const def = itemDef(it);
    if (def.kind !== 'libro') continue;
    assert.equal(spellDef(def.insegna!).id, def.insegna, it); n++;
  }
  assert.ok(n >= 7, `${n} magie nuove`);
});
