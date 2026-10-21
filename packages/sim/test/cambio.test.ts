// I salvataggi di prima diventano quelli di oggi (economy/cambio.ts): un lotto vero di prima (quello di Mino del 18 ott 2026, nome e
// ospiti tolti) e casi finti. Chi ha comprato tiene tutto; risorse, edifici spenti e monete del personaggio diventano monete al cambio
// fisso (balance.json `monete.cambio`); Molo, Banco e Forziere diventano barca, Fabbro e baule; una volta sola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '@marea/content';
import { EDIFICI_SPENTI, aggiornaSalvataggio, convertiMonete, costoEdificio, senzaGiardino } from '../src/economy/cambio.ts';
import type { LottoDiPrima } from '../src/economy/cambio.ts';
import { checkMonete, inMonete } from '../src/economy/monete.ts';
import { newLot } from '../src/economy/actions.ts';
import { chiaveDecor } from '../src/economy/decorazioni.ts';
import type { Resources } from '../src/economy/types.ts';
import { heroOf, newHero } from '../src/rpg/hero.ts';
import vecchio from './fixtures/lotto_vecchio_mino.json' with { type: 'json' };

const ZERO: Resources = { legno: 0, pietra: 0, perle: 0 };
const add = (a: Resources, b: Partial<Resources>): Resources => ({ legno: a.legno + (b.legno ?? 0), pietra: a.pietra + (b.pietra ?? 0), perle: a.perle + (b.perle ?? 0) });
const T = 1_800_000_000_000;
/** Un lotto come lo salvava il server prima del 18 ott: niente `monete`, risorse ed edifici, le monete del GDR nel personaggio. */
const vecchioDi = (extra: Partial<LottoDiPrima> = {}, eroe?: number): LottoDiPrima => ({
  owner: 'ada', version: 3, nowMs: T, resources: { ...ZERO }, escrow: { ...ZERO }, boostUntilMs: 0, construction: null,
  buildings: [{ id: 'molo', building: 'molo', level: 1, cell: [14, 20], buffer: 0 }], ledger: { generated: { ...ZERO }, spent: { ...ZERO } },
  ...(eroe === undefined ? {} : { hero: { ...newHero(), monete: eroe } }), ...extra,
});

test('il lotto vero di Mino: monete giuste, barca, Fabbro e baule col loro livello, tutto quello che ha comprato è ancora lì, una volta sola', () => {
  const v = vecchio as unknown as LottoDiPrima;
  const spenti = (v.buildings ?? []).filter((b) => EDIFICI_SPENTI.has(b.building));
  const edifici = spenti.reduce((r, b) => {
    const p = BALANCE.monete.edifici[b.building]?.produce;
    return add(add(r, costoEdificio(b.building, b.level)), p ? { [p]: Math.floor(b.buffer ?? 0) } : {});
  }, { ...ZERO });
  const atteso = inMonete(v.resources ?? {}) + inMonete(edifici) + (v.hero?.monete ?? 0);
  const out = aggiornaSalvataggio(v);
  assert.equal(out.monete, atteso);
  assert.equal(out.cambio?.monete, atteso);
  assert.ok(atteso > 1000, `Mino aveva parecchio: ${atteso} monete`);
  console.log(`[marea] cambio di Mino: ${JSON.stringify(v.resources)} + edifici ${JSON.stringify(edifici)} + ${v.hero?.monete} monete del personaggio = ${atteso} monete`);
  assert.equal(checkMonete([out]), null);
  assert.deepEqual(out.cambio?.edificiSpenti, [...new Set(spenti.map((b) => b.building))].sort());
  // il giardino non c'è più: Molo 3 → barca 3, Banco 2 → Fabbro 2, Forziere 1 (era in giardino) → baule 1 in una cella della stanza
  for (const k of ['resources', 'buildings', 'magazzinoEdifici', 'construction', 'escrow', 'boostUntilMs', 'finito', 'challenges', 'holds', 'settled', 'faro', 'decor']) assert.ok(!(k in out), k);
  assert.deepEqual(Object.keys(out.ledger), ['monete']);
  assert.equal(out.barca, 3);
  assert.equal(out.botteghe?.fabbro, 2);
  assert.equal(out.casa?.baule?.livello, 1);
  // chi ha comprato tiene tutto: cappelli e colori, la casa (mobili, finiture), zaino e Forziere, diario
  assert.deepEqual(out.posseduti, v.posseduti);
  const { baule: _b, ...casa } = out.casa!;
  assert.deepEqual(casa, v.casa);
  assert.deepEqual(out.forziere, v.forziere);
  assert.deepEqual(out.diario, v.diario);
  const { monete: _m, ...eroeSenza } = v.hero!;
  assert.deepEqual(heroOf(out), eroeSenza, 'il personaggio è lo stesso, senza le monete (ora nel lotto)');
  // una volta sola: rileggere non cambia niente
  assert.equal(aggiornaSalvataggio(out), out);
});

test('edifici spenti: livelli pagati, deposito non raccolto e cantiere in corso diventano monete; il Forziere riposto torna baule', () => {
  const lot = vecchioDi({
    resources: { legno: 401, pietra: 7, perle: 10 },
    buildings: [
      { id: 'molo', building: 'molo', level: 2, cell: [14, 20], buffer: 0 },
      { id: 'segheria-2', building: 'segheria', level: 1, cell: [6, 10], buffer: 33.7 },
      { id: 'cava-3', building: 'cava', level: 0, cell: [12, 5], buffer: 0 }, // in costruzione
      { id: 'banco-4', building: 'banco', level: 1, cell: [14, 14], buffer: 0 },
    ],
    construction: { building: 'cava', level: 1 },
    magazzinoEdifici: [{ id: 'faro-5', building: 'faro', level: 2, buffer: 0 }, { id: 'forziere-6', building: 'forziere', level: 3, buffer: 0 }],
  }, 50);
  const conv = convertiMonete(lot);
  const edifici = [costoEdificio('segheria', 1), { legno: 33 }, BALANCE.monete.edifici['cava']!.livelli[0]!, costoEdificio('faro', 2)].reduce(add, { ...ZERO });
  assert.equal(conv.monete, inMonete(lot.resources!) + inMonete(edifici) + 50);
  const out = senzaGiardino(conv);
  assert.equal(out.barca, 2);
  assert.equal(out.botteghe, undefined, 'il Banco al livello 1 è il Fabbro di serie');
  assert.equal(out.casa?.baule?.livello, 3, 'il Forziere riposto diventa il baule, col suo livello');
  assert.equal(checkMonete([out]), null);
});

test('il Forziere che stava già in casa resta nella sua cella; le decorazioni del giardino vanno nel magazzino', () => {
  const lot = vecchioDi({ buildings: [{ id: 'molo', building: 'molo', level: 1, cell: [14, 20], buffer: 0 }, { id: 'forziere-2', building: 'forziere', level: 2, cell: [13, 29], buffer: 0 }] }, 0);
  const out = aggiornaSalvataggio({ ...lot, decor: [{ id: 'barile-1', decor: 'barile', cell: [3, 3] }] } as LottoDiPrima);
  assert.deepEqual(out.casa?.baule, { livello: 2, cell: [13, 29] });
  assert.equal(out.casa?.magazzino?.[chiaveDecor('barile')], 1);
  assert.equal(out.barca, undefined, 'la barca di serie');
});

test('senza personaggio arrivano le monete con cui sarebbe nato; un lotto di oggi non cambia', () => {
  const vuoto = aggiornaSalvataggio(vecchioDi());
  assert.equal(vuoto.monete, BALANCE.monete.partenza);
  assert.equal(vuoto.hero, undefined, 'il personaggio non si crea');
  const l0 = newLot('bea', 0);
  assert.equal(aggiornaSalvataggio(l0), l0);
  assert.equal(checkMonete([l0, vuoto]), null);
});

test('il cambio: Perle, Legno e Pietra al cambio di balance.json, arrotondato giù', () => {
  const c = BALANCE.monete.cambio;
  assert.ok(c.perle > c.legno && c.legno > 0 && c.pietra > 0, 'le Perle valgono più del Legno e della Pietra');
  assert.equal(inMonete({ perle: 1 }), Math.floor(c.perle));
  assert.equal(inMonete({ legno: 3 }), Math.floor(3 * c.legno));
  assert.equal(inMonete({ legno: 1200, pietra: 946, perle: 22 }), Math.floor(1200 * c.legno + 946 * c.pietra + 22 * c.perle));
});
