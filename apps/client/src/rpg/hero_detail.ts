// Dettaglio di un oggetto dello zaino (sotto la riga toccata): descrizione, statistiche e azioni (Equipaggia/Togli/Impugna, Bevi, Leggi,
// Butta via con conferma al secondo tocco). Nel dungeon (v.sotto) equip e butta vanno alla sim, Leggi aspetta l'isola.
import { spellDef } from '@marea/content/rpg.ts';
import type { ItemDef, SlotOggetto } from '@marea/sim/rpg/types.ts';
import { el } from '../ui/style.ts';
import { inMano } from './hero_doll.ts';
import { SLOT_NOME, button, statLines } from './items_ui.ts';
import type { View } from './items_ui.ts';

const SLOT_OF: Partial<Record<string, Exclude<SlotOggetto, 'anello1' | 'anello2'>>> = { arma: 'arma', arco: 'arma', frecce: 'frecce', armatura: 'corpo', veste: 'corpo', pozione: 'pozione' };

export function detail(v: View, it: ItemDef, eq: SlotOggetto[]): HTMLElement {
  const box = el('div', 'mz-rp-det'); box.dataset['det'] = it.id;
  box.appendChild(el('p', '', it.descr));
  for (const l of statLines(it)) box.appendChild(el('p', 'mz-rp-cmp', l));
  const equip = (slot: SlotOggetto, item: string | null, msg: string) => v.act({ t: 'equip', slot, item }, () => msg);
  if (it.kind === 'pozione' && v.bevi) {
    const bevi = v.bevi;
    const b = button(`bevi:${it.id}`, 'Bevi', 'subito', 'green', v.busy, () => bevi(it.id, it.nome));
    b.dataset['act'] = 'bevi';
    box.appendChild(b);
  }
  const slot = SLOT_OF[it.kind];
  if (slot) {
    const on = eq.includes(slot);
    const riposta = on && slot === 'arma' && inMano(v); // equipaggiata ma con la magia in mano: si rimpugna
    const b = riposta
      ? button(`eq:${it.id}`, 'Impugna', 'rimetti l’arma in mano', 'green', v.busy, () => equip('arma', it.id, `In mano: ${it.nome}`))
      : button(`eq:${it.id}`, on ? 'Togli' : it.kind === 'pozione' ? 'Pozione rapida' : 'Equipaggia', on ? SLOT_NOME[slot] : `→ ${SLOT_NOME[slot]}`, on ? 'ghost' : 'green', v.busy,
        () => (on ? equip(slot, null, `Tolto: ${it.nome}`) : equip(slot, it.id, `${SLOT_NOME[slot]}: ${it.nome}`)));
    b.dataset['act'] = riposta ? 'impugna' : on ? 'togli' : 'equipaggia';
    box.appendChild(b);
    if (slot === 'corpo' && on) {
      const fuori = !!v.hero.armaturaFuori;
      const bFuori = button(
        `eq_fuori:${it.id}`,
        fuori ? 'Mostra vestito fuori' : 'Indossa anche fuori',
        fuori ? 'ora si vede l’armatura nell’overworld' : 'si vedrà addosso anche nell’overworld',
        fuori ? 'ghost' : 'green',
        v.busy || v.sotto,
        () => v.act({ t: 'armatura_fuori', attiva: !fuori }, () => (fuori ? 'Nell’overworld si vede il vestito' : 'Armatura visibile anche nell’overworld'))
      );
      bFuori.dataset['act'] = 'armatura_fuori';
      box.appendChild(bFuori);
    }
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
  else if (it.kind === 'strumento') box.appendChild(el('p', 'mz-rp-warn', it.id === 'retino' ? 'Si usa a Borgo Marea per catturare gli insetti: mettilo in mano col bottone dell’attrezzo o col tasto Q. Non pesa nello zaino.' : it.id === 'canna' ? 'Si pesca dalle rive di Borgo Marea (mettila in mano col bottone dell’attrezzo o col tasto Q) e dalla barca ferma in mare aperto. Non pesa nello zaino.' : 'Si usa a Borgo Marea per scavare buche e cercare tesori. Non pesa nello zaino.'));
  else if (it.kind === 'pesce') box.appendChild(el('p', 'mz-rp-warn', 'Non pesa nello zaino. Portalo a Fulvio, al negozio del Borgo, e lo registra nel Diario (si sblocca la sua scheda); al Contrabbandiere lo vendi, ma nel Diario non risulta.'));
  else if (it.kind === 'insetto') box.appendChild(el('p', 'mz-rp-warn', 'Non pesa nello zaino. Portalo a Fulvio, al negozio del Borgo, e lo registra nel Diario (si sblocca la sua scheda); al Contrabbandiere lo vendi, ma nel Diario non risulta.'));
  if (it.kind !== 'strumento') box.appendChild(buttaVia(v, it, eq));
  return box;
}

/** «Butta via» (1 o tutti): il primo tocco chiede conferma sullo stesso bottone, il secondo butta. Gli oggetti spariscono. */
function buttaVia(v: View, it: ItemDef, eq: SlotOggetto[]): HTMLElement {
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
