// Gli ampliamenti della casa (#386): il mobiliere ingrandisce la stanza un livello alla volta (monete, #414); le stanze crescono senza
// perdere celle, i mobili a muro vanno col muro, il server non paga due volte, la collisione chiude le celle non ancora sbloccate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BORGO, MOBILI } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { ampliaCasa, ampliatoOggi, compraMobile, livelloLotto, posaMobile, postoMobileError } from '../src/economy/casa.ts';
import { decorCellError, fitToTemplate, inStanza, lotTemplate } from '../src/economy/cells.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { LIVELLI_CASA, MAX_LIVELLO_CASA, PIANTE_MAX, livelloCasa, prossimoAmpliamento, scaleDi, stanzaAt, stanzaTerra, stanzeDi } from '../src/economy/stanze.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { conMonete } from './monete_util.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';
import { mascheraCase } from '../src/world/casa_mappa.ts';
import { stepAvatar, newAvatar } from '../src/world/avatar.ts';
import { ARCHIPELAGO, ISLANDS } from '@marea/content';
import { NO_INPUT } from '../src/types.ts';

const DAY = 24 * 3600_000;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
const T = lotTemplate()!, ST = BORGO.stanza;
const terra = MOBILI.find((m) => m.posto === 'terra' && !m.celle)!, parete = MOBILI.find((m) => m.posto === 'parete')!;
/** Un lotto con tutte le monete che servono (entrano nel libro mastro come premio, così l'invariante regge). */
function ricco(): LotState {
  return conMonete(newLot('a', 0, T), 30_000);
}
const su = (lot: LotState, n: number, t0 = lot.nowMs || 1000): LotState => {
  for (let i = 0; i < n; i++) lot = ampliaCasa(lot, livelloLotto(lot), t0 + (i + 1) * DAY);
  return lot;
};

test('la tabella: ordine, costi che si pagano davvero, rettangoli annidati e dentro la pianta del template', () => {
  assert.ok(MAX_LIVELLO_CASA >= 3);
  let prima = ST.pavimento as readonly number[];
  for (const [i, l] of LIVELLI_CASA.entries()) {
    assert.equal(prossimoAmpliamento(i), l);
    assert.ok(Number.isInteger(l.monete) && l.monete > 0, l.id);
    if (l.stanza === 'terra') {
      assert.ok(l.pavimento[0] <= prima[0]! && l.pavimento[1] <= prima[1]! && l.pavimento[2] >= prima[2]! && l.pavimento[3] === prima[3]!, `${l.id} non contiene la stanza di prima`);
      prima = l.pavimento;
    }
    for (let z = l.pavimento[1]; z < l.pavimento[3]; z++) for (let x = l.pavimento[0]; x < l.pavimento[2]; x++) assert.ok('.LP'.includes(T.rows[z]![x]!), `${l.id}: ${x},${z} non è pavimento`);
  }
  assert.equal(prossimoAmpliamento(MAX_LIVELLO_CASA), null);
  // costano sempre di più (si suda): il prezzo sale a ogni livello
  for (let i = 1; i < LIVELLI_CASA.length; i++) assert.ok(LIVELLI_CASA[i]!.monete > LIVELLI_CASA[i - 1]!.monete, 'il prezzo non sale');
});

test('ampliaCasa: un livello alla volta, paga in monete, libro mastro in pari; il massimo si ferma', () => {
  let lot = ricco();
  const prima = lot.monete;
  lot = ampliaCasa(lot, 0, 1000);
  assert.equal(livelloLotto(lot), 1);
  assert.equal(lot.monete, prima - LIVELLI_CASA[0]!.monete);
  assert.equal(checkInvariant([lot]), null);
  assert.equal(checkMonete([lot]), null);
  lot = su(lot, MAX_LIVELLO_CASA - 1);
  assert.equal(livelloLotto(lot), MAX_LIVELLO_CASA);
  assert.throws(() => ampliaCasa(lot, MAX_LIVELLO_CASA, 2000), isErr('livello'));
  assert.equal(checkInvariant([lot]), null);
  assert.equal(checkMonete([lot]), null);
});

test('ampliaCasa: senza abbastanza non cambia niente («risorse», con quanto manca); un livello vecchio (doppio tocco) non paga due volte', () => {
  const lot = ricco(), povero = { ...lot, monete: 5 };
  assert.throws(() => ampliaCasa(povero, 0, 1000), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.monete === LIVELLI_CASA[0]!.monete - 5);
  const uno = ampliaCasa(lot, 0, 1000);
  assert.throws(() => ampliaCasa(uno, 0, 1001), isErr('livello'));
  assert.equal(uno.monete, lot.monete - LIVELLI_CASA[0]!.monete, 'pagato una volta sola');
  assert.throws(() => ampliaCasa(lot, 1.5, 1000), isErr('livello'));
  assert.throws(() => ampliaCasa(lot, -1, 1000), isErr('livello'));
});

test('ampliaCasa: al massimo un ampliamento al giorno (giornoRoma); il giorno dopo si può ancora', () => {
  let lot = ricco();
  assert.equal(ampliatoOggi(lot, 1000), false);
  lot = ampliaCasa(lot, 0, 1000);
  assert.equal(livelloLotto(lot), 1);
  assert.equal(ampliatoOggi(lot, 1000), true);
  // stesso giorno: rifiutato («tetto»)
  assert.throws(() => ampliaCasa(lot, 1, 1000 + 3600_000), isErr('tetto'));
  // giorno dopo: non è più ampliato oggi e si può fare il secondo livello
  assert.equal(ampliatoOggi(lot, 1000 + DAY), false);
  lot = ampliaCasa(lot, 1, 1000 + DAY);
  assert.equal(livelloLotto(lot), 2);
  assert.equal(ampliatoOggi(lot, 1000 + DAY), true);
});

test('le stanze crescono: a ogni livello la nuova contiene la vecchia; fuori dalla stanza attuale non si posa, dentro quella nuova sì', () => {
  let lot = compraMobile(ricco(), terra.id, 0);
  const l1 = LIVELLI_CASA.find((l) => l.stanza === 'terra')!.pavimento, nuova: [number, number] = [l1[0], l1[1]]; // un angolo che prima non c'era
  assert.equal(stanzaAt(0, nuova), null);
  assert.throws(() => posaMobile(lot, terra.id, { cell: nuova }, 0, 0), isErr('posizione'));
  lot = ampliaCasa(lot, 0, 1);
  assert.ok(stanzaAt(1, nuova));
  lot = posaMobile(lot, terra.id, { cell: nuova }, 0, 2);
  assert.equal(lot.casa!.arredi![0]!.cell[0], nuova[0], 'il mobile resta dov’è dopo altri ampliamenti');
  lot = su(lot, MAX_LIVELLO_CASA - 1);
  assert.equal(lot.casa!.arredi![0]!.cell[0], nuova[0]);
  assert.equal(postoMobileError(lot, terra, { cell: [ST.retro[0], stanzaTerra(MAX_LIVELLO_CASA).pavimento[1]] }, null)?.code, 'posizione', 'davanti alla porta in fondo, anche con la stanza grande');
  assert.equal(checkInvariant([lot]), null);
});

test('i mobili a muro vanno col muro: dopo l’ampliamento stanno sul muro nuovo, nello stesso punto di lato', () => {
  const [X0, Z0, X1] = ST.pavimento;
  let lot = compraMobile(compraMobile(compraMobile(ricco(), parete.id, 0), parete.id, 0), parete.id, 0);
  lot = posaMobile(lot, parete.id, { cell: [X0 + 1, Z0], muro: 'n' }, 0, 0);
  lot = posaMobile(lot, parete.id, { cell: [X0, Z0 + 2], muro: 'o' }, 0, 0);
  lot = posaMobile(lot, parete.id, { cell: [X1 - 1, Z0 + 3], muro: 'e' }, 0, 0);
  lot = ampliaCasa(lot, 0, 1);
  const r = stanzaTerra(1).pavimento, a = lot.casa!.arredi!;
  assert.deepEqual(a.find((x) => x.muro === 'n')!.cell, [X0 + 1, r[1]]);
  assert.deepEqual(a.find((x) => x.muro === 'o')!.cell, [r[0], Z0 + 2]);
  assert.deepEqual(a.find((x) => x.muro === 'e')!.cell, [r[2] - 1, Z0 + 3]);
  for (const x of a) assert.equal(postoMobileError({ ...lot, casa: { ...lot.casa, arredi: a.filter((y) => y.id !== x.id) } }, parete, { cell: x.cell, muro: x.muro }), null, 'ancora valido: ' + JSON.stringify(x));
  // la porta in fondo si sposta col muro: sul muro nord, davanti alla porta, niente
  assert.equal(postoMobileError(lot, parete, { cell: [ST.retro[0], r[1]], muro: 'n' })?.code, 'posizione');
});

test('giardino: la pianta massima della casa è chiusa a decorazioni ed edifici anche se la stanza è ancora piccola', () => {
  const lot = newLot('a', 0, T), max = PIANTE_MAX.find((s) => s.id === 'terra')!.pavimento;
  assert.ok(inStanza([max[0], max[1]]) && inStanza([max[2] - 1, max[3] - 1]));
  assert.equal(decorCellError(lot, [max[0], max[1]], T)?.code, 'posizione');
  assert.equal(fitToTemplate(lot, T), lot, 'un lotto nuovo è già a posto');
  assert.deepEqual(stanzeDi(0).map((s) => s.id), ['terra']);
  assert.equal(livelloCasa({ livello: 99 }), MAX_LIVELLO_CASA);
  assert.equal(livelloCasa(undefined), 0);
});

test('la collisione: a livello 0 l’eroe urta il muro della stanza piccola; con l’ampliamento passa; le altre case non cambiano', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS), mappa = arch.map;
  const l0 = arch.lots[0]!, l1 = arch.lots[1]!, nuovo = LIVELLI_CASA.find((l) => l.stanza === 'terra')!.pavimento, livelli = new Map<number, number>();
  const maschera = mascheraCase(mappa, arch.lots, (s) => livelli.get(s) ?? 0);
  const cx = l0.origin[0] + nuovo[0], cz = l0.origin[1] + nuovo[1] + 1;
  assert.equal(maschera.at(cx, cz), 'r', 'la cella nuova è ancora chiusa');
  assert.equal(mappa.at(cx, cz), '.', 'nel mondo il pavimento massimo c’è');
  assert.ok(!maschera.walkable((cx + 0.5) * 2, (cz + 0.5) * 2));
  // un eroe che cammina verso ovest dentro la stanza (livello 0) si ferma al muro vecchio
  const x0 = (l0.origin[0] + ST.pavimento[0] + 1.5) * 2, z0 = (l0.origin[1] + ST.pavimento[1] + 2.5) * 2;
  let s = newAvatar(x0, z0);
  for (let i = 0; i < 240; i++) s = stepAvatar(s, { ...NO_INPUT, mx: -1, my: 0 }, maschera);
  assert.ok(s.x > (l0.origin[0] + ST.pavimento[0]) * 2, 'si è fermato al muro');
  livelli.set(l0.slot, 1);
  s = newAvatar(x0, z0);
  for (let i = 0; i < 240; i++) s = stepAvatar(s, { ...NO_INPUT, mx: -1, my: 0 }, maschera);
  assert.ok(s.x < (l0.origin[0] + ST.pavimento[0]) * 2, 'con l’ampliamento va oltre il vecchio muro');
  assert.ok(s.x > (l0.origin[0] + nuovo[0]) * 2, 'ma non oltre il muro nuovo');
  // la casa del vicino è un'altra cosa: ha il suo livello
  assert.equal(maschera.at(l1.origin[0] + nuovo[0], l1.origin[1] + nuovo[1] + 1), 'r');
  assert.equal(maschera.at(l0.origin[0] + nuovo[0], l0.origin[1] + nuovo[1] + 1), '.');
});

test('cantina e secondo piano: ci sono solo dal livello giusto; si posa dentro la loro stanza; le scale restano libere; le scale vanno e vengono', () => {
  const lc = LIVELLI_CASA.findIndex((l) => l.stanza === 'cantina') + 1, lp = LIVELLI_CASA.findIndex((l) => l.stanza === 'piano') + 1;
  assert.ok(lc >= 4 && lp > lc + 1, 'la cantina e poi il piano: dopo le stanze più grandi');
  assert.deepEqual(stanzeDi(lc - 1).map((s) => s.id), ['terra']);
  assert.deepEqual(stanzeDi(lc).map((s) => s.id), ['terra', 'cantina']);
  assert.deepEqual(stanzeDi(MAX_LIVELLO_CASA).map((s) => s.id), ['terra', 'cantina', 'piano']);
  const cantina = stanzeDi(lc).find((s) => s.id === 'cantina')!.pavimento, dentro: [number, number] = [cantina[0] + 1, cantina[1]];
  let lot = compraMobile(compraMobile(ricco(), terra.id, 0), parete.id, 0);
  assert.throws(() => posaMobile(lot, terra.id, { cell: dentro }, 0, 0), isErr('posizione'), 'prima del livello la cantina non c’è');
  lot = su(lot, lc);
  lot = posaMobile(lot, terra.id, { cell: dentro }, 0, 0);
  lot = posaMobile(lot, parete.id, { cell: [cantina[0] + 2, cantina[1]], muro: 'n' }, 0, 0);
  assert.equal(stanzaAt(lc, lot.casa!.arredi![0]!.cell)?.id, 'cantina');
  // le scale: due, una per piano; su quella cella non si posa; un mobile lungo non deve coprirle
  const scale = scaleDi(lc);
  assert.equal(scale.length, 2);
  assert.deepEqual(scale.map((s) => s.verso).sort(), ['giu', 'su']);
  for (const s of scale) {
    assert.ok(stanzaAt(lc, s.cell)?.id === s.stanza && stanzaAt(lc, s.arrivo)?.id === s.a, 'scala e arrivo dentro le stanze');
    assert.throws(() => posaMobile(compraMobile(lot, terra.id, 0), terra.id, { cell: s.cell }, 0, 0), isErr('posizione'), `sulla scala ${s.stanza}`);
  }
  assert.equal(scaleDi(lc - 1).length, 0);
  assert.equal(scaleDi(MAX_LIVELLO_CASA).length, 4, 'con il secondo piano ci sono tutte e quattro');
  // ampliando la cantina il mobile a muro si riappende al suo muro nord (la cantina cresce verso nord)
  lot = su(lot, 1);
  const cantina2 = stanzeDi(lc + 1).find((s) => s.id === 'cantina')!.pavimento;
  assert.equal(lot.casa!.arredi!.find((a) => a.muro === 'n')!.cell[1], cantina2[1]);
  assert.equal(checkInvariant([lot]), null);
});

test('la collisione chiude anche cantina e secondo piano finché non si sbloccano', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS), l0 = arch.lots[0]!, livelli = new Map<number, number>();
  const maschera = mascheraCase(arch.map, arch.lots, (s) => livelli.get(s) ?? 0);
  const lc = LIVELLI_CASA.findIndex((l) => l.stanza === 'cantina') + 1, c = LIVELLI_CASA[lc - 1]!.pavimento;
  const x = l0.origin[0] + c[0] + 1, z = l0.origin[1] + c[1] + 1;
  assert.equal(arch.map.at(x, z), '.', 'nel mondo il pavimento della cantina c’è');
  assert.equal(maschera.at(x, z), 'r', 'chiusa a livello 0');
  livelli.set(l0.slot, lc);
  assert.equal(maschera.at(x, z), '.', 'aperta dal livello della cantina');
  const lastra = stanzeDi(MAX_LIVELLO_CASA).find((s) => s.id === 'piano')!.pavimento;
  assert.equal(maschera.at(l0.origin[0] + lastra[0], l0.origin[1] + lastra[1]), 'r', 'il secondo piano è ancora chiuso');
});
