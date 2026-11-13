// La Tana del Maggiolone (isola della Difesa, docs/rpg/2h-orto.md): il terzo dungeon per difficoltà, aperto a tutti, coi nemici del gioco
// dell'orto (solo comportamenti che c'erano già), i testi comici e l'autopilota con l'eroe forte che lo finisce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { heroForte, playAuto } from './dungeon_util.ts';

const INSETTI = ['lumaca_orto', 'lumaca_ghianda', 'scarabeo_vasetto', 'cavalletta_orto', 'vespa_orto', 'bruco_scudo', 'lumaca_capobanda', 'maggiolone'];

test('orto: terzo per difficoltà (dopo Grotta e Cripta, prima del Drenaggio), aperto a tutti, sull’isola della Difesa', () => {
  const d = dungeonDef('orto');
  const ordine = [...DUNGEONS].sort((a, b) => a.difficolta - b.difficolta).map((x) => x.id);
  assert.deepEqual(ordine.slice(0, 4), ['grotta', 'cripta', 'orto', 'drenaggio']);
  assert.equal(d.richiede, undefined);
  assert.equal(d.ingresso.island, 'difesa');
});

test('orto: tutti i nemici sono insetti del gioco dell’orto; il Maggiolone sta tra il Re delle Ossa e il Capoturno', () => {
  const m = parseDungeon(dungeonDef('orto'));
  const tipi = new Set(m.nemici.map((n) => n.tipo));
  assert.deepEqual([...tipi].sort(), [...INSETTI].sort());
  for (const id of INSETTI) assert.equal(enemyDef(id).kind, 'bestia', id);
  const capo = m.nemici.find((n) => n.capo)!;
  assert.equal(capo.tipo, 'maggiolone');
  const mag = enemyDef('maggiolone'), re = enemyDef('re_ossa'), cap = enemyDef('capoturno');
  assert.ok(mag.vita > re.vita && mag.vita < cap.vita, `vita ${mag.vita}`);
  assert.ok(mag.danno <= cap.danno, `danno ${mag.danno}`);
});

test('orto: sottotitolo, 4 voci (una sola del capo) e 4 letture comiche', () => {
  const t = dungeonDef('orto').testi!;
  assert.ok(t.sottotitolo?.includes('Ondate'));
  assert.deepEqual(t.voci?.map((v) => v.id), ['ingresso', 'mensa', 'palestra', 'maggiolone']);
  assert.deepEqual(t.voci?.filter((v) => v.capo).map((v) => v.id), ['maggiolone']);
  assert.deepEqual(t.letture?.map((l) => `${l.id}:${l.tipo}`), ['regolamento:libro', 'lavagna:incisione', 'diario:libro', 'cartello:incisione']);
});

test('orto: l’autopilota con l’eroe forte batte il Maggiolone ed esce vivo', () => {
  for (const seed of [1, 2]) {
    const { s } = playAuto('orto', seed, heroForte());
    assert.equal(s.outcome, 'uscito', `seme ${seed}: ${s.outcome}`);
    assert.equal(dungeon.result(s).capo, true, `seme ${seed}: il Maggiolone è vivo`);
  }
});
