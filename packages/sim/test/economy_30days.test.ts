// Taratura delle monete (GDD §5, #414): 30 giorni per tre archetipi (2 volte al giorno / 1 volta / 2 volte a settimana) che fanno quello
// che fa un giocatore normale a ogni visita: qualche minigioco (medaglie a caso), le missioni della Bacheca quando sono fatte, una partita ai
// Templari al giorno e qualche duello nell'Arena. Si misura quante monete entrano al giorno; i tetti del giorno (10 partite premiate,
// Templari, Arena) non si sfondano mai. Con quelle monete si comprano i cappelli e gli ampliamenti della casa: chi entra spesso arriva lontano,
// nessuno compra tutto in un mese (i cosmetici costano, VISIONE §2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR, BALANCE } from '@marea/content';
import { ARENA } from '@marea/content/arena.ts';
import { TEMPLARI } from '@marea/content/templari.ts';
import { buyHat, newLot, ownsHat } from '../src/economy/actions.ts';
import { vetrinaMercante } from '../src/economy/mercante.ts';
import { ampliaCasa, ampliatoOggi, livelloLotto } from '../src/economy/casa.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { eventiPartita, missioniOf, riscuotiMissione, tracciaMissioni } from '../src/economy/missioni.ts';
import { finishSolo, soloPrize, startSolo } from '../src/economy/rewards.ts';
import { LIVELLI_CASA } from '../src/economy/stanze.ts';
import { finishArena, startArena } from '../src/arena/premio.ts';
import { finishTemplari, startTemplari } from '../src/templari/premio.ts';
import type { LotState } from '../src/economy/types.ts';
import type { Medal } from '../src/minigames/types.ts';
import { createRng } from '../src/rng.ts';
import type { Rng } from '../src/rng.ts';

const MIN = 60_000, H = 3_600_000, DAY = 24 * H;

export type Archetype = { nome: string; visits: (day: number) => number[] };
export const ARCHETYPES: Archetype[] = [
  { nome: '2 volte al giorno', visits: () => [8 * H, 20 * H] },
  { nome: '1 volta al giorno', visits: () => [20 * H] },
  { nome: '2 volte a settimana', visits: (d) => (d % 7 === 0 || d % 7 === 3 ? [20 * H] : []) },
];

function randomMedal(rng: Rng): Medal {
  const r = rng.next();
  return r < 0.25 ? 'oro' : r < 0.5 ? 'argento' : r < 0.75 ? 'bronzo' : null;
}

/** Spende come un giocatore: prima il prossimo ampliamento della casa se ci arriva, poi il cappello più economico che non ha tra quelli del Mercante di oggi. */
function compra(lot0: LotState, t: number): LotState {
  let lot = lot0;
  for (let guard = 0; guard < 20; guard++) {
    const liv = livelloLotto(lot), casa = LIVELLI_CASA[liv];
    if (casa && lot.monete >= casa.monete && !ampliatoOggi(lot, t)) { lot = ampliaCasa(lot, liv, t); continue; }
    const oggi = vetrinaMercante(t).cappelli;
    const hat = AVATAR.cappelli.filter((h) => oggi.includes(h.id) && !ownsHat(lot, h.id)).sort((a, b) => a.monete - b.monete)[0];
    if (hat && lot.monete >= hat.monete && (!casa || lot.monete - hat.monete >= casa.monete / 2)) { lot = buyHat(lot, hat.id, t); continue; }
    break;
  }
  return lot;
}

/** Una visita di qualche minuto: 2-4 minigiochi, le missioni compiute, Templari una volta al giorno, un paio di duelli. */
function visit(lot0: LotState, t0: number, rng: Rng, prima: boolean): LotState {
  let lot = lot0, t = t0;
  const games = rng.int(2, 4);
  for (let g = 0; g < games; g++) {
    const medal = randomMedal(rng);
    lot = startSolo(lot, 'regata', rng.int(1, 1e6), t);
    lot = tracciaMissioni(finishSolo(lot, medal, (t += 2 * MIN)).lot, eventiPartita(medal), t);
  }
  for (const m of missioniOf(lot, t).list) if (m.compiuta && !m.riscossa) lot = riscuotiMissione(lot, m.i, (t += 1000)).lot;
  if (prima) {
    lot = startTemplari(lot, rng.int(1, 1e6), (t += MIN));
    const superate = rng.int(3, 18);
    lot = finishTemplari(lot, { done: true, esito: 'morto', ticks: 1, ondata: superate + 1, superate, uccisioni: 0, punti: 0, guadagnati: 0, hash: 0 }, (t += 10 * MIN)).lot;
  }
  for (let k = 0, n = rng.int(0, 3); k < n; k++) {
    const run = `r${t}-${k}`;
    lot = finishArena(startArena(lot, run, 0, (t += MIN)), run, rng.next() < 0.5 ? 'vinta' : 'persa', (t += 3 * MIN)).lot;
  }
  return compra(lot, t);
}

export type Run = { nome: string; visite: number; entrate: number; alGiorno: number; maxGiorno: number; casa: number; cappelli: number; avanzo: number };
export function simulate(a: Archetype, days = 30, seed = 1): Run {
  const rng = createRng(seed).fork(a.nome);
  let lot = newLot('sim', 0);
  let visite = 0, maxGiorno = 0;
  for (let d = 0; d < days; d++) {
    const g0 = lot.ledger.monete?.generated ?? 0;
    for (const [i, off] of a.visits(d).entries()) {
      lot = visit(lot, d * DAY + off, rng, i === 0);
      visite++;
      const err = checkMonete([lot]);
      if (err) throw new Error(`invariante delle monete rotta: ${err}`);
    }
    maxGiorno = Math.max(maxGiorno, (lot.ledger.monete?.generated ?? 0) - g0);
  }
  const entrate = (lot.ledger.monete?.generated ?? 0) - BALANCE.monete.partenza;
  return {
    nome: a.nome, visite, entrate, alGiorno: Math.round(entrate / days), maxGiorno,
    casa: livelloLotto(lot), cappelli: (lot.posseduti ?? []).length, avanzo: lot.monete,
  };
}

function table(runs: Run[]): void {
  console.log('\n[marea] taratura monete, 30 giorni');
  console.log('archetipo              visite  entrate  al giorno  max giorno  casa  cappelli  avanzo');
  for (const r of runs)
    console.log(`${r.nome.padEnd(22)} ${String(r.visite).padStart(6)} ${String(r.entrate).padStart(8)} ${String(r.alGiorno).padStart(10)} ${String(r.maxGiorno).padStart(11)} ${String(r.casa).padStart(5)} ${String(r.cappelli).padStart(9)} ${String(r.avanzo).padStart(7)}`);
}

test('taratura 30 giorni: monete al giorno per tre archetipi, tetti del giorno rispettati, nessuno compra tutto in un mese', () => {
  const runs = ARCHETYPES.map((a) => simulate(a));
  table(runs);
  const [due, una, rara] = runs as [Run, Run, Run];
  // chi entra di più guadagna di più, ma chi entra di rado non resta a zero
  assert.ok(due.entrate > una.entrate && una.entrate > rara.entrate, 'più visite → più monete');
  assert.ok(rara.entrate > 0.15 * due.entrate, `2 volte a settimana troppo indietro: ${rara.entrate} contro ${due.entrate}`);
  // il tetto del giorno: 10 partite premiate (oro + il premio extra più alto), 3 missioni, Templari e Arena
  const extra = Math.max(0, ...['perle', 'lava', 'arrembaggio', 'koi', 'pinguini', 'corse', 'snowboard'].map((m) => soloPrize('oro', m) - soloPrize('oro')));
  const tetto = BALANCE.solo.premiateAlGiorno * (soloPrize('oro') + extra) + 3 * 30 + TEMPLARI.premio.tetto + ARENA.premio.tetto;
  for (const r of runs) assert.ok(r.maxGiorno <= tetto, `${r.nome}: ${r.maxGiorno} monete in un giorno, oltre il tetto ${tetto}`);
  // obiettivi (GDD §5): chi gioca ogni giorno ingrandisce la casa almeno due volte; nessuno arriva alla casa più grande in un mese
  assert.ok(una.casa >= 2, `1 volta al giorno: casa al livello ${una.casa}`);
  assert.ok(runs.every((r) => r.casa < LIVELLI_CASA.length), 'casa al massimo in 30 giorni: i prezzi sono troppo bassi');
  const pagati = AVATAR.cappelli.filter((h) => h.monete > 0).length;
  assert.ok(runs.every((r) => r.casa < LIVELLI_CASA.length || r.cappelli < pagati), 'tutto comprato in 30 giorni');
});
