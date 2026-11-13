// Colonna «Equipaggiato» dello zaino: la sagoma a pixel (rpg/bambola.ts) con gli slot attorno, tutti toccabili: arma, frecce e corpo a sinistra;
// magia in mano, due anelli e pozione rapida a destra. Uno slot pieno apre l'oggetto nella sua categoria, uno vuoto apre la categoria giusta.
import { SPELLS } from '@marea/content/rpg.ts';
import { heroDerived } from '@marea/sim/rpg/hero.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ItemDef, SlotOggetto } from '@marea/sim/rpg/types.ts';
import { el, PAL } from '../ui/style.ts';
import { bambola } from './bambola.ts';
import { SLOT_NOME, bar, coloreMagia, fmtKg, iconOf, iconaMagia, palColor } from './items_ui.ts';
import type { View } from './items_ui.ts';

const SLOTS: readonly SlotOggetto[] = ['arma', 'corpo', 'frecce', 'pozione', 'anello1', 'anello2'];
const TAG: Record<SlotOggetto, string> = { arma: 'in mano', frecce: 'in uso', corpo: 'indossata', anello1: 'al dito', anello2: 'al dito', pozione: 'rapida' };

/** Le mani tengono la magia preparata: l'arma equipaggiata sta a riposo. */
export const inMano = (v: View): boolean => v.hero.equip.mano === 'magia' && !!v.hero.equip.magia;
/** Cosa dire di un oggetto equipaggiato nello slot: l'arma con una magia in mano è «a riposo». */
export const tag = (v: View, s: SlotOggetto): string => (s === 'arma' && inMano(v) ? 'a riposo' : TAG[s]);

/** Slot in cui l'oggetto è equipaggiato (e davvero nello zaino). */
export function slotsOf(v: View, id: string): SlotOggetto[] {
  return SLOTS.filter((s) => v.hero.equip[s] === id && (v.hero.inv[id] ?? 0) > 0);
}

const equipato = (v: View, s: SlotOggetto): ItemDef | null => {
  const id = v.hero.equip[s];
  return id && hasItem(id) && (v.hero.inv[id] ?? 0) > 0 ? itemDef(id) : null;
};

type Posto = { slot: SlotOggetto | 'magia'; cat: string };
const SINISTRA: readonly Posto[] = [{ slot: 'arma', cat: 'armi' }, { slot: 'frecce', cat: 'archi' }, { slot: 'corpo', cat: 'armature' }];
const DESTRA: readonly Posto[] = [{ slot: 'magia', cat: 'magie' }, { slot: 'anello1', cat: 'anelli' }, { slot: 'anello2', cat: 'anelli' }, { slot: 'pozione', cat: 'pozioni' }];

/** `apri(categoria, oggetto)`: oggetto null = solo la categoria. */
export function renderDoll(v: View, apri: (cat: string, item: string | null) => void): HTMLElement {
  const h = v.hero, d = heroDerived(h);
  const box = el('div', 'zn-eq');
  const arma = equipato(v, 'arma'), corpo = equipato(v, 'corpo');
  const mag = h.equip.magia && h.magie.includes(h.equip.magia) ? SPELLS.find((s) => s.id === h.equip.magia) ?? null : null;

  const slot = (p: Posto): HTMLElement => {
    const it = p.slot === 'magia' ? null : equipato(v, p.slot);
    const nome = p.slot === 'magia' ? mag?.nome : it?.nome;
    const pieno = !!nome;
    const b = el('button', 'zn-slot' + (pieno ? ' full' : '') + (it && v.ui.item === it.id ? ' on' : ''));
    b.type = 'button'; b.dataset['k'] = `slot:${p.slot}`; b.dataset['slot'] = p.slot; b.title = SLOT_NOME[p.slot];
    b.setAttribute('aria-label', `${SLOT_NOME[p.slot]}: ${nome ?? 'vuoto'}`);
    b.appendChild(el('span', 'ic'));
    const ic = b.firstElementChild as HTMLElement;
    if (it) ic.appendChild(iconOf(it, 28)); else if (p.slot === 'magia' && mag) ic.appendChild(iconaMagia(mag.id, 28));
    b.appendChild(el('span', 'k', SLOT_NOME[p.slot]));
    b.appendChild(el('span', 'v', nome ?? 'vuoto'));
    const t = p.slot === 'magia' ? (mag && inMano(v) ? 'in mano' : '') : it && p.slot === 'arma' && inMano(v) ? 'a riposo' : '';
    if (t) b.appendChild(el('span', 'tg', t));
    b.addEventListener('click', () => apri(p.cat, it?.id ?? null));
    return b;
  };

  const riga = el('div', 'zn-fig');
  const col = (lista: readonly Posto[], cls: string): HTMLElement => { const c = el('div', 'zn-col ' + cls); for (const p of lista) c.appendChild(slot(p)); return c; };
  const anelli = (['anello1', 'anello2'] as const).filter((s) => equipato(v, s)).length;
  const fig = el('div', 'zn-sagoma');
  fig.appendChild(bambola({
    arma, corpo, anelli,
    magia: mag && inMano(v) ? coloreMagia(mag.id, mag.scuola) : null,
    colArma: arma ? palColor(arma.colore) : PAL.pietra, colCorpo: corpo ? palColor(corpo.colore) : PAL.acquaBassa,
  }));
  riga.append(col(SINISTRA, 'l'), fig, col(DESTRA, 'r'));
  box.appendChild(riga);

  const peso = el('div', 'zn-peso');
  peso.append(el('span', '', 'Peso'), el('b', '', `${fmtKg(d.carico)} / ${fmtKg(d.caricoMax)}`));
  box.append(peso, bar(d.carico / Math.max(1, d.caricoMax), d.carico > d.caricoMax * 0.9 ? PAL.rosso : PAL.legnoChiaro));
  return box;
}
