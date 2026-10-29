// Ogni dungeon ha UN oggetto unico che il boss lascia sempre (100 %): il resto del bottino resta con le sue percentuali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, enemyDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { kill } from '../src/dungeon/combat.ts';
import { lootTable } from '../src/dungeon/tiri.ts';
import { itemDef } from '../src/rpg/items.ts';
import { heroBase } from './dungeon_util.ts';

/** dungeon → unico del boss */
const UNICO: Record<string, string> = {
  grotta: 'unico_nunchaku_bandito', cripta: 'unico_martello_re', vuoto: 'unico_arco_custode', drenaggio: 'unico_corazza_marea',
  archivio: 'unico_veste_arcimago', fucina: 'unico_katana_spettro', mausoleo: 'unico_anello_onda', baita: 'unico_tavola_valanga', diga: 'unico_albero_stella', ceneri: 'unico_manto_lucignolo',
};

test('boss unici: ogni dungeon ha il suo unico, e nessun dungeon è rimasto senza', () => {
  assert.deepEqual(DUNGEONS.map((d) => d.id).sort(), Object.keys(UNICO).sort(), 'un dungeon nuovo ha bisogno del suo unico (qui e in loot.json)');
  assert.equal(new Set(Object.values(UNICO)).size, DUNGEONS.length, 'due dungeon con lo stesso unico');
  for (const u of Object.values(UNICO)) assert.equal(itemDef(u).unico, true, u);
});

test('boss unici: la tabella del boss ha il suo unico al 100 %, e solo uno', () => {
  for (const d of DUNGEONS) {
    const capi = Object.values(d.legenda).filter((v) => v.capo && v.nemico);
    assert.equal(capi.length, 1, `${d.id}: un solo capo`);
    const boss = enemyDef(capi[0]!.nemico!);
    const sicuri = lootTable(boss.loot).voci.filter((v) => v.p >= 1 && v.item.startsWith('unico_'));
    assert.deepEqual(sicuri.map((v) => v.item), [UNICO[d.id]], `${d.id}: il boss lascia sempre solo il suo unico`);
    assert.deepEqual(sicuri[0]!.n, [1, 1], d.id);
  }
});

test('boss unici: morto il boss, a terra c’è il suo unico (qualunque seed)', () => {
  for (const d of DUNGEONS) for (const seed of [1, 2, 3, 4, 5]) {
    const s = dungeon.create({ seed, dungeon: d.id, hero: heroBase() });
    const k = s.enemies.find((e) => e.capo)!;
    kill(s, k);
    const cade = s.loot.reduce((n, l) => n + (l.items[UNICO[d.id]!] ?? 0), 0);
    assert.equal(cade, 1, `${d.id} (seed ${seed}): l’unico del boss`);
  }
});

test('boss unici: il Capo dei banditi lascia il bottino di un arciere qualunque, più il Nunchaku', () => {
  const arciere = lootTable('bandito_arciere'), capo = lootTable(enemyDef('capo_banditi').loot);
  assert.deepEqual(capo.monete, arciere.monete);
  assert.deepEqual(capo.voci.filter((v) => v.item !== 'unico_nunchaku_bandito'), arciere.voci);
  assert.equal(capo.voci.find((v) => v.item === 'unico_nunchaku_bandito')?.p, 1);
});
