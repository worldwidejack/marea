// Scheda «Zaino» (R-pannelli): a sinistra l'equipaggiato con la sagoma del personaggio (rpg/hero_doll.ts), a destra le categorie e, una
// alla volta, gli oggetti della categoria scelta; tocchi un oggetto → descrizione, statistiche ed Equipaggia/Togli/Leggi e Butta via
// (rpg/hero_detail.ts). Le magie conosciute sono la categoria «Magie»: un tocco le impugna, un secondo rimette l'arma.
// Azioni `equip`, `leggi`, `butta` su /api/rpg; nel dungeon (v.sotto) equip e butta vanno alla sim della spedizione.
import { SPELLS } from '@marea/content/rpg.ts';
import type { ItemKind } from '@marea/content/rpg.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ItemDef } from '@marea/sim/rpg/types.ts';
import { el, PAL } from '../ui/style.ts';
import { detail } from './hero_detail.ts';
import { inMano, renderDoll, slotsOf, tag } from './hero_doll.ts';
import { GROUPS, fmtKg, iconOf, iconaMagia, itemIcon, row, sec } from './items_ui.ts';
import type { View } from './items_ui.ts';

/** Strumenti, insetti e pesci stanno nella Borsa (rpg/borsa_ui.ts), non nello zaino del personaggio. */
const NELLA_BORSA: readonly string[] = ['strumento', 'insetto', 'pesce'];
/** Le categorie nell'ordine in cui si mostrano; l'icona è quella del tipo. */
const ORDINE: readonly { id: string; kind: ItemKind; col: string }[] = [
  { id: 'armi', kind: 'arma', col: PAL.pietraChiara }, { id: 'archi', kind: 'arco', col: PAL.legnoChiaro }, { id: 'magie', kind: 'libro', col: PAL.viola },
  { id: 'armature', kind: 'armatura', col: PAL.pietra }, { id: 'anelli', kind: 'anello', col: PAL.giallo }, { id: 'pozioni', kind: 'pozione', col: PAL.rosso },
  { id: 'libri', kind: 'libro', col: PAL.acquaBassa }, { id: 'materiali', kind: 'materiale', col: PAL.pietraScura }, { id: 'ingredienti', kind: 'ingrediente', col: PAL.erba },
];
const NOME_MAGIE = 'Magie';
/** Scorrimento della fascia delle categorie: sopravvive ai ridisegni della scheda. */
let fasciaX = 0;

/** Categoria di un oggetto. */
const catDi = (it: ItemDef): string => GROUPS.find((g) => g.kinds.includes(it.kind))?.id ?? 'materiali';

export function renderBag(v: View, out: HTMLElement): void {
  const h = v.hero;
  const ids = Object.keys(h.inv).filter((id) => (h.inv[id] ?? 0) > 0 && hasItem(id) && !NELLA_BORSA.includes(itemDef(id).kind));
  const di = (id: string): ItemDef[] => ids.map((x) => itemDef(x)).filter((it) => catDi(it) === id).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  const conta = (id: string): number => (id === 'magie' ? h.magie.length : di(id).length);
  const nome = (id: string): string => (id === 'magie' ? NOME_MAGIE : GROUPS.find((g) => g.id === id)?.nome ?? id);

  const piene = ORDINE.filter((c) => conta(c.id) > 0);
  const scelta = v.ui.cat && ORDINE.some((c) => c.id === v.ui.cat) ? v.ui.cat : piene[0]?.id ?? 'armi';
  v.ui.cat = scelta;
  const visibili = piene.some((c) => c.id === scelta) ? piene : ORDINE.filter((c) => c.id === scelta || conta(c.id) > 0);

  const apri = (cat: string, item: string | null): void => {
    v.ui.cat = item && hasItem(item) ? catDi(itemDef(item)) : cat;
    v.ui.item = item; v.ui.butta = null; v.ui.focus = item ? `item:${item}` : null;
    v.rerender();
  };

  const zn = el('div', 'zn');
  zn.appendChild(renderDoll(v, apri));
  const dx = el('div', 'zn-dx');

  const fascia = el('div', 'zn-cats'); fascia.setAttribute('role', 'tablist');
  for (const c of visibili) {
    const on = c.id === scelta;
    const b = el('button', 'zn-cat' + (on ? ' on' : ''));
    b.type = 'button'; b.dataset['k'] = `cat:${c.id}`; b.dataset['cat'] = c.id; b.setAttribute('role', 'tab'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.append(itemIcon(c.kind, c.col, 22), el('span', 'n', nome(c.id)), el('i', '', String(conta(c.id))));
    b.addEventListener('click', () => { if (!on) apri(c.id, null); });
    fascia.appendChild(b);
  }
  fascia.addEventListener('scroll', () => { fasciaX = fascia.scrollLeft; });
  queueMicrotask(() => { fascia.scrollLeft = fasciaX; fascia.querySelector<HTMLElement>('.zn-cat.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); });
  dx.appendChild(fascia);

  const lista = el('div', 'zn-lista'); lista.dataset['cat'] = scelta;
  if (scelta === 'magie') magie(v, lista);
  else {
    const items = di(scelta);
    lista.appendChild(sec(nome(scelta), items.length ? fmtKg(items.reduce((s, it) => s + it.peso * (h.inv[it.id] ?? 0), 0)) : ''));
    if (!items.length) lista.appendChild(el('div', 'mz-rp-empty', 'Qui non hai niente.'));
    for (const it of items) {
      const n = h.inv[it.id] ?? 0, open = v.ui.item === it.id, eq = slotsOf(v, it.id);
      const r = row(`item:${it.id}`, iconOf(it, 28), it.nome, `×${n} · ${fmtKg(it.peso * n)}`, open, () => { v.ui.item = open ? null : it.id; v.ui.butta = null; v.rerender(); });
      r.dataset['item'] = it.id;
      if (eq.length) r.appendChild(el('span', 'eq', tag(v, eq[0]!)));
      lista.appendChild(r);
      if (open) lista.appendChild(detail(v, it, eq));
    }
  }
  dx.appendChild(lista);
  zn.appendChild(dx);
  out.appendChild(zn);
}

/** Categoria «Magie» (magia in mano): si sceglie come un'arma, occupa le mani e si lancia con la A; di nuovo sulla magia in mano rimette l'arma. */
function magie(v: View, out: HTMLElement): void {
  const h = v.hero;
  out.appendChild(sec(NOME_MAGIE, inMano(v) ? 'tieni A per mirare, lascia per lanciare · C alterna' : 'tocca per impugnarla · C alterna'));
  if (!h.magie.length) { out.appendChild(el('div', 'mz-rp-empty', 'Nessuna magia: leggi un libro.')); return; }
  for (const id of h.magie) { // una sotto l'altra, come gli oggetti dello zaino: icona, nome, costo
    const s = SPELLS.find((x) => x.id === id);
    if (!s) continue;
    const on = h.equip.magia === id && inMano(v);
    const r = row(`magia:${id}`, iconaMagia(id, 28), s.nome, `${s.costo} Magicka${s.forma === 'raggio' ? ' al secondo' : ''}`, on, () => {
      if (v.busy) return;
      if (on) v.act({ t: 'equip', slot: 'mano', item: null }, () => 'Arma in mano');
      else v.act({ t: 'equip', slot: 'magia', item: id }, () => `In mano: ${s.nome}`);
    });
    r.dataset['magia'] = id; r.removeAttribute('aria-expanded');
    if (on) r.appendChild(el('span', 'eq', 'in mano'));
    out.appendChild(r);
  }
  const cur = h.equip.magia ? SPELLS.find((x) => x.id === h.equip.magia) : undefined;
  if (cur) out.appendChild(el('div', 'mz-rp-cmp', `${cur.descr} Costa ${cur.costo} Magicka${cur.forma === 'raggio' ? ' al secondo' : ''}.`));
}
