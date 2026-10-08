// Banco del Contrabbandiere al Porto (il Furetto, accanto alla Grotta): la merce di oggi (un'arma, un'armatura, un materiale, un
// ingrediente; cambia a mezzanotte) e «Ti compro»: tutto lo zaino a poco (azione `contrabbando`, monete). Si compra e si vende nello zaino;
// quello che hai addosso no. Roba di valore (armi, armature, anelli, libri…): il primo tocco chiede conferma.
import { CATEGORIE_LOSCHE, bancoDi, finoAMezzanotte, offertaLosca, prezzoLosco } from '@marea/sim/rpg/contrabbando.ts';
import type { CategoriaLosca } from '@marea/sim/rpg/contrabbando.ts';
import { caricoMaxOf, carriedOf } from '@marea/sim/rpg/derived.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { HeroState, ItemDef } from '@marea/sim/rpg/types.ts';
import { el } from '../ui/style.ts';
import { GROUPS, button, fmtKg, iconOf, sec, statLines } from './items_ui.ts';
import type { View } from './items_ui.ts';

const CAT_NOME: Record<CategoriaLosca, string> = { arma: 'Arma', armatura: 'Armatura', materiale: 'Materiale', ingrediente: 'Ingrediente' };
/** Roba a pezzi (si vende a manciate senza conferma). */
const SFUSA = new Set(['materiale', 'ingrediente', 'pozione', 'frecce']);
/** Primo tocco su «Vendi» di roba di valore: aspetta il secondo (stesso oggetto e quantità). */
let conferma: { item: string; n: number } | null = null;

const addosso = (h: HeroState, id: string): number => Object.entries(h.equip).filter(([s, x]) => s !== 'magia' && x === id).length;
function fraTempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000)), h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}
function info(it: ItemDef, sub: string): HTMLElement {
  const r = el('div', 'mz-rp-row info'), t = el('span', 't');
  t.append(el('span', 'n', it.nome), el('span', 'q', sub));
  r.append(iconOf(it, 24), t);
  return r;
}

export function renderContrabbando(v: View, out: HTMLElement, battuta: string): void {
  const h = v.hero, now = Date.now(), oggi = bancoDi(now);
  if (battuta) out.appendChild(el('p', 'mz-rp-cmp', `«${battuta}»`));

  // ---- la merce di oggi ----
  out.appendChild(sec('Oggi sul banco', `merce nuova tra ${fraTempo(finoAMezzanotte(now))}`));
  const libero = caricoMaxOf(h) - carriedOf(h);
  for (const cat of CATEGORIE_LOSCHE) {
    const id = oggi[cat];
    if (!hasItem(id)) continue;
    const it = itemDef(id), prezzo = prezzoLosco(id);
    const head = info(it, `${CAT_NOME[cat]} · ${prezzo} monete · hai ${h.inv[id] ?? 0}`); head.dataset['losco'] = cat;
    out.appendChild(head);
    if (cat === 'arma' || cat === 'armatura') out.appendChild(el('p', 'mz-rp-cmp', statLines(it).join(' · ')));
    const r = el('div', 'mz-row');
    for (const n of cat === 'arma' || cat === 'armatura' ? [1] : [1, 5]) {
      const tot = prezzo * n, pesa = it.peso * n > libero + 1e-9;
      const b = button(`losco:${id}:${n}`, `Compra ${n}`, pesa ? 'zaino pieno' : `${tot} monete`, n === 1 ? 'green' : 'ghost', v.busy || h.monete < tot || pesa,
        () => v.act({ t: 'contrabbando', op: 'compra', item: id, n }, () => `Comprato: ${n} × ${it.nome} (nello zaino)`));
      b.dataset['act'] = 'losco-compra';
      r.appendChild(b);
    }
    out.appendChild(r);
  }

  // ---- ti compro: lo zaino ----
  out.appendChild(sec('Ti compro', `zaino ${fmtKg(carriedOf(h))} / ${fmtKg(caricoMaxOf(h))}`));
  out.appendChild(el('p', 'mz-rp-cmp', 'Paga poco, ma è meglio che buttare. Quello che hai addosso non lo prende.'));
  let tanti = 0;
  for (const g of GROUPS) {
    const ids = Object.keys(h.inv).filter((id) => (h.inv[id] ?? 0) > 0 && hasItem(id) && g.kinds.includes(itemDef(id).kind)).sort((a, b) => itemDef(a).nome.localeCompare(itemDef(b).nome));
    for (const id of ids) {
      const it = itemDef(id), n = h.inv[id] ?? 0, liberi = n - addosso(h, id), uno = offertaLosca(id, 1);
      tanti++;
      const head = info(it, `×${n}${liberi < n ? ` (${n - liberi} addosso)` : ''} · ${uno > 0 ? `${uno} monete l'uno` : `${offertaLosca(id, n)} monete per ${n}`}`);
      head.dataset['vendi'] = id;
      out.appendChild(head);
      const r = el('div', 'mz-row');
      for (const q of liberi > 1 ? [1, liberi] : [liberi]) {
        if (q < 1) { r.appendChild(button(`vendi:${id}:0`, 'Vendi', 'ce l\'hai addosso', 'ghost', true, () => {})); continue; }
        const paga = offertaLosca(id, q), chiede = conferma?.item === id && conferma.n === q;
        const main = chiede ? 'Sicuro? Tocca ancora' : q === 1 ? 'Vendi 1' : `Vendi tutti (${q})`;
        const b = button(`vendi:${id}:${q}`, main, paga > 0 ? `+${paga} monete` : 'non vale niente', chiede ? 'butta sicuro' : q === 1 ? '' : 'ghost', v.busy || paga < 1, () => {
          if (!SFUSA.has(it.kind) && !chiede) { conferma = { item: id, n: q }; v.rerender(); return; }
          conferma = null;
          v.act({ t: 'contrabbando', op: 'vendi', item: id, n: q }, () => `Venduto: ${q} × ${it.nome} per ${paga} monete`);
        });
        b.dataset['act'] = 'losco-vendi';
        r.appendChild(b);
      }
      out.appendChild(r);
    }
  }
  if (!tanti) out.appendChild(el('div', 'mz-rp-note', 'Zaino vuoto: torna quando hai qualcosa da piazzare.'));
}
