// Banco da Lavoro (R-pannelli): forgia per materiale e categoria, confronto con quello che hai, costo con quanti ne hai (zaino + Forziere;
// il legno è il Legno del Magazzino), «Forgia» (azione `forgia`). In fondo la Bottega: materiali base con le monete (azione `compra`).
import { MATERIALS, RPG } from '@marea/content/rpg.ts';
import { available, buildingLevel } from '@marea/sim/rpg/bag.ts';
import { modsOf } from '@marea/sim/rpg/derived.ts';
import { ITEMS, hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ItemDef } from '@marea/sim/rpg/types.ts';
import type { LotState } from '@marea/sim';
import { el } from '../ui/style.ts';
import { button, chip, fmtN, iconOf, row, sec, statLines } from './items_ui.ts';
import type { View } from './items_ui.ts';

const CATS: readonly { id: string; nome: string; ok(it: ItemDef): boolean }[] = [
  { id: 'leggere', nome: 'Leggere', ok: (it) => it.kind === 'arma' && it.classe === 'leggera' },
  { id: 'pesanti', nome: 'Pesanti', ok: (it) => it.kind === 'arma' && it.classe === 'pesante' },
  { id: 'archi', nome: 'Archi', ok: (it) => it.kind === 'arco' },
  { id: 'frecce', nome: 'Frecce', ok: (it) => it.kind === 'frecce' },
  { id: 'armature', nome: 'Armature', ok: (it) => it.kind === 'armatura' },
];

type Cost = { id: string; nome: string; need: number; have: number };
/** Costo vero di una forgiata (sconto dei perk come nella sim) e quanto ne hai. */
export function forgeCost(v: View, it: ItemDef): Cost[] {
  const sconto = Math.max(-0.9, modsOf(v.hero).materialiForgia ?? 0);
  return Object.entries(it.forgia?.costo ?? {}).map(([c, q]) => {
    const need = Math.max(1, Math.ceil(q * (1 + sconto)));
    if (c === 'risorsa:legno') return { id: c, nome: 'Legno', need, have: Math.floor(v.lot.resources.legno) };
    return { id: c, nome: hasItem(c) ? itemDef(c).nome : c, need, have: available(v.lot, v.hero, c) };
  });
}

/** Quello che hai ora nello stesso posto (arma in mano, frecce, corpo). */
function current(v: View, it: ItemDef): ItemDef | null {
  const slot = it.kind === 'frecce' ? 'frecce' : it.kind === 'armatura' ? 'corpo' : 'arma';
  const id = v.hero.equip[slot];
  return id && hasItem(id) && (v.hero.inv[id] ?? 0) > 0 ? itemDef(id) : null;
}
function cmpLine(label: string, a: number | undefined, b: number | undefined, higherIsBetter = true, unit = ''): HTMLElement {
  const p = el('p', 'mz-rp-cmp');
  const x = a ?? 0, y = b ?? 0, dlt = Math.round((y - x) * 100) / 100;
  p.append(`${label} ${fmtN(x, 2)}${unit} → `);
  const good = dlt === 0 ? '' : (dlt > 0) === higherIsBetter ? 'up' : 'down';
  p.appendChild(el('span', good, `${fmtN(y, 2)}${unit}${dlt ? ` (${dlt > 0 ? '+' : '−'}${fmtN(Math.abs(dlt), 2)})` : ''}`));
  return p;
}
function compare(v: View, it: ItemDef, box: HTMLElement): void {
  const cur = current(v, it);
  if (cur?.id === it.id) { box.appendChild(el('p', 'mz-rp-ok', 'Ce l\'hai già addosso.')); return; }
  const what = it.kind === 'frecce' ? 'frecce in uso' : it.kind === 'armatura' ? 'quello che indossi' : 'quello che hai in mano';
  box.appendChild(el('p', '', cur ? `Rispetto a ${cur.nome} (${what}):` : `Oggi: niente (${what}).`));
  if (it.kind === 'armatura') {
    box.append(cmpLine('Difesa', cur?.difesa, it.difesa), cmpLine('Peso', cur?.peso, it.peso, false, ' kg'));
  } else if (it.kind === 'frecce') box.appendChild(cmpLine('Danno', cur?.danno, it.danno));
  else {
    box.appendChild(cmpLine('Danno', cur?.danno, it.danno));
    if (it.kind === 'arma' && (!cur || cur.kind === 'arma')) box.appendChild(cmpLine('Velocità', cur?.velocita, it.velocita));
    if (it.kind === 'arco' && cur?.kind === 'arco') box.appendChild(cmpLine('Tendere', cur.tensione, it.tensione, false, ' s'));
  }
}

/** Dove è finito un oggetto nuovo: zaino o Forziere (il server prova prima lo zaino). */
export function whereTo(v: View, l: LotState, id: string): string {
  return (l.hero?.inv[id] ?? 0) > (v.hero.inv[id] ?? 0) ? 'nello zaino' : 'nel Forziere';
}

export function renderForge(v: View, out: HTMLElement): void {
  const lv = buildingLevel(v.lot, 'banco');
  if (lv < 1) { out.appendChild(el('div', 'mz-rp-note', 'Costruisci il Banco da Lavoro sulla tua isola: poi qui forgi armi, archi, frecce e armature.')); return; }
  out.appendChild(sec('Materiale', `Banco L${lv}`));
  const chips = el('div', 'mz-rp-chips');
  for (const m of MATERIALS) chips.appendChild(chip(`mat:${m.id}`, m.nome, v.ui.mat === m.id, () => { v.ui.mat = m.id; v.ui.item = null; v.rerender(); }, m.colore, m.banco > lv));
  out.appendChild(chips);
  const mat = MATERIALS.find((m) => m.id === v.ui.mat) ?? MATERIALS[0]!;
  const locked = mat.banco > lv;
  out.appendChild(sec('Cosa'));
  const cats = el('div', 'mz-rp-chips');
  for (const c of CATS) cats.appendChild(chip(`cat:${c.id}`, c.nome, v.ui.cat === c.id, () => { v.ui.cat = c.id; v.ui.item = null; v.rerender(); }));
  out.appendChild(cats);
  if (locked) out.appendChild(el('div', 'mz-rp-note', `${mat.nome}: serve il Banco da Lavoro di livello ${mat.banco}. Miglioralo sull'isola.`));
  const cat = CATS.find((c) => c.id === v.ui.cat) ?? CATS[0]!;
  const list = ITEMS.filter((it) => it.forgia && it.materiale === mat.id && cat.ok(it));
  if (!list.length) out.appendChild(el('div', 'mz-rp-empty', 'Niente da forgiare qui.'));
  for (const it of list) {
    const cost = forgeCost(v, it), ok = cost.every((c) => c.have >= c.need), open = v.ui.item === it.id;
    const c0 = cost[0];
    const r = row(`forgia:${it.id}`, iconOf(it, 24), it.nome, c0 ? `costo ${c0.need} ${c0.nome} · hai ${c0.have}` : '', open, () => { v.ui.item = open ? null : it.id; v.rerender(); });
    r.dataset['item'] = it.id;
    if (locked || !ok) r.classList.add('dim');
    out.appendChild(r);
    if (!open) continue;
    const box = el('div', 'mz-rp-det'); box.dataset['det'] = it.id;
    box.appendChild(el('p', '', it.descr));
    for (const l of statLines(it)) box.appendChild(el('p', 'mz-rp-cmp', l));
    compare(v, it, box);
    for (const c of cost) {
      const line = el('div', 'mz-rp-cost');
      line.append(el('span', '', `${c.need} × ${c.nome}`), el('span', 'have ' + (c.have >= c.need ? 'mz-rp-ok' : 'mz-rp-bad'), `hai ${c.have}`));
      box.appendChild(line);
    }
    const n = it.forgia?.n ?? 1;
    const why = locked ? `serve Banco L${mat.banco}` : !ok ? 'materiale insufficiente' : n > 1 ? `×${n}` : '';
    const b = button(`do:${it.id}`, 'Forgia', why, '', v.busy || locked || !ok,
      () => v.act({ t: 'forgia', item: it.id }, (l) => `Forgiato: ${it.nome}${n > 1 ? ` ×${n}` : ''} ${whereTo(v, l, it.id)}`));
    b.dataset['act'] = 'forgia';
    box.appendChild(b);
    out.appendChild(box);
  }
  bottega(v, out);
}

function bottega(v: View, out: HTMLElement): void {
  out.appendChild(sec('Bottega', `${v.hero.monete} monete`));
  for (const [id, prezzo] of Object.entries(RPG.bottega)) {
    if (!hasItem(id)) continue;
    const it = itemDef(id), have = available(v.lot, v.hero, id);
    const head = el('div', 'mz-rp-row info'); head.dataset['shop'] = id;
    const t = el('span', 't'); t.append(el('span', 'n', it.nome), el('span', 'q', `${prezzo} monete l'uno · hai ${have}`));
    head.append(iconOf(it, 24), t);
    out.appendChild(head);
    const r = el('div', 'mz-row');
    for (const n of [1, 5]) {
      const tot = prezzo * n;
      const b = button(`compra:${id}:${n}`, `Compra ${n}`, `${tot} monete`, n === 1 ? 'green' : 'ghost', v.busy || v.hero.monete < tot,
        () => v.act({ t: 'compra', item: id, n }, (l) => `Comprato: ${n} × ${it.nome} ${whereTo(v, l, id)}`));
      b.dataset['act'] = 'compra';
      r.appendChild(b);
    }
    out.appendChild(r);
  }
}
