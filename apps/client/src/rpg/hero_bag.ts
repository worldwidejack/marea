// Scheda «Zaino» (R-pannelli): slot equipaggiati in alto, magia preparata, oggetti raggruppati con quantità e peso; tocchi un oggetto →
// descrizione, statistiche ed Equipaggia/Togli/Leggi e Butta via (due tocchi: il secondo conferma). Azioni `equip`, `leggi`, `butta` su
// /api/rpg; nel dungeon (v.sotto) equip e butta vanno alla sim della spedizione, Leggi aspetta l'isola.
import { SPELLS, spellDef } from '@marea/content/rpg.ts';
import { heroDerived } from '@marea/sim/rpg/hero.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { EquipSlot, ItemDef } from '@marea/sim/rpg/types.ts';
import { el } from '../ui/style.ts';
import { GROUPS, SLOT_NOME, button, chip, fmtKg, iconOf, row, sec, statLines } from './items_ui.ts';
import type { View } from './items_ui.ts';

const SLOTS: readonly Exclude<EquipSlot, 'magia'>[] = ['arma', 'corpo', 'frecce', 'pozione', 'anello1', 'anello2'];
const TAG: Record<Exclude<EquipSlot, 'magia'>, string> = { arma: 'in mano', frecce: 'in uso', corpo: 'indossata', anello1: 'al dito', anello2: 'al dito', pozione: 'rapida' };
const SLOT_OF: Partial<Record<string, Exclude<EquipSlot, 'magia' | 'anello1' | 'anello2'>>> = { arma: 'arma', arco: 'arma', frecce: 'frecce', armatura: 'corpo', veste: 'corpo', pozione: 'pozione' };

/** Slot in cui l'oggetto è equipaggiato (e davvero nello zaino). */
function slotsOf(v: View, id: string): Exclude<EquipSlot, 'magia'>[] {
  return SLOTS.filter((s) => v.hero.equip[s] === id && (v.hero.inv[id] ?? 0) > 0);
}

export function renderBag(v: View, out: HTMLElement): void {
  const h = v.hero, d = heroDerived(h);
  out.appendChild(sec('Equipaggiato'));
  const grid = el('div', 'mz-rp-slots');
  for (const s of SLOTS) {
    const id = h.equip[s];
    const it = id && hasItem(id) && (h.inv[id] ?? 0) > 0 ? itemDef(id) : null;
    const b = el('button', 'mz-rp-slot' + (it ? ' full' : '') + (it && v.ui.item === it.id ? ' on' : ''));
    b.type = 'button'; b.dataset['k'] = `slot:${s}`; b.dataset['slot'] = s;
    if (it) b.appendChild(iconOf(it, 24));
    const t = el('span'); t.append(el('span', 'k', SLOT_NOME[s]), el('span', 'v', it ? it.nome : 'vuoto'));
    b.appendChild(t);
    b.addEventListener('click', () => {
      if (!it) { v.ctx.hud.toast(`${SLOT_NOME[s]}: scegli un oggetto qui sotto`); return; }
      v.ui.item = it.id; v.ui.focus = `item:${it.id}`; v.rerender();
    });
    grid.appendChild(b);
  }
  out.appendChild(grid);

  // magia preparata (tasto C nel dungeon)
  out.appendChild(sec('Magia preparata', 'tasto C'));
  if (!h.magie.length) out.appendChild(el('div', 'mz-rp-empty', 'Nessuna magia: leggi un libro.'));
  else {
    const chips = el('div', 'mz-rp-chips');
    for (const id of h.magie) {
      const s = SPELLS.find((x) => x.id === id);
      if (!s) continue;
      const on = h.equip.magia === id;
      const c = chip(`magia:${id}`, s.nome, on, () => { if (!on && !v.busy) v.act({ t: 'equip', slot: 'magia', item: id }, () => `Magia preparata: ${s.nome}`); });
      c.dataset['magia'] = id;
      chips.appendChild(c);
    }
    out.appendChild(chips);
    const cur = h.equip.magia ? SPELLS.find((x) => x.id === h.equip.magia) : undefined;
    if (cur) out.appendChild(el('div', 'mz-rp-cmp', `${cur.descr} Costa ${cur.costo} Magicka.`));
  }

  out.appendChild(sec('Zaino', `${fmtKg(d.carico)} / ${fmtKg(d.caricoMax)}`));
  const ids = Object.keys(h.inv).filter((id) => (h.inv[id] ?? 0) > 0 && hasItem(id));
  if (!ids.length) out.appendChild(el('div', 'mz-rp-empty', 'Zaino vuoto.'));
  for (const g of GROUPS) {
    const items = ids.map((id) => itemDef(id)).filter((it) => g.kinds.includes(it.kind)).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    if (!items.length) continue;
    const w = items.reduce((s, it) => s + it.peso * (h.inv[it.id] ?? 0), 0);
    out.appendChild(sec(g.nome, fmtKg(w)));
    for (const it of items) {
      const n = h.inv[it.id] ?? 0, open = v.ui.item === it.id, eq = slotsOf(v, it.id);
      const r = row(`item:${it.id}`, iconOf(it, 24), it.nome, `×${n} · ${fmtKg(it.peso * n)}`, open, () => { v.ui.item = open ? null : it.id; v.ui.butta = null; v.rerender(); });
      r.dataset['item'] = it.id;
      if (eq.length) r.appendChild(el('span', 'eq', TAG[eq[0]!]));
      out.appendChild(r);
      if (open) out.appendChild(detail(v, it, eq));
    }
  }
}

function detail(v: View, it: ItemDef, eq: Exclude<EquipSlot, 'magia'>[]): HTMLElement {
  const box = el('div', 'mz-rp-det'); box.dataset['det'] = it.id;
  box.appendChild(el('p', '', it.descr));
  for (const l of statLines(it)) box.appendChild(el('p', 'mz-rp-cmp', l));
  const equip = (slot: EquipSlot, item: string | null, msg: string) => v.act({ t: 'equip', slot, item }, () => msg);
  const slot = SLOT_OF[it.kind];
  if (slot) {
    const on = eq.includes(slot);
    const b = button(`eq:${it.id}`, on ? 'Togli' : it.kind === 'pozione' ? 'Pozione rapida' : 'Equipaggia', on ? SLOT_NOME[slot] : `→ ${SLOT_NOME[slot]}`, on ? 'ghost' : 'green', v.busy,
      () => (on ? equip(slot, null, `Tolto: ${it.nome}`) : equip(slot, it.id, `${SLOT_NOME[slot]}: ${it.nome}`)));
    b.dataset['act'] = on ? 'togli' : 'equipaggia';
    box.appendChild(b);
  } else if (it.kind === 'anello') {
    const r = el('div', 'mz-row');
    for (const s of ['anello1', 'anello2'] as const) {
      const on = eq.includes(s);
      const b = button(`eq:${it.id}:${s}`, on ? `Togli (${s === 'anello1' ? '1' : '2'})` : SLOT_NOME[s], '', on ? 'ghost' : 'green', v.busy,
        () => (on ? equip(s, null, `Tolto: ${it.nome}`) : equip(s, it.id, `${SLOT_NOME[s]}: ${it.nome}`)));
      b.dataset['act'] = on ? 'togli' : 'equipaggia';
      r.appendChild(b);
    }
    box.appendChild(r);
  } else if (it.kind === 'libro' && it.insegna) {
    let s;
    try { s = spellDef(it.insegna); } catch { s = null; }
    if (s) {
      const known = v.hero.magie.includes(s.id);
      const why = v.sotto ? 'Leggi fuori dal dungeon' : known ? 'La conosci già' : '';
      box.appendChild(el('p', '', `Insegna: ${s.nome}. ${s.descr}`));
      const b = button(`leggi:${it.id}`, 'Leggi', why || `impari ${s.nome}`, '', v.busy || !!why, () => v.act({ t: 'leggi', item: it.id }, () => `Hai imparato: ${s.nome}`));
      b.dataset['act'] = 'leggi';
      box.appendChild(b);
    }
  } else if (it.kind === 'materiale') box.appendChild(el('p', 'mz-rp-warn', 'Serve per forgiare al Banco da Lavoro.'));
  else if (it.kind === 'ingrediente') box.appendChild(el('p', 'mz-rp-warn', 'Serve al Tavolo Alchemico.'));
  box.appendChild(buttaVia(v, it, eq));
  return box;
}

/** «Butta via» (1 o tutti): il primo tocco chiede conferma sullo stesso bottone, il secondo butta. Gli oggetti spariscono. */
function buttaVia(v: View, it: ItemDef, eq: Exclude<EquipSlot, 'magia'>[]): HTMLElement {
  const n = v.hero.inv[it.id] ?? 0;
  const r = el('div', 'mz-rp-butta');
  const one = (q: number, label: string) => {
    const sure = v.ui.butta?.item === it.id && v.ui.butta.n === q;
    const lascia = eq.length > 0 && q >= n ? 'è in uso: lo togli' : '';
    const b = button(`butta:${it.id}:${q}`, sure ? `Sicuro? Butta via${q > 1 ? ` ×${q}` : ''}` : label, sure ? 'tocca di nuovo' : lascia, sure ? 'butta sicuro' : 'butta', v.busy, () => {
      if (!sure) { v.ui.butta = { item: it.id, n: q }; v.ui.focus = `butta:${it.id}:${q}`; v.rerender(); return; }
      v.ui.butta = null;
      if (q >= n) v.ui.item = null;
      v.act({ t: 'butta', item: it.id, n: q }, () => `Buttato via: ${q > 1 ? `${q} × ` : ''}${it.nome}`);
    });
    b.dataset['act'] = sure ? 'butta-sicuro' : 'butta';
    return b;
  };
  r.appendChild(one(1, n > 1 ? 'Butta via 1' : 'Butta via'));
  if (n > 1) r.appendChild(one(n, `Butta via tutti (×${n})`));
  return r;
}
