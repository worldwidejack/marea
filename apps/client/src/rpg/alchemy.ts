// Tavolo Alchemico e Serra (R-pannelli). Alchimia: tutte le ricette, bloccate quelle oltre il livello d'Alchimia, ingredienti con quanti
// ne hai (zaino + Forziere), «Prepara» (azione `alchimia`). Serra: «Raccogli» (azione `serra`) e cosa è arrivato.
import { RECIPES } from '@marea/content/rpg.ts';
import { building } from '@marea/content';
import { advance } from '@marea/sim';
import { available, buildingLevel } from '@marea/sim/rpg/bag.ts';
import { potionPower } from '@marea/sim/rpg/derived.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { PAL, el } from '../ui/style.ts';
import { button, fmtN, itemIcon, iconOf, row, sec, statLines } from './items_ui.ts';
import type { View } from './items_ui.ts';
import { whereTo } from './forge.ts';

const nome = (id: string): string => (hasItem(id) ? itemDef(id).nome : id);

export function renderAlchemy(v: View, out: HTMLElement): void {
  if (buildingLevel(v.lot, 'alchimia') < 1) { out.appendChild(el('div', 'mz-rp-note', 'Costruisci il Tavolo Alchemico sulla tua isola: poi qui prepari le pozioni.')); return; }
  const lv = v.hero.skill.alchimia?.lv ?? 0;
  out.appendChild(sec('Ricette', `Alchimia ${lv} · forza ×${fmtN(potionPower(v.hero), 2)}`));
  for (const r of [...RECIPES].sort((a, b) => a.livello - b.livello)) {
    const locked = lv < r.livello;
    const ing = Object.entries(r.ingredienti).map(([id, q]) => ({ id, need: q, have: available(v.lot, v.hero, id) }));
    const ok = ing.every((i) => i.have >= i.need), open = v.ui.item === r.id;
    const res = hasItem(r.risultato) ? itemDef(r.risultato) : null;
    const r0 = row(`ricetta:${r.id}`, res ? iconOf(res, 24) : itemIcon('pozione', PAL.rosso, 24), r.nome, locked ? `serve Alchimia ${r.livello}` : ok ? 'ingredienti pronti' : 'mancano ingredienti', open,
      () => { v.ui.item = open ? null : r.id; v.rerender(); });
    r0.dataset['ricetta'] = r.id;
    if (locked || !ok) r0.classList.add('dim');
    out.appendChild(r0);
    if (!open) continue;
    const box = el('div', 'mz-rp-det'); box.dataset['det'] = r.id;
    if (res) { box.appendChild(el('p', '', res.descr)); for (const l of statLines(res)) box.appendChild(el('p', 'mz-rp-cmp', l)); }
    for (const i of ing) {
      const line = el('div', 'mz-rp-cost');
      line.append(el('span', '', `${i.need} × ${nome(i.id)}`), el('span', 'have ' + (i.have >= i.need ? 'mz-rp-ok' : 'mz-rp-bad'), `hai ${i.have}`));
      box.appendChild(line);
    }
    if (locked) box.appendChild(el('p', 'mz-rp-warn', `Serve Alchimia ${r.livello}: prepara le pozioni più facili per salire.`));
    const b = button(`do:${r.id}`, 'Prepara', locked ? `serve Alchimia ${r.livello}` : !ok ? 'ingredienti insufficienti' : r.n > 1 ? `×${r.n}` : '', '', v.busy || locked || !ok,
      () => v.act({ t: 'alchimia', ricetta: r.id }, (l) => `Pronta: ${nome(r.risultato)}${r.n > 1 ? ` ×${r.n}` : ''} ${whereTo(v, l, r.risultato)}`));
    b.dataset['act'] = 'alchimia';
    box.appendChild(b);
    out.appendChild(box);
  }
  out.appendChild(el('div', 'mz-rp-cmp', 'Gli ingredienti base li fa la Serra o si comprano alla Bottega del Banco; quelli rari si trovano nei dungeon.'));
}

/** Ingredienti pronti nella Serra adesso (lotto proiettato all'ora del server). */
function ready(v: View): number {
  const l = advance(v.lot, v.ctx.api.serverNow());
  return Math.floor(l.buildings.find((b) => b.building === 'serra')?.buffer ?? 0);
}

/** Raccoglie la Serra e ricorda cosa è arrivato (differenza tra prima e dopo, zaino + Forziere). */
export function harvest(v: View): void {
  const before = v.lot;
  v.act({ t: 'serra' }, (l) => {
    const arrivati: Record<string, number> = {};
    let toChest = false;
    for (const id of building('serra').producesItems ?? []) {
      const dz = (l.hero?.inv[id] ?? 0) - (before.hero?.inv[id] ?? 0);
      const df = (l.forziere?.[id] ?? 0) - (before.forziere?.[id] ?? 0);
      if (dz + df > 0) arrivati[id] = dz + df;
      if (df > 0) toChest = true;
    }
    const tot = Object.values(arrivati).reduce((a, b) => a + b, 0);
    v.ui.serra = { arrivati, dove: toChest ? 'nel Forziere' : 'nello zaino' };
    return tot ? `Raccolti ${tot} ingredienti ${v.ui.serra.dove}` : 'Niente di pronto';
  });
}

export function renderSerra(v: View, out: HTMLElement): void {
  const b = v.lot.buildings.find((x) => x.building === 'serra');
  if (!b || b.level < 1) { out.appendChild(el('div', 'mz-rp-note', 'Costruisci la Serra sulla tua isola: fa da sola gli ingredienti base.')); return; }
  const def = building('serra'), rate = def.levels[b.level - 1]?.rate ?? 0;
  const n = ready(v);
  out.appendChild(sec('Pronti', `${rate} all'ora`));
  out.appendChild(el('div', 'mz-rp-big', n ? `${n} ingredienti` : 'Niente di pronto'));
  if (v.ui.serra) {
    const ids = Object.keys(v.ui.serra.arrivati);
    out.appendChild(sec('Appena raccolti', v.ui.serra.dove));
    if (!ids.length) out.appendChild(el('div', 'mz-rp-empty', 'Niente questa volta.'));
    for (const id of ids) {
      const it = hasItem(id) ? itemDef(id) : null;
      const r = el('div', 'mz-rp-row info'); r.dataset['arrivato'] = id;
      if (it) r.appendChild(iconOf(it, 24));
      const t = el('span', 't'); t.append(el('span', 'n', nome(id)), el('span', 'q', `+${v.ui.serra.arrivati[id]}`));
      r.appendChild(t);
      out.appendChild(r);
    }
  }
  const bt = button('serra', 'Raccogli', n ? `${n} pronti` : 'torna più tardi', 'green', v.busy || n < 1, () => harvest(v));
  bt.dataset['act'] = 'serra';
  out.appendChild(bt);
  out.appendChild(el('div', 'mz-rp-cmp', `Fa ${(def.producesItems ?? []).map(nome).join(', ')}. Vanno nel Forziere, o nello zaino se il Forziere non c'è.`));
}

