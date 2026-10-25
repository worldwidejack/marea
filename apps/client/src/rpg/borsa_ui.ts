// Pannello della Borsa (chunk, caricato da ui/borsa.ts; sta in rpg/ perché legge gli oggetti del personaggio): schede Vestiti, Cappelli, Strumenti, Insetti e pesci, Mobili.
// Vestiti e cappelli: quelli tuoi (gratis o comprati dal Mercante), col loro disegno (assets/abiti/<modello>.png); un tocco e lo indossi
// (POST /api/look, come INDOSSA dal Mercante). Strumenti, insetti e pesci vengono dallo zaino del personaggio (`lot.hero.inv`, oggetti
// `strumento` / `insetto` / `pesce`: non pesano); i mobili dal magazzino di casa (si posano con ARREDA).
import { AVATAR, DECOR, MOBILI } from '@marea/content';
import { casaDi, ownsAbito, ownsHat } from '@marea/sim';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { Look } from '@marea/protocol';
import { disegnoAbito, disegnoCappello } from '../game/abiti.ts';
import { iconOf } from './items_ui.ts';
import { registerStateProvider } from '../test/testapi.ts';
import type { Borsa, BorsaOpts } from '../ui/borsa.ts';
import { PAL as P, el, injectUiStyle } from '../ui/style.ts';

type Tab = 'vestiti' | 'cappelli' | 'strumenti' | 'animali' | 'mobili';
const TABS: readonly [Tab, string][] = [['vestiti', 'Vestiti'], ['cappelli', 'Cappelli'], ['strumenti', 'Strumenti'], ['animali', 'Insetti e pesci'], ['mobili', 'Mobili']];
const DESCR_STRUMENTO: Record<string, string> = {
  pala: 'Scava buche e cerca tesori a Borgo Marea.',
  canna: 'Si pesca dalle rive del Borgo e dalla barca ferma in mare aperto.',
  retino: 'Prende gli insetti a Borgo Marea.',
};
const CSS = `
#mzBorsa .bz-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
#mzBorsa .bz-tab { flex: 1 0 auto; min-height: 40px; padding: 0 8px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzBorsa .bz-tab[aria-pressed="true"] { background: ${P.arancio}; color: ${P.neroCaldo}; border-color: ${P.neroCaldo}; }
#mzBorsa .bz-griglia { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
#mzBorsa .bz-pz { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px; min-width: 0; cursor: pointer; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.legnoScuro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font: 11px/1.15 ui-monospace, Menlo, monospace; text-align: center; }
#mzBorsa .bz-pz img { width: 100%; aspect-ratio: 1; object-fit: contain; background: ${P.sabbia}; border-radius: 8px; }
#mzBorsa .bz-pz.on { border-color: ${P.erba}; box-shadow: 0 0 0 2px ${P.erba}, 0 3px 0 ${P.neroCaldo}; }
#mzBorsa .bz-pz .ok { position: absolute; top: 3px; right: 3px; padding: 0 4px; background: ${P.erba}; color: ${P.neroCaldo}; font-weight: bold; font-size: 10px; }
#mzBorsa .bz-pz .vuoto { display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1; background: ${P.sabbia}; border-radius: 8px; font-size: 26px; color: ${P.legno}; }
#mzBorsa .bz-riga { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 4px 6px; min-height: 44px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; }
#mzBorsa .bz-riga span { flex: 1; min-width: 0; }
#mzBorsa .bz-riga small { display: block; color: ${P.sabbia}; font-size: 12px; }
#mzBorsa .bz-riga b.n { font-size: 15px; color: ${P.giallo}; }
#mzBorsa .bz-nota { margin: 8px 2px 0; color: ${P.sabbia}; font-size: 12px; }
#mzBorsa .bz-nota.bad { color: ${P.arancio}; font-weight: bold; }
`;

export function createBorsaUi(o: BorsaOpts & { onOpen(): void; onClose(): void }): Borsa {
  injectUiStyle();
  if (!document.getElementById('mz-borsa-style')) { const s = document.createElement('style'); s.id = 'mz-borsa-style'; s.textContent = CSS; document.head.appendChild(s); }
  const sheet = el('div', 'mz mz-sheet mz-side'); sheet.id = 'mzBorsa'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Borsa');
  for (const ev of ['pointerdown', 'touchstart']) sheet.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(sheet);
  let open = false, tab: Tab = 'vestiti', busy = false, nota: { t: string; bad: boolean } | null = null;

  const look = (): Look => ({ abito: 0, ...o.me.look });
  async function indossa(cambia: Partial<Look>, nome: string): Promise<void> {
    if (busy) return;
    const l: Look = { ...look(), ...cambia };
    busy = true; nota = null; o.setLook(l); render();
    try { await o.api.look(l); o.me.look = { ...o.me.look, ...l }; nota = { t: `${nome}: ti sta benissimo`, bad: false }; }
    catch (e) { o.setLook(look()); nota = { t: (e as { message?: string })?.message ?? 'Qualcosa non va, riprova', bad: true }; }
    busy = false; render();
  }
  const pezzo = (key: string, nome: string, disegno: string | null, on: boolean, fn: () => void): HTMLElement => {
    const b = el('button', 'bz-pz' + (on ? ' on' : '')); b.type = 'button'; b.dataset['item'] = key; b.disabled = busy;
    if (disegno) { const im = document.createElement('img'); im.src = disegno; im.alt = ''; b.appendChild(im); } else b.appendChild(el('span', 'vuoto', '—'));
    b.appendChild(el('span', '', nome));
    if (on) b.appendChild(el('span', 'ok', 'ADDOSSO'));
    b.addEventListener('click', () => { if (!on) fn(); });
    return b;
  };
  const riga = (icona: Node | null, nome: string, sotto: string, n?: number): HTMLElement => {
    const r = el('div', 'bz-riga'); if (icona) r.appendChild(icona);
    const t = el('span'); t.append(nome, el('small', '', sotto)); r.appendChild(t);
    if (n !== undefined) r.appendChild(el('b', 'n', `×${n}`));
    return r;
  };

  function corpo(): HTMLElement {
    const lot = o.getLot(), body = el('div'), inv = lot?.hero?.inv ?? {};
    const oggetti = (kinds: string[]) => Object.keys(inv).filter((id) => (inv[id] ?? 0) > 0 && hasItem(id) && kinds.includes(itemDef(id).kind)).map((id) => itemDef(id)).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    if (tab === 'vestiti') {
      const g = el('div', 'bz-griglia'), mio = look().abito ?? 0;
      AVATAR.abiti.forEach((a, i) => { if (ownsAbito(lot, a.id)) g.appendChild(pezzo(`abito:${a.id}`, a.nome, disegnoAbito(a.id), mio === i, () => void indossa({ abito: i }, a.nome))); });
      body.append(g, el('p', 'bz-nota', 'Altri vestiti dal Mercante in piazza: quattro nuovi ogni giorno.'));
    } else if (tab === 'cappelli') {
      const g = el('div', 'bz-griglia'), mio = look().cappello;
      AVATAR.cappelli.forEach((h, i) => {
        if (h.id !== 'nessuno' && (!lot || !ownsHat(lot, h.id))) return;
        g.appendChild(pezzo(`cappello:${h.id}`, h.nome, h.id === 'nessuno' ? null : disegnoCappello(h.id), mio === i, () => void indossa({ cappello: i }, h.nome)));
      });
      body.append(g, el('p', 'bz-nota', 'Altri cappelli dal Mercante in piazza: quattro nuovi ogni giorno.'));
    } else if (tab === 'strumenti') {
      const its = oggetti(['strumento']);
      if (!its.length) body.appendChild(el('p', 'bz-nota', 'Nessuno strumento: pala, canna e retino si comprano da Fulvio, al negozio del Borgo.'));
      for (const it of its) body.appendChild(riga(iconOf(it, 24), it.nome, `${DESCR_STRUMENTO[it.id] ?? it.descr} In mano col bottone dell’attrezzo o col tasto Q.`));
    } else if (tab === 'animali') {
      const its = oggetti(['insetto', 'pesce']);
      if (!its.length) body.appendChild(el('p', 'bz-nota', 'Ancora niente: prendi insetti col retino e pesci con la canna.'));
      for (const it of its) body.appendChild(riga(iconOf(it, 24), it.nome, it.kind === 'insetto' ? 'insetto' : 'pesce', inv[it.id] ?? 0));
      if (its.length) body.appendChild(el('p', 'bz-nota', 'Portali a Fulvio, al negozio del Borgo: li registra nel Diario. Al Contrabbandiere li vendi.'));
    } else {
      const mag = casaDi(lot).magazzino ?? {}, ids = Object.keys(mag).filter((k) => (mag[k] ?? 0) > 0);
      if (!ids.length) body.appendChild(el('p', 'bz-nota', 'Il magazzino di casa è vuoto: i mobili si comprano al negozio del Borgo, le decorazioni dal Mercante.'));
      for (const k of ids.sort()) {
        const nome = k.startsWith('decor:') ? DECOR.find((d) => `decor:${d.id}` === k)?.nome : MOBILI.find((m) => m.id === k)?.nome;
        body.appendChild(riga(null, nome ?? k, k.startsWith('decor:') ? 'decorazione' : 'mobile', mag[k] ?? 0));
      }
      if (ids.length) body.appendChild(el('p', 'bz-nota', 'Si posano in casa tua con ARREDA.'));
    }
    if (nota) body.appendChild(el('p', 'bz-nota' + (nota.bad ? ' bad' : ''), nota.t));
    return body;
  }

  function render(): void {
    if (!open) return;
    const head = el('div', 'mz-head'); head.appendChild(el('div', 'mz-title', 'Borsa'));
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi';
    x.addEventListener('click', () => close()); head.appendChild(x);
    const tabs = el('div', 'bz-tabs');
    for (const [id, nome] of TABS) {
      const b = el('button', 'bz-tab', nome); b.type = 'button'; b.dataset['tab'] = id; b.setAttribute('aria-pressed', String(tab === id));
      b.addEventListener('click', () => { tab = id; nota = null; render(); });
      tabs.appendChild(b);
    }
    sheet.replaceChildren(head, tabs, corpo());
  }
  const onKey = (e: KeyboardEvent): void => { if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  function show(): void {
    if (open) return;
    open = true; nota = null; sheet.classList.add('on'); addEventListener('keydown', onKey, true); render(); o.onOpen();
    void o.api.lot().then((l) => { o.setLot(l); render(); }, () => {});
  }
  function close(): void {
    if (!open) return;
    open = false; sheet.classList.remove('on'); removeEventListener('keydown', onKey, true); o.onClose();
  }
  registerStateProvider('borsa', () => ({ open, tab, busy, nota: nota?.t ?? null, voci: [...sheet.querySelectorAll<HTMLElement>('[data-item]')].map((b) => b.dataset['item'] ?? '') }));
  return { open: show, close, isOpen: () => open };
}
