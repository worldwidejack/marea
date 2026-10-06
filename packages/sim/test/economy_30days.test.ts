// Taratura (GDD §5): 30 giorni per tre archetipi con una politica semplice. Obiettivo: ~100 % / ~75 % / ~40 % degli edifici a L2, nessuno a L3 pieno.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS as ALL_BUILDINGS, ISLANDS, building } from '@marea/content';
// La taratura del GDD §5 riguarda il villaggio: gli edifici del Mondo Sotterraneo (docs/RPG.md) sono un percorso a parte.
const GDR = new Set(['banco', 'alchimia', 'forziere', 'serra']);
const BUILDINGS = ALL_BUILDINGS.filter((d) => !GDR.has(d.id));
import { parseIsland } from '../src/world/grid.ts';
import { build, collectAll, newLot, upgrade } from '../src/economy/actions.ts';
import { advance } from '../src/economy/advance.ts';
import { applyMinigameResult } from '../src/economy/rewards.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { geq, total } from '../src/economy/types.ts';
import proposta from './fixtures/buildings_proposta.json' with { type: 'json' };
import type { LotState } from '../src/economy/types.ts';
import type { Medal } from '../src/minigames/types.ts';
import { createRng } from '../src/rng.ts';
import type { Rng } from '../src/rng.ts';

const MIN = 60_000, H = 3_600_000, DAY = 24 * H;
const VISIT_MS = 5 * MIN; // una visita dura qualche minuto: i cantieri brevi si concatenano
const ORDER = ['segheria', 'cava', 'magazzino', 'tavolo', 'casa', 'faro'];
const map = parseIsland(ISLANDS[0]!);

export type Archetype = { nome: string; visits: (day: number) => number[] };
export const ARCHETYPES: Archetype[] = [
  { nome: '2 volte al giorno', visits: () => [8 * H, 20 * H] },
  { nome: '1 volta al giorno', visits: () => [20 * H] },
  { nome: '2 volte a settimana', visits: (d) => (d % 7 === 0 || d % 7 === 3 ? [20 * H] : []) },
];

type Option = { cost: number; act: (l: LotState, t: number) => LotState; canPay: (l: LotState) => boolean };

/** La cosa più economica disponibile, un gradino alla volta: prima gli edifici nuovi nell'ordine sensato, poi tutti i L2 (il più economico, a pari costo i produttori), poi i L3. */
function cheapest(lot: LotState): Option | null {
  const opts: Option[] = [];
  for (const [i, id] of ORDER.entries()) {
    if (lot.buildings.some((b) => b.building === id)) continue;
    const def = building(id);
    if (def.requires && !lot.buildings.some((b) => b.building === def.requires && b.level >= 1)) continue;
    const cost = def.levels[0]!.cost;
    const free = map.lots.find((c) => !lot.buildings.some((b) => b.cell[0] === c.cx && b.cell[1] === c.cz));
    if (!free) continue;
    opts.push({ cost: -1000 + i, canPay: (l) => geq(l.resources, cost), act: (l, t) => build(l, id, [free.cx, free.cz], t, map) });
  }
  if (!opts.length)
    for (const b of lot.buildings) {
      const lvl = building(b.building).levels[b.level];
      if (!lvl || b.level < 1) continue;
      const prod = building(b.building).produces ? 0 : 0.5;
      opts.push({ cost: b.level * 100_000 + total(lvl.cost) + prod, canPay: (l) => geq(l.resources, lvl.cost), act: (l, t) => upgrade(l, b.id, t) });
    }
  opts.sort((x, y) => x.cost - y.cost);
  return opts[0] ?? null;
}

function randomMedal(rng: Rng): Medal {
  const r = rng.next();
  return r < 0.25 ? 'oro' : r < 0.5 ? 'argento' : r < 0.75 ? 'bronzo' : null;
}

function visit(lot0: LotState, t0: number, rng: Rng): LotState {
  let lot = collectAll(lot0, t0);
  const games = rng.int(0, 2);
  for (let g = 0; g < games; g++) lot = applyMinigameResult(lot, { medal: randomMedal(rng) }, t0 + (g + 1) * MIN);
  let t = t0 + 3 * MIN;
  const end = t0 + VISIT_MS;
  for (let guard = 0; guard < 20 && t <= end; guard++) {
    lot = collectAll(lot, t);
    if (lot.construction) {
      if (lot.construction.endsMs > end) break;
      t = lot.construction.endsMs;
      continue;
    }
    const o = cheapest(lot);
    if (!o || !o.canPay(lot)) break;
    lot = o.act(lot, t);
  }
  return advance(lot, end);
}

export type Run = { nome: string; visite: number; l1: number; l2: number; l3: number; tot: number; pctL2: number; perle: number; livelli: string };
export function simulate(a: Archetype, days = 30, seed = 1): Run {
  const rng = createRng(seed).fork(a.nome);
  let lot = newLot('sim', 0, map);
  let visite = 0;
  for (let d = 0; d < days; d++)
    for (const off of a.visits(d)) {
      lot = visit(lot, d * DAY + off, rng);
      visite++;
      const err = checkInvariant([lot]);
      if (err) throw new Error(`invariante rotta: ${err}`);
    }
  lot = advance(lot, days * DAY);
  const tot = BUILDINGS.length;
  const lv = (min: number) => BUILDINGS.filter((d) => (lot.buildings.find((b) => b.building === d.id)?.level ?? 0) >= min).length;
  const l3full = BUILDINGS.filter((d) => (lot.buildings.find((b) => b.building === d.id)?.level ?? 0) >= d.levels.length).length;
  return {
    nome: a.nome, visite, l1: lv(1), l2: lv(2), l3: l3full, tot, pctL2: Math.round((lv(2) / tot) * 100), perle: lot.resources.perle,
    livelli: BUILDINGS.map((d) => `${d.id.slice(0, 4)}${lot.buildings.find((b) => b.building === d.id)?.level ?? 0}`).join(' '),
  };
}

type Proposta = { levels: Record<string, { cost: [number, number]; rate?: number; cap?: number }[]> };
/** Applica la proposta WP3 sopra buildings.json (solo in questo processo di test). Ritorna true se cambiava qualcosa. */
export function applyProposta(): boolean {
  let changed = false;
  for (const b of BUILDINGS) {
    const p = (proposta as unknown as Proposta).levels[b.id];
    if (!p) continue;
    p.forEach((pl, j) => {
      const l = b.levels[j] as { cost: { legno: number; pietra: number; perle: number }; rate?: number; cap?: number } | undefined;
      if (!l) return;
      if (l.cost.legno !== pl.cost[0] || l.cost.pietra !== pl.cost[1] || (pl.rate !== undefined && l.rate !== pl.rate) || (pl.cap !== undefined && l.cap !== pl.cap)) changed = true;
      l.cost = { legno: pl.cost[0], pietra: pl.cost[1], perle: 0 };
      if (pl.rate !== undefined) l.rate = pl.rate;
      if (pl.cap !== undefined) l.cap = pl.cap;
    });
  }
  return changed;
}

function table(titolo: string, runs: Run[]): void {
  console.log(`\n[marea] taratura 30 giorni — ${titolo} (edifici: ${runs[0]!.tot})`);
  console.log('archetipo              visite  L1  L2  max   %L2   perle  livelli');
  for (const r of runs)
    console.log(`${r.nome.padEnd(22)} ${String(r.visite).padStart(6)} ${String(r.l1).padStart(3)} ${String(r.l2).padStart(3)} ${String(r.l3).padStart(6)} ${String(r.pctL2).padStart(4)}% ${String(r.perle).padStart(6)}  ${r.livelli}`);
}

test('taratura 30 giorni: tre archetipi (~100 % / ~75 % / ~40 % a L2, nessuno tutto a L3)', () => {
  const snap = JSON.stringify(BUILDINGS);
  if (applyProposta()) {
    // buildings.json non ha ancora la proposta: stampa anche i numeri attuali per confronto
    const cur = JSON.parse(snap) as typeof BUILDINGS;
    const prop = JSON.stringify(BUILDINGS);
    BUILDINGS.forEach((b, i) => { (b as { levels: unknown }).levels = cur[i]!.levels; });
    table('buildings.json ATTUALE (da sostituire: vedi tests/out/richieste/wp3.md)', ARCHETYPES.map((a) => simulate(a)));
    const p = JSON.parse(prop) as typeof BUILDINGS;
    BUILDINGS.forEach((b, i) => { (b as { levels: unknown }).levels = p[i]!.levels; });
  }
  for (const seed of [1, 2, 3, 4, 5]) {
    const runs = ARCHETYPES.map((a) => simulate(a, 30, seed));
    if (seed === 1) table('proposta WP3', runs);
    const [a2, a1, aw] = runs as [Run, Run, Run];
    assert.ok(a2.pctL2 >= 85, `seed ${seed} 2/giorno: ${a2.pctL2}% a L2 (atteso ~100)`);
    assert.ok(a1.pctL2 >= 55 && a1.pctL2 <= 86, `seed ${seed} 1/giorno: ${a1.pctL2}% a L2 (atteso ~75)`);
    assert.ok(aw.pctL2 >= 28 && aw.pctL2 <= 58, `seed ${seed} 2/settimana: ${aw.pctL2}% a L2 (atteso ~40)`);
    for (const r of runs) assert.ok(r.l3 < r.tot, `${r.nome}: tutto a L3`);
    assert.ok(a2.pctL2 >= a1.pctL2 && a1.pctL2 >= aw.pctL2, 'chi entra di più deve essere più avanti');
  }
});
