// Spedizioni lato economia: apertura (fotografia + seed), chiusura (bottino, morte, consumati, usura, xp), Regata → Navigazione.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, RPG } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { hashJson } from '../src/hash.ts';
import { heroOf, newHero } from '../src/rpg/hero.ts';
import { finishDungeon, regataXp, startDungeon } from '../src/rpg/run.ts';
import type { HeroState, RunResult } from '../src/rpg/types.ts';

const T0 = 1_800_000_000_000;
const DUNGEON = DUNGEONS[0]?.id ?? 'grotta';
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code;
function lot(hero?: HeroState, forziere = 0): LotState {
  const l = newLot('jack', T0, null);
  const out: LotState = forziere ? { ...l, buildings: [...l.buildings, { id: 'forziere-2', building: 'forziere', level: forziere, cell: [1, 0], buffer: 0, lastMs: T0 }] } : l;
  return hero ? { ...out, hero } : out;
}
function result(o: Partial<RunResult>): RunResult {
  return { done: true, outcome: 'uscito', ticks: 3600, bottino: {}, monete: 0, xp: {}, usati: {}, rotti: {}, usura: {}, uccisi: {}, danniFatti: 0, danniPresi: 0, hash: 1, ...o };
}

test('rpg spedizione: si apre con fotografia e seed, la nuova sostituisce la vecchia, dungeon sconosciuto rifiutato', () => {
  const l = startDungeon(lot(), DUNGEON, 1234, T0 + 1000);
  assert.equal(l.dungeon?.pending?.dungeon, DUNGEON);
  assert.equal(l.dungeon?.pending?.seed, 1234);
  assert.equal(l.dungeon?.pending?.hero.arma.id, 'katana_legno');
  assert.ok(l.hero, 'il personaggio viene salvato nel lotto');
  const l2 = startDungeon(l, DUNGEON, 99, T0 + 2000);
  assert.equal(l2.dungeon?.pending?.seed, 99);
  assert.throws(() => startDungeon(lot(), '', 1, T0), isErr('sconosciuto'));
  assert.throws(() => startDungeon(lot(), 'x'.repeat(41), 1, T0), isErr('sconosciuto'));
  if (DUNGEONS.length) assert.throws(() => startDungeon(lot(), 'dungeon_che_non_esiste', 1, T0), isErr('sconosciuto'));
  assert.throws(() => finishDungeon(lot(), result({}), T0), isErr('spedizione'));
});

test('rpg spedizione: uscito tiene bottino, monete e xp; usati e rotti escono dallo zaino; usura aggiornata', () => {
  const h0: HeroState = { ...newHero(), inv: { ...newHero().inv, katana_vetro: 2 }, equip: { ...newHero().equip, arma: 'katana_vetro' } };
  let l = startDungeon(lot(h0), DUNGEON, 7, T0 + 1000);
  const out = finishDungeon(l, result({
    bottino: { lingotto_ferro: 5, erba_curativa: 3, oggetto_inventato: 2 }, monete: 40, xp: { armiLeggere: 400, alchimia: 0 },
    usati: { pozione_vita_minore: 1, frecce_legno: 7 }, rotti: { katana_vetro: 1 }, usura: { katana_vetro: 17 },
  }), T0 + 60_000);
  l = out.lot;
  const h = heroOf(l);
  assert.equal(l.dungeon?.pending, null);
  assert.deepEqual(out.tenuto, { erba_curativa: 3, lingotto_ferro: 5 });
  assert.equal(out.monete, 40);
  assert.equal(h.monete, RPG.partenza.monete + 40);
  assert.equal(h.inv.lingotto_ferro, 5);
  assert.equal(h.inv.pozione_vita_minore, 1);
  assert.equal(h.inv.frecce_legno, 13);
  assert.equal(h.inv.katana_vetro, 1, 'una copia rotta, l\'altra resta');
  assert.equal(h.equip.arma, 'katana_vetro');
  assert.equal(h.usura.katana_vetro, 17);
  assert.ok(h.skill.armiLeggere.lv > RPG.livelli.skillIniziale);
  assert.equal(h.discese, 1);
  assert.equal(h.morti, 0);
  assert.ok(out.livelliSu >= 1 && out.livelliSu === h.livello - 1);
  // l'ultima copia rotta: slot vuoto e usura dimenticata
  const l2 = finishDungeon(startDungeon(l, DUNGEON, 8, T0 + 70_000), result({ rotti: { katana_vetro: 1 }, usura: { katana_vetro: 3 } }), T0 + 80_000).lot;
  assert.equal(heroOf(l2).inv.katana_vetro, undefined);
  assert.equal(heroOf(l2).equip.arma, undefined);
  assert.equal(heroOf(l2).usura.katana_vetro, undefined);
});

test('rpg spedizione: morto perde il bottino e le monete della spedizione, tiene xp, usati restano persi', () => {
  const l = startDungeon(lot(), DUNGEON, 7, T0 + 1000);
  const out = finishDungeon(l, result({ outcome: 'morto', bottino: { lingotto_ferro: 5 }, monete: 40, xp: { armiLeggere: 100 }, usati: { pozione_vita_minore: 2 } }), T0 + 60_000);
  const h = heroOf(out.lot);
  assert.deepEqual(out.tenuto, {});
  assert.equal(out.monete, 0);
  assert.equal(h.inv.lingotto_ferro, undefined);
  assert.equal(h.inv.pozione_vita_minore, undefined);
  assert.equal(h.equip.pozione, undefined, 'pozione rapida finita: slot libero');
  assert.ok(h.skill.armiLeggere.lv > RPG.livelli.skillIniziale, 'l\'xp resta');
  assert.equal(h.morti, 1);
  // partita lasciata a metà (outcome null) = come la morte
  const meta = finishDungeon(startDungeon(lot(), DUNGEON, 7, T0), result({ done: false, outcome: null, bottino: { lingotto_ferro: 5 } }), T0 + 1000);
  assert.deepEqual(meta.tenuto, {});
});

test('rpg spedizione: bottino oltre il peso va nel Forziere, poi si perde', () => {
  const pieno = finishDungeon(startDungeon(lot(undefined, 1), DUNGEON, 1, T0), result({ bottino: { lingotto_ferro: 300 } }), T0 + 1000);
  const h = heroOf(pieno.lot);
  const nello = h.inv.lingotto_ferro ?? 0;
  assert.ok(nello > 80 && nello <= 93, `nello zaino ${nello}`);
  assert.equal(pieno.lot.forziere?.lingotto_ferro, 100, 'Forziere L1 = 100 kg');
  assert.equal(pieno.tenuto.lingotto_ferro, nello + 100, 'tenuto dice quanto è rimasto davvero');
  const senza = finishDungeon(startDungeon(lot(), DUNGEON, 1, T0), result({ bottino: { lingotto_ferro: 300 } }), T0 + 1000);
  assert.equal(senza.tenuto.lingotto_ferro, nello);
  assert.equal(senza.lot.forziere, undefined);
});

test('rpg spedizione: deterministica, e la Regata dà xp di Navigazione per medaglia', () => {
  const go = () => finishDungeon(startDungeon(lot(), DUNGEON, 5, T0), result({ bottino: { pepita_oro: 2 }, monete: 3, xp: { arceria: 50 } }), T0 + 5000);
  assert.equal(hashJson(go()), hashJson(go()));
  const oro = heroOf(regataXp(lot(), 'oro')).skill.navigazione;
  const nulla = heroOf(regataXp(lot(), null)).skill.navigazione;
  assert.equal(oro.xp, RPG.xp.regata_oro);
  assert.equal(nulla.xp, RPG.xp.regata_nessuna);
  assert.ok((RPG.xp.regata_oro ?? 0) > (RPG.xp.regata_argento ?? 0) && (RPG.xp.regata_argento ?? 0) > (RPG.xp.regata_bronzo ?? 0));
});

test('rpg spedizione: capo ucciso = dungeon completato (anche da morto), una volta sola; senza capo niente', () => {
  const finisci = (l: LotState, d: string, r: Partial<RunResult>) => finishDungeon(startDungeon(l, d, 1, T0), result(r), T0 + 1000).lot;
  let l = finisci(lot(), 'grotta', {});
  assert.equal(heroOf(l).completati, undefined, 'uscito senza il capo: non completato');
  l = finisci(l, 'grotta', { capo: true, outcome: 'morto' });
  assert.deepEqual(heroOf(l).completati, ['grotta']);
  l = finisci(l, 'grotta', { capo: true });
  assert.deepEqual(heroOf(l).completati, ['grotta'], 'niente doppioni');
  l = finisci(l, 'cripta', { capo: true, outcome: null, done: false });
  assert.deepEqual(heroOf(l).completati, ['grotta', 'cripta']);
});
