// La storia delle prime ore (GDD §9, economy/storia.ts): contenuti validi; senza storia il gioco va come prima; il tutorial in ordine, coi
// passi visti dal lotto che valgono solo da quando sono diventati quelli da fare; il regalo di Fulvio (doppio = niente); la barca da Bepi;
// la missione delle isole (provata → Remo → viaggio rapido) e quella dei dungeon (quelli finiti prima non pagano).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANNA } from '@marea/content/pesci.ts';
import { RETINO } from '@marea/content/insetti.ts';
import { STORIA, validateStoria } from '@marea/content/storia.ts';
import { newLot } from '../src/economy/actions.ts';
import { checkMonete, moneteOf } from '../src/economy/monete.ts';
import {
  avanzaStoria, compraBarca, faseStoria, fattoPasso, haBarca, iniziaStoria, isolaCorrente, isolaProvata, passoCorrente, regaloAttrezzo,
  riscuotiIsola, segnaDifesa, viaggiDisponibili,
} from '../src/economy/storia.ts';
import type { LotState } from '../src/economy/types.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { conMonete, senzaMonete } from './monete_util.ts';
import { isErr } from './economia_util.ts';

const T0 = 1_800_000_000_000;
const lotto = (monete = 0): LotState => conMonete(senzaMonete(newLot('jack', T0)), monete);
/** Quello che farebbe il server: un'azione, poi la lettura del lotto (avanzaStoria). */
const leggi = (l: LotState): LotState => avanzaStoria(l);
const conPesce = (l: LotState): LotState => leggi({ ...l, pesci: { visti: { ...(l.pesci?.visti ?? {}), ghiozzo: (l.pesci?.visti['ghiozzo'] ?? 0) + 1 }, posseduti: [], presi: [] } });
const conArredo = (l: LotState): LotState => leggi({ ...l, casa: { ...l.casa, arredi: [...(l.casa?.arredi ?? []), { id: `x-${l.version}`, mobile: STORIA.regaloPina, cell: [1, 1] }] } });
const conMoneteGuadagnate = (l: LotState, n: number): LotState => leggi(conMonete(l, n));
const giocato = (l: LotState, mg: string): LotState => leggi({ ...l, diario: { ...(l.diario ?? { pesci: {}, perle: {}, medaglie: {}, giocati: {}, animali: [], isole: [], dungeon: 0 }), giocati: { ...(l.diario?.giocati ?? {}), [mg]: (l.diario?.giocati[mg] ?? 0) + 1 } } } as LotState);

/** Il tutorial fatto fino a Bepi e Gigi compresi. */
function tutorial(l0: LotState, attrezzo: 'canna' | 'retino' = 'canna'): LotState {
  let l = iniziaStoria(l0);
  l = fattoPasso(l, 'naufragio', T0);
  l = fattoPasso(l, 'pina', T0);
  l = fattoPasso(l, 'casa', T0);
  l = conArredo(l);
  l = regaloAttrezzo(l, attrezzo, T0);
  l = conPesce(l);
  l = conMoneteGuadagnate(l, 10);
  l = fattoPasso(l, 'bepi', T0);
  return fattoPasso(l, 'gigi', T0);
}

test('storia: contenuti validi', () => {
  assert.deepEqual(validateStoria(), []);
});

test('storia: senza storia il gioco va come prima', () => {
  const l = lotto();
  assert.equal(faseStoria(l), null);
  assert.equal(haBarca(l), true);
  assert.equal(viaggiDisponibili(l), null);
  assert.equal(avanzaStoria(l), l, 'niente da avanzare: stesso lotto');
  assert.equal(segnaDifesa(l), l);
});

test('storia: il tutorial va in ordine e i passi del client solo quando tocca a loro', () => {
  let l = iniziaStoria(lotto());
  assert.equal(iniziaStoria(l), l, 'già iniziata: niente');
  assert.equal(faseStoria(l), 'tutorial');
  assert.equal(haBarca(l), false);
  assert.deepEqual(viaggiDisponibili(l), []);
  assert.equal(passoCorrente(l)?.id, 'naufragio');
  assert.throws(() => fattoPasso(l, 'casa', T0), isErr('requisito'));
  l = fattoPasso(l, 'naufragio', T0);
  assert.equal(fattoPasso(l, 'naufragio', T0).storia, l.storia, 'già fatto: niente');
  l = fattoPasso(l, 'pina', T0);
  assert.equal(l.casa?.magazzino?.[STORIA.regaloPina], 1, 'il lume di Pina nel magazzino');
  l = fattoPasso(l, 'casa', T0);
  assert.equal(passoCorrente(l)?.id, 'arreda');
  assert.throws(() => regaloAttrezzo(l, 'canna', T0), isErr('requisito'), 'Fulvio dopo ARREDA');
  assert.throws(() => fattoPasso(l, 'arreda', T0), isErr('requisito'), 'ARREDA lo vede il server');
  l = conArredo(l);
  assert.equal(passoCorrente(l)?.id, 'attrezzo');
});

test('storia: i passi visti dal lotto valgono solo da quando sono quelli da fare (anche per chi aveva già pescato)', () => {
  let l = conPesce(lotto()); // un veterano: un pesce preso prima della storia
  l = iniziaStoria(l);
  for (const id of ['naufragio', 'pina', 'casa']) l = fattoPasso(l, id, T0);
  l = conArredo(l);
  l = regaloAttrezzo(l, 'canna', T0);
  assert.equal(passoCorrente(l)?.id, 'cattura');
  l = leggi(l);
  assert.equal(passoCorrente(l)?.id, 'cattura', 'il pesce di prima non conta');
  l = conPesce(l);
  assert.equal(passoCorrente(l)?.id, 'vendi');
  l = leggi(l);
  assert.equal(passoCorrente(l)?.id, 'vendi', 'le monete di prima non contano');
  l = conMoneteGuadagnate(l, 10);
  assert.equal(passoCorrente(l)?.id, 'bepi');
});

test('storia: il regalo di Fulvio, e chi ce l\'ha già non ne prende un altro', () => {
  const pre = (l0: LotState) => { let l = iniziaStoria(l0); for (const id of ['naufragio', 'pina', 'casa']) l = fattoPasso(l, id, T0); return conArredo(l); };
  const nuovo = regaloAttrezzo(pre(lotto()), 'retino', T0);
  assert.equal(heroOf(nuovo).inv[RETINO.id], 1);
  assert.equal(heroOf(nuovo).inv[CANNA.id] ?? 0, 0);
  assert.equal(nuovo.storia?.attrezzo, 'retino');
  assert.equal(moneteOf(nuovo), 0, 'gratis');
  const l0 = lotto(), h = heroOf(l0);
  const conCanna: LotState = { ...l0, hero: { ...h, inv: { ...h.inv, [CANNA.id]: 1 } } };
  const doppio = regaloAttrezzo(pre(conCanna), 'canna', T0);
  assert.equal(heroOf(doppio).inv[CANNA.id], 1, 'una canna sola');
  assert.equal(passoCorrente(doppio)?.id, 'cattura', 'il passo va avanti lo stesso');
});

test('storia: la barca da Bepi, dopo avergli parlato, coi soldi giusti, una volta', () => {
  let l = iniziaStoria(lotto(STORIA.barca.prezzo + 5));
  assert.throws(() => compraBarca(l, T0), isErr('requisito'), 'prima Bepi');
  l = tutorial(l);
  assert.equal(faseStoria(l), 'barca');
  assert.throws(() => compraBarca(conMonete(senzaMonete(l), STORIA.barca.prezzo - 1), T0), isErr('risorse'));
  const m = moneteOf(l);
  l = compraBarca(l, T0);
  assert.equal(moneteOf(l), m - STORIA.barca.prezzo);
  assert.equal(haBarca(l), true);
  assert.throws(() => compraBarca(l, T0), isErr('unico'));
  assert.equal(faseStoria(l), 'isole');
  assert.deepEqual(viaggiDisponibili(l), ['porto']);
  assert.equal(checkMonete([l]), null);
});

test('storia: «Scopri le isole» un\'isola alla volta, Remo paga e apre il viaggio rapido', () => {
  let l = compraBarca(tutorial(lotto(STORIA.barca.prezzo + 20)), T0);
  l = giocato(l, 'regata'); // la Regata giocata prima che la missione partisse non conterebbe: qui la missione era già partita alla barca
  const prima = STORIA.isole[0]!;
  assert.equal(isolaCorrente(l)?.isola, prima.isola);
  assert.equal(isolaProvata(l), true);
  const m = moneteOf(l), out = riscuotiIsola(l, T0);
  assert.equal(out.isola, prima.isola);
  assert.equal(moneteOf(out.lot), m + prima.premio);
  l = out.lot;
  assert.deepEqual(viaggiDisponibili(l), ['porto', prima.isola]);
  assert.equal(isolaCorrente(l)?.isola, STORIA.isole[1]!.isola);
  assert.throws(() => riscuotiIsola(l, T0), isErr('requisito'), 'la seconda non è ancora provata');
  // tutte, in ordine: Difesa dal client, Templari e Arena dai loro contatori
  for (const i of STORIA.isole.slice(1)) {
    const g = i.gioco;
    if (g.tipo === 'minigioco') l = giocato(l, g.id);
    else if (g.tipo === 'difesa') l = segnaDifesa(l);
    else if (g.tipo === 'templari') l = leggi({ ...l, templari: { pending: null, giorno: 0, preso: 0, record: 1, partite: (l.templari?.partite ?? 0) + 1 } });
    else l = leggi({ ...l, arena: { pending: null, giorno: 0, preso: 0, vinte: 0, perse: 1, pari: 0 } });
    l = riscuotiIsola(l, T0).lot;
  }
  assert.equal(faseStoria(l), 'libero');
  assert.deepEqual(viaggiDisponibili(l), ['porto', ...STORIA.isole.map((i) => i.isola)]);
  assert.equal(checkMonete([l]), null);
});

test('storia: un gioco giocato prima della missione non conta', () => {
  const l = compraBarca(tutorial(giocato(lotto(STORIA.barca.prezzo), 'regata')), T0);
  assert.equal(isolaProvata(l), false);
  assert.throws(() => riscuotiIsola(l, T0), isErr('requisito'));
});

test('storia: la missione dei dungeon apre con Gigi; i dungeon finiti prima non pagano', () => {
  const l0 = lotto(), h = heroOf(l0);
  let l: LotState = { ...l0, hero: { ...h, completati: ['grotta'] } };
  l = tutorial(l);
  assert.deepEqual(l.storia?.dungeon, ['grotta']);
  const m = moneteOf(l);
  l = leggi({ ...l, hero: { ...heroOf(l), completati: ['grotta', 'cripta'] } });
  assert.deepEqual(l.storia?.dungeon, ['grotta', 'cripta']);
  assert.equal(moneteOf(l), m + STORIA.dungeon.premio);
  assert.equal(leggi(l), l, 'una volta sola');
  assert.equal(checkMonete([l]), null);
});
