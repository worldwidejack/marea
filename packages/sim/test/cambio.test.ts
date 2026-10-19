// Conversione dei vecchi salvataggi alle monete (#414, economy/cambio.ts): un lotto vero di prima (quello di Mino del 18 ott 2026, nome
// e ospiti tolti) e casi finti. Chi ha comprato tiene tutto; risorse, edifici spenti e monete del personaggio diventano monete al cambio
// fisso (balance.json `monete.cambio`); una volta sola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, building } from '@marea/content';
import { EDIFICI_SPENTI, convertiMonete, costoEdificio } from '../src/economy/cambio.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { checkMonete, inMonete } from '../src/economy/monete.ts';
import { newLot } from '../src/economy/actions.ts';
import { add, ZERO } from '../src/economy/types.ts';
import type { LotState, Resources } from '../src/economy/types.ts';
import { heroOf, newHero } from '../src/rpg/hero.ts';
import vecchio from './fixtures/lotto_vecchio_mino.json' with { type: 'json' };

/** Un lotto come lo salvava il server prima del 18 ott: niente `monete`, le monete del GDR nel personaggio. */
type Vecchio = Omit<LotState, 'monete'> & { hero?: LotState['hero'] & { monete?: number } };
const vecchioDa = (l: LotState, eroe?: number): Vecchio => {
  const { monete: _m, ledger: { monete: _lm, ...ledger }, ...resto } = l;
  return { ...resto, ledger, ...(eroe === undefined ? {} : { hero: { ...newHero(), monete: eroe } }) };
};
/** Valore atteso di un edificio spento: i livelli pagati più il deposito di Legno o Pietra. */
const valoreAtteso = (b: { building: string; level: number; buffer: number }): Resources => {
  const r = costoEdificio(b.building, b.level), res = building(b.building).produces;
  return res === 'legno' || res === 'pietra' ? { ...r, [res]: r[res] + Math.floor(b.buffer) } : r;
};

test('il lotto vero di Mino: monete giuste, tutto quello che ha comprato è ancora lì, una volta sola', () => {
  const v = vecchio as unknown as Vecchio;
  const out = convertiMonete(v);
  const spenti = v.buildings.filter((b) => EDIFICI_SPENTI.has(b.building));
  const edifici = spenti.reduce((r, b) => add(r, valoreAtteso(b)), { ...ZERO });
  const atteso = inMonete(v.resources) + inMonete(edifici) + (v.hero?.monete ?? 0);
  assert.equal(out.monete, atteso);
  assert.equal(out.cambio?.monete, atteso);
  assert.ok(atteso > 1000, `Mino aveva parecchio: ${atteso} monete`);
  console.log(`[marea] cambio di Mino: ${JSON.stringify(v.resources)} + edifici ${JSON.stringify(edifici)} + ${v.hero?.monete} monete del personaggio = ${atteso} monete`);
  // le risorse di prima sono a zero, il libro mastro di prima regge, quello delle monete parte da qui
  assert.deepEqual(out.resources, ZERO);
  assert.equal(checkInvariant([out]), checkInvariant([v as unknown as LotState]), 'l’invariante di prima non cambia');
  assert.equal(checkMonete([out]), null);
  // restano barca, botteghe e baule col loro livello; gli edifici spenti spariscono
  const lv = (l: { buildings: { building: string; level: number }[] }, id: string) => l.buildings.find((b) => b.building === id)?.level ?? 0;
  for (const id of ['molo', 'banco', 'alchimia', 'forziere']) assert.equal(lv(out, id), lv(v, id), id);
  assert.ok(out.buildings.every((b) => !EDIFICI_SPENTI.has(b.building)));
  assert.deepEqual(out.cambio?.edificiSpenti, [...new Set(spenti.map((b) => b.building))].sort());
  // chi ha comprato tiene tutto: cappelli e colori, la casa (mobili, finiture, ampliamenti), zaino e Forziere, diario
  assert.deepEqual(out.posseduti, v.posseduti);
  assert.deepEqual(out.casa, v.casa);
  assert.deepEqual(out.decor, v.decor);
  assert.deepEqual(out.forziere, v.forziere);
  assert.deepEqual(out.diario, v.diario);
  const { monete: _m, ...eroeSenza } = v.hero!;
  assert.deepEqual(heroOf(out), eroeSenza, 'il personaggio è lo stesso, senza le monete (ora nel lotto)');
  assert.ok(!('monete' in heroOf(out)));
  // una volta sola: rileggere non cambia niente
  assert.equal(convertiMonete(out), out);
});

test('edifici spenti: livelli pagati, deposito non raccolto e cantiere in corso diventano monete; quelli che restano no', () => {
  const t = 1_800_000_000_000;
  const l0 = newLot('ada', t);
  const lot: Vecchio = {
    ...vecchioDa(l0, 50),
    resources: { legno: 401, pietra: 7, perle: 10 },
    buildings: [
      ...l0.buildings,
      { id: 'segheria-2', building: 'segheria', level: 1, cell: [6, 10], buffer: 33.7, lastMs: t },
      { id: 'cava-3', building: 'cava', level: 0, cell: [12, 5], buffer: 0, lastMs: t }, // in costruzione
      { id: 'banco-4', building: 'banco', level: 1, cell: [14, 14], buffer: 0, lastMs: t },
    ],
    construction: { building: 'cava', level: 1, endsMs: t + 60_000, placedId: 'cava-3' },
    magazzinoEdifici: [
      { id: 'faro-5', building: 'faro', level: 2, buffer: 0, lastMs: t },
      { id: 'forziere-6', building: 'forziere', level: 3, buffer: 0, lastMs: t },
    ],
  };
  const out = convertiMonete(lot);
  const edifici = [costoEdificio('segheria', 1), { ...ZERO, legno: 33 }, building('cava').levels[0]!.cost, costoEdificio('faro', 2)].reduce(add, { ...ZERO });
  assert.equal(out.monete, inMonete(lot.resources) + inMonete(edifici) + 50);
  assert.equal(out.construction, null, 'il cantiere della Cava era già pagato: diventa monete');
  assert.deepEqual(out.buildings.map((b) => b.building).sort(), ['banco', 'forziere', 'molo']);
  assert.equal(out.buildings.find((b) => b.building === 'forziere')?.level, 3, 'il Forziere riposto torna fuori (il baule), col suo livello');
  assert.deepEqual(out.magazzinoEdifici, []);
  // il cantiere di un edificio che resta (la barca) continua
  const barca: Vecchio = { ...vecchioDa(l0, 0), construction: { building: 'molo', level: 2, endsMs: t + 1, placedId: 'molo' } };
  assert.deepEqual(convertiMonete(barca).construction, barca.construction);
});

test('senza personaggio arrivano le monete con cui sarebbe nato; un lotto nuovo non si converte', () => {
  const l0 = newLot('bea', 0);
  const vuoto = convertiMonete({ ...vecchioDa(l0), resources: { ...ZERO } });
  assert.equal(vuoto.monete, BALANCE.monete.partenza);
  assert.equal(vuoto.hero, undefined, 'il personaggio non si crea');
  assert.equal(convertiMonete(l0), l0, 'un lotto con le monete è già convertito');
  assert.equal(l0.monete, BALANCE.monete.partenza);
  assert.equal(checkMonete([l0]), null);
});

test('il cambio: Perle, Legno e Pietra al cambio di balance.json, arrotondato giù', () => {
  const c = BALANCE.monete.cambio;
  assert.ok(c.perle > c.legno && c.legno > 0 && c.pietra > 0, 'le Perle valgono più del Legno e della Pietra');
  assert.equal(inMonete({ perle: 1 }), Math.floor(c.perle));
  assert.equal(inMonete({ legno: 3 }), Math.floor(3 * c.legno));
  assert.equal(inMonete({ legno: 1200, pietra: 946, perle: 22 }), Math.floor(1200 * c.legno + 946 * c.pietra + 22 * c.perle));
});
