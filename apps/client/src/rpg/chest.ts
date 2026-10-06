// Forziere (R-pannelli): due colonne (zaino / Forziere) con peso e capienza; tocchi un oggetto → in basso «sposta 1» o «tutti»
// (azioni `deposita` / `preleva`). Gli oggetti equipaggiati restano nello zaino finché non li togli.
import { bagWeight, chestCap } from '@marea/sim/rpg/bag.ts';
import { heroDerived } from '@marea/sim/rpg/hero.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ItemDef } from '@marea/sim/rpg/types.ts';
import { el } from '../ui/style.ts';
import { GROUPS, button, fmtKg, iconOf, row } from './items_ui.ts';
import type { View } from './items_ui.ts';

const ORDER = new Map(GROUPS.flatMap((g, i) => g.kinds.map((k) => [k, i] as const)));
function sorted(bag: Record<string, number>): ItemDef[] {
  return Object.keys(bag).filter((id) => (bag[id] ?? 0) > 0 && hasItem(id)).map(itemDef)
    .sort((a, b) => (ORDER.get(a.kind) ?? 9) - (ORDER.get(b.kind) ?? 9) || a.nome.localeCompare(b.nome, 'it'));
}
/** Copie equipaggiate (non si depositano). */
function inUse(v: View, id: string): number {
  return Object.entries(v.hero.equip).filter(([s, x]) => s !== 'magia' && x === id).length;
}
/** Quante unità di peso `p` stanno in `room` kg. */
const fit = (p: number, room: number, n: number): number => (p <= 0 ? n : Math.max(0, Math.min(n, Math.floor((room + 1e-9) / p))));

export function renderChest(v: View, out: HTMLElement): void {
  const cap = chestCap(v.lot);
  if (cap <= 0) { out.appendChild(el('div', 'mz-rp-note', 'Costruisci il Forziere sulla tua isola: tiene quello che non porti nello zaino.')); return; }
  const d = heroDerived(v.hero), f = v.lot.forziere ?? {}, fw = bagWeight(f);
  const sel = v.ui.chest;
  if (sel && !((sel.side === 'zaino' ? v.hero.inv : f)[sel.id] ?? 0)) v.ui.chest = null;
  const cols = el('div', 'mz-rp-cols');
  for (const side of ['zaino', 'forziere'] as const) {
    const bag = side === 'zaino' ? v.hero.inv : f;
    const col = el('div'); col.dataset['col'] = side;
    const h = el('div', 'mz-rp-colh');
    h.append(el('b', '', side === 'zaino' ? 'Zaino' : 'Forziere'), side === 'zaino' ? `${fmtKg(d.carico)} / ${fmtKg(d.caricoMax)}` : `${fmtKg(fw)} / ${fmtKg(cap)}`);
    col.appendChild(h);
    const list = sorted(bag);
    if (!list.length) col.appendChild(el('div', 'mz-rp-empty', 'Vuoto.'));
    for (const it of list) {
      const on = v.ui.chest?.side === side && v.ui.chest.id === it.id;
      const used = side === 'zaino' ? inUse(v, it.id) : 0;
      const r = row(`${side}:${it.id}`, iconOf(it, 16), it.nome, `×${bag[it.id]}`, on, () => { v.ui.chest = on ? null : { side, id: it.id }; v.rerender(); });
      r.dataset['item'] = it.id; r.title = it.nome;
      if (used >= (bag[it.id] ?? 0)) r.classList.add('dim');
      col.appendChild(r);
    }
    cols.appendChild(col);
  }
  out.appendChild(cols);
  out.appendChild(actions(v, cap - fw, d.caricoMax - d.carico));
}

function actions(v: View, chestRoom: number, bagRoom: number): HTMLElement {
  const bar = el('div', 'mz-rp-act');
  const sel = v.ui.chest;
  if (!sel) { bar.appendChild(el('div', 'mz-rp-cmp', 'Tocca un oggetto per spostarlo.')); return bar; }
  const it = itemDef(sel.id);
  const dep = sel.side === 'zaino';
  const have = (dep ? v.hero.inv[it.id] : v.lot.forziere?.[it.id]) ?? 0;
  const used = dep ? inUse(v, it.id) : 0;
  const movable = fit(it.peso, dep ? chestRoom : bagRoom, have - used);
  const t = el('div', 'mz-rp-cmp', `${it.nome} · ${dep ? 'nello zaino' : 'nel Forziere'} ×${have}${used ? ` (${used} in uso)` : ''} · ${fmtKg(it.peso)} l'uno`);
  bar.appendChild(t);
  const why = used >= have ? 'Togli prima dall\'equipaggiamento' : movable < 1 ? (dep ? 'Il Forziere è pieno' : 'Zaino troppo pesante') : '';
  if (why) bar.appendChild(el('div', 'mz-rp-warn', why));
  const r = el('div', 'mz-row');
  const go = (n: number) => v.act({ t: dep ? 'deposita' : 'preleva', item: it.id, n }, () => `${n} × ${it.nome} ${dep ? 'nel Forziere' : 'nello zaino'}`);
  const one = button(`sposta1:${it.id}`, dep ? 'Deposita 1' : 'Preleva 1', '', 'green', v.busy || movable < 1, () => go(1));
  const all = button(`spostaN:${it.id}`, `Tutti (${Math.max(movable, 0)})`, '', 'ghost', v.busy || movable < 1, () => go(movable));
  one.dataset['act'] = dep ? 'deposita' : 'preleva'; all.dataset['act'] = dep ? 'deposita-tutti' : 'preleva-tutti';
  r.append(one, all);
  bar.appendChild(r);
  return bar;
}
