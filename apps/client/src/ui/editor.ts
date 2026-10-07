// Editor dell'avatar (F3-avatar, CONTRACTS §13): pelle, taglio, colore dei capelli, vestito, cappello. Anteprima DAL VIVO sul proprio avatar
// (o.avatar.setLook a ogni cambio, nessuna chiamata al server); Salva → POST /api/look; Esc, C, × o Annulla ripristinano il look salvato.
// Cappelli a Perle: prezzo, «Compra» (POST /api/look/hat), Salva spento finché il cappello scelto non è tuo. Tutto da AVATAR (@marea/content).
// PC prima: frecce su/giù = riga (poi i bottoni), sinistra/destra = valore, Invio attiva il bottone, Tab funziona. Tasti in capture su
// window solo a pannello aperto, con stopPropagation (mai keyup, altrimenti restano incollati in input.ts), come il Tavolo.
// In fondo «Altro dispositivo»: COPIA / MANDA il proprio link col token (il token sta solo nel browser che ha aperto il link). Il link non
// si mostra a schermo (niente screenshot con la chiave), tranne quando la copia non riesce: allora un campo da selezionare a mano.
import { AVATAR } from '@marea/content';
import type { Look, LotState, Resources } from '@marea/protocol';
import { mancaText } from '../net/api.ts';
import type { Api, Me } from '../net/api.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { resIcon } from './icons.ts';
import { topButton } from './topbar.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type Editor = { open(): void; close(): void; toggle(): void; isOpen(): boolean };
export type EditorOpts = {
  api: Api; me: Me; root?: HTMLElement;
  /** L'avatar del mondo: anteprima dal vivo mentre si scorre (world.setLook). */
  avatar: { setLook(l: Look): void };
  onSaved?(l: Look): void;
  /** Dopo un acquisto (cappello a Perle) il lotto cambia: chi ascolta aggiorna la vista del lotto. */
  onLot?(lot: LotState): void;
  onOpen?(): void; onClose?(): void;
  /** Il link personale (`/?t=token`): COPIA / MANDA per entrare come sé da un altro dispositivo. Senza, la sezione non c'è. */
  link?: string;
};

type RowId = keyof Look;
type Row = { id: RowId; nome: string; n: number; kind: 'colori' | 'nomi'; colore?(i: number): string; nomeDi(i: number): string };
type Note = { text: string; bad: boolean } | null;

/** Nome della palette (ART_BIBLE §2) di un colore, «sabbia chiara» da `sabbiaChiara`; '' se non è in palette. */
const palName = (hex: string): string => {
  const k = Object.entries(PAL).find(([, v]) => v.toUpperCase() === hex.toUpperCase())?.[0];
  return k ? k.replace(/[A-Z]/g, (c) => ' ' + c.toLowerCase()) : '';
};
const HATS = AVATAR.cappelli;
const ROWS: readonly Row[] = [
  { id: 'pelle', nome: 'Pelle', n: AVATAR.pelle.length, kind: 'colori', colore: (i) => AVATAR.pelle[i] ?? PAL.sabbia, nomeDi: (i) => `tono ${i + 1}` },
  { id: 'capelli', nome: 'Capelli', n: AVATAR.capelli.length, kind: 'nomi', nomeDi: (i) => AVATAR.capelli[i] ?? '' },
  { id: 'coloreCapelli', nome: 'Colore capelli', n: AVATAR.coloriCapelli.length, kind: 'colori', colore: (i) => AVATAR.coloriCapelli[i] ?? PAL.legno, nomeDi: (i) => palName(AVATAR.coloriCapelli[i] ?? '') || `colore ${i + 1}` },
  { id: 'vestito', nome: 'Vestito', n: AVATAR.vestiti.length, kind: 'colori', colore: (i) => AVATAR.vestiti[i] ?? PAL.acqua, nomeDi: (i) => palName(AVATAR.vestiti[i] ?? '') || `colore ${i + 1}` },
  { id: 'cappello', nome: 'Cappello', n: HATS.length, kind: 'nomi', nomeDi: (i) => HATS[i]?.nome ?? '' },
];
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const clampLook = (l: Look | null | undefined): Look => {
  const o: Look = { pelle: 0, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 0 };
  for (const r of ROWS) { const v = Number(l?.[r.id]); o[r.id] = Number.isInteger(v) && v >= 0 && v < r.n ? v : 0; }
  return o;
};
const same = (a: Look, b: Look): boolean => ROWS.every((r) => a[r.id] === b[r.id]);

/** Icona 8×8 del bottone in alto: una testa a pixel in palette (niente immagini). */
const ICON = ['..hhhh..', '.hhhhhh.', '.hssssh.', '.snssns.', '.ssssss.', '..ssss..', '.vvvvvv.', 'vvvvvvvv'];
function headIcon(px: number): HTMLSpanElement {
  const col: Record<string, string> = { h: PAL.legnoScuro, s: PAL.sabbia, n: PAL.neroCaldo, v: PAL.acqua };
  let rects = '';
  ICON.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = col[row[x] ?? '.']; if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; } });
  const e = el('span', 'mz-ico');
  e.style.width = e.style.height = px + 'px';
  e.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="${px}" height="${px}" shape-rendering="crispEdges" style="display:block">${rects}</svg>`; // SVG statico, nessun dato esterno
  return e;
}

export function createEditor(o: EditorOpts): Editor {
  injectUiStyle();
  const { api } = o;
  const root = o.root ?? (document.getElementById('ui') as HTMLElement | null) ?? document.body;
  const sheet = el('div', 'mz mz-sheet mz-side mz-ed'); sheet.id = 'mzEditor';
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Il tuo avatar');
  root.appendChild(sheet);

  let open = false, busy = false, gen = 0, keysOn = false;
  let draft = clampLook(o.me.look);
  let lot: LotState | null = o.me.lotto;
  let note: Note = null;
  let linkVisibile = false; // la copia non è riuscita: il link in un campo da selezionare a mano

  const perle =(): number | null => (lot ? lot.resources.perle : null);
  const owned = (): string[] => HATS.filter((h) => h.perle <= 0 || (lot?.posseduti ?? []).includes(h.id)).map((h) => h.id);
  /** Il cappello scelto si può salvare: gratis, comprato, o già nel look salvato (il server l'aveva accettato). */
  const hatOk = (): boolean => { const h = HATS[draft.cappello]; return !h || owned().includes(h.id) || draft.cappello === clampLook(o.me.look).cappello; };
  const errText = (e: unknown): string => {
    const x = e as { message?: string; manca?: Resources };
    const m = mancaText(x?.manca);
    return (x?.message || 'Qualcosa non va, riprova') + (m ? `: ${m}` : '');
  };

  // ---------- azioni ----------
  function set(id: RowId, v: number): void {
    const r = ROWS.find((x) => x.id === id);
    if (!r || busy) return;
    const n = ((v % r.n) + r.n) % r.n;
    if (draft[id] === n) return;
    draft = { ...draft, [id]: n };
    note = null;
    o.avatar.setLook({ ...draft }); // anteprima dal vivo, nessuna chiamata al server
    render();
  }
  async function compra(): Promise<void> {
    const h = HATS[draft.cappello];
    if (!h || busy) return;
    const g = gen;
    busy = true; note = null; render();
    try {
      const l = await api.buyHat(h.id);
      lot = l; o.onLot?.(l);
      if (g === gen) note = { text: `${h.nome}: è tuo`, bad: false };
    } catch (e) { if (g === gen) note = { text: errText(e), bad: true }; }
    busy = false;
    if (g === gen) render();
  }
  async function salva(): Promise<void> {
    if (busy || !hatOk()) return;
    const l = { ...draft };
    if (same(l, clampLook(o.me.look))) { close(); return; } // niente da salvare: niente POST
    const g = gen;
    busy = true; note = null; render();
    try {
      await api.look(l);
      busy = false;
      o.me.look = l; // anche se nel frattempo il pannello è stato chiuso: il server l'ha salvato
      o.onSaved?.(l);
      if (g === gen) close(); else o.avatar.setLook(l);
    } catch (e) {
      busy = false;
      if (g === gen) { note = { text: errText(e), bad: true }; render(); }
    }
  }
  async function copiaLink(): Promise<void> {
    const url = o.link;
    if (!url) return;
    const g = gen;
    try {
      await navigator.clipboard.writeText(url); // senza appunti (http, permesso negato) → catch
      if (g === gen) note = { text: 'Link copiato: aprilo sull’altro dispositivo', bad: false };
    } catch {
      if (g === gen) { linkVisibile = true; note = { text: 'Copia non riuscita: seleziona il link qui sopra', bad: true }; }
    }
    if (g === gen) render();
  }
  async function mandaLink(): Promise<void> {
    const url = o.link;
    if (!url) return;
    try {
      await navigator.share({ title: 'MAREA', text: 'Il mio link di MAREA (personale, non girarlo)', url }); // foglio di condivisione del telefono
    } catch (e) {
      if ((e as { name?: string } | null)?.name !== 'AbortError') await copiaLink(); // AbortError = chiuso dalla persona
    }
  }

  // ---------- tastiera (solo a pannello aperto) ----------
  const navItems = (): HTMLElement[] =>
    [...sheet.querySelectorAll<HTMLElement>('[data-row], button:not(:disabled):not([tabindex="-1"])')].filter((e) => !e.classList.contains('mz-x'));
  const onKey = (e: KeyboardEvent): void => {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation(); // WASD/frecce/1-4/F non arrivano al gioco mentre l'editor è aperto
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && sheet.contains(active);
    const items = navItems();
    const rowOf = inside && active ? active.closest<HTMLElement>('[data-row]') : null;
    const cur = inside && active ? (items.includes(active) ? active : rowOf ?? active) : null;
    const rowId = cur === rowOf ? (rowOf?.dataset['row'] as RowId | undefined) : undefined; // su «Compra» le frecce laterali non cambiano cappello
    if (e.key === 'Escape' || e.code === 'KeyC') { e.preventDefault(); if (!e.repeat && !busy) close(); return; }
    switch (e.key) {
      case 'ArrowDown': case 'ArrowUp': {
        e.preventDefault();
        const i = cur ? items.indexOf(cur) : -1, d = e.key === 'ArrowDown' ? 1 : -1;
        const n = i < 0 ? (d > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, i + d));
        items[n]?.focus();
        return;
      }
      case 'ArrowLeft': case 'ArrowRight': {
        e.preventDefault();
        if (rowId) set(rowId, draft[rowId] + (e.key === 'ArrowRight' ? 1 : -1));
        else if (!inside) items[0]?.focus();
        return;
      }
      case 'Enter': {
        if (!inside) { e.preventDefault(); items[0]?.focus(); return; }
        if (rowId) { e.preventDefault(); sheet.querySelector<HTMLElement>('[data-nav="compra"]:not(:disabled), [data-nav="salva"]:not(:disabled)')?.focus(); }
        return; // su un bottone l'Invio lo clicca il browser
      }
      case 'Tab': if (!inside && items[0]) { e.preventDefault(); items[0].focus(); } return;
      default: return;
    }
  };
  const keys = (on: boolean): void => {
    if (on === keysOn) return;
    keysOn = on;
    if (on) addEventListener('keydown', onKey, true); else removeEventListener('keydown', onKey, true);
  };

  // ---------- disegno ----------
  function button(cls: string, nav: string, text: string, sub: (string | Node)[], disabled: boolean, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'mz-btn ' + cls);
    b.type = 'button'; b.dataset['nav'] = nav; b.dataset['act'] = nav; b.disabled = disabled || busy;
    b.appendChild(el('span', 'who', text));
    if (sub.length) { const s = el('span', 'sub'); s.append(...sub); b.appendChild(s); }
    b.addEventListener('click', () => { if (!b.disabled && !busy) onClick(); });
    return b;
  }
  const perleTag = (n: number): HTMLElement => { const s = el('span', 'mz-cost'); s.append(resIcon('perle', 16), `${n} Perle`); return s; };

  function rowEl(r: Row): HTMLElement {
    const v = draft[r.id];
    const w = el('div', 'mz-ed-row');
    w.tabIndex = 0; w.dataset['row'] = r.id; w.dataset['nav'] = 'riga:' + r.id;
    w.setAttribute('role', 'spinbutton'); w.setAttribute('aria-label', r.nome);
    w.setAttribute('aria-valuenow', String(v)); w.setAttribute('aria-valuetext', r.nomeDi(v));
    const lbl = el('div', 'mz-ed-lbl'); lbl.appendChild(el('span', '', r.nome));
    const hat = r.id === 'cappello' ? HATS[v] : undefined;
    if (hat && hat.perle > 0) {
      const mine = owned().includes(hat.id);
      const t = el('span', 'v' + (mine ? '' : ' lock'));
      if (mine) t.textContent = 'tuo'; else t.appendChild(perleTag(hat.perle));
      if (!hatOk()) { // prezzo + «Compra» sulla riga del cappello: Annulla/Salva restano in vista in fondo
        const b = el('button', 'mz-ed-buy', 'COMPRA'); b.type = 'button'; b.dataset['nav'] = 'compra'; b.dataset['act'] = 'compra';
        b.disabled = busy; b.title = `Compra ${hat.nome} per ${hat.perle} Perle`;
        b.addEventListener('click', () => { if (!busy) void compra(); });
        t.appendChild(b);
      }
      lbl.appendChild(t);
    } else lbl.appendChild(el('span', 'v', r.kind === 'colori' ? r.nomeDi(v) : `${v + 1}/${r.n}`));
    w.appendChild(lbl);
    if (r.kind === 'colori') {
      const sw = el('div', 'mz-ed-sw');
      for (let i = 0; i < r.n; i++) {
        const b = el('button', 'mz-ed-c' + (i === v ? ' on' : ''));
        b.type = 'button'; b.tabIndex = -1; b.style.background = r.colore?.(i) ?? PAL.sabbia;
        b.dataset['act'] = r.id; b.dataset['val'] = String(i); b.dataset['nav'] = `${r.id}:${i}`;
        b.title = cap(r.nomeDi(i)); b.setAttribute('aria-label', `${r.nome}: ${r.nomeDi(i)}`); b.setAttribute('aria-pressed', i === v ? 'true' : 'false');
        b.addEventListener('click', () => set(r.id, i));
        sw.appendChild(b);
      }
      w.appendChild(sw);
    } else {
      const st = el('div', 'mz-ed-st');
      const mk = (d: number, t: string): HTMLButtonElement => {
        const b = el('button', '', t); b.type = 'button'; b.tabIndex = -1;
        b.dataset['act'] = r.id; b.dataset['nav'] = `${r.id}:${d > 0 ? 'piu' : 'meno'}`;
        b.setAttribute('aria-label', `${r.nome} ${d > 0 ? 'successivo' : 'precedente'}`);
        b.addEventListener('click', () => set(r.id, draft[r.id] + d));
        return b;
      };
      st.append(mk(-1, '‹'), el('span', 'n', cap(r.nomeDi(v))), mk(1, '›'));
      w.appendChild(st);
    }
    return w;
  }

  function linkEl(url: string): HTMLElement {
    const w = el('div', 'mz-ed-row mz-ed-link'); w.dataset['panel'] = 'link';
    const lbl = el('div', 'mz-ed-lbl'); lbl.appendChild(el('span', '', 'Altro dispositivo'));
    w.append(lbl, el('p', '', 'Per entrare come te dal PC o da un altro telefono, apri lì il tuo link. È personale: non darlo agli altri.'));
    if (linkVisibile) {
      const f = document.createElement('input');
      f.className = 'mz-ed-url'; f.readOnly = true; f.value = url; f.setAttribute('aria-label', 'Il tuo link personale');
      f.addEventListener('focus', () => f.select());
      w.appendChild(f);
    }
    const row = el('div', 'mz-row');
    row.appendChild(button('ghost', 'copia-link', 'COPIA LINK', [], false, () => void copiaLink()));
    if (typeof navigator.share === 'function') row.appendChild(button('ghost', 'manda-link', 'MANDA', [], false, () => void mandaLink()));
    w.appendChild(row);
    return w;
  }

  function render(): void {
    if (!open) return;
    const active = document.activeElement as HTMLElement | null;
    const hadFocus = !!active && sheet.contains(active);
    const keep = hadFocus ? active?.dataset['nav'] ?? active?.closest<HTMLElement>('[data-nav]')?.dataset['nav'] : undefined;
    const head = el('div', 'mz-head');
    head.appendChild(el('div', 'mz-title', 'Il tuo avatar'));
    const pc = el('span', 'mz-ed-perle'); pc.dataset['perle'] = String(perle() ?? ''); pc.title = 'Le tue Perle';
    pc.append(resIcon('perle', 16), perle() === null ? '…' : String(perle()));
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Annulla e chiudi (Esc)'; x.setAttribute('aria-label', 'Chiudi');
    x.dataset['act'] = 'chiudi'; x.dataset['nav'] = 'chiudi';
    x.addEventListener('click', () => { if (!busy) close(); });
    head.append(pc, x);
    const body = el('div'); body.dataset['panel'] = 'editor';
    if (busy) body.setAttribute('aria-busy', 'true');
    for (const r of ROWS) body.appendChild(rowEl(r));
    if (o.link) body.appendChild(linkEl(o.link));
    const act = el('div', 'mz-ed-act');
    if (!note && !hatOk()) act.appendChild(el('div', 'mz-note', 'Cappello non tuo: compralo per salvare'));
    if (note) act.appendChild(el('div', 'mz-note ' + (note.bad ? 'bad' : 'ok'), note.text));
    const row = el('div', 'mz-row');
    row.append(button('ghost', 'annulla', 'ANNULLA', [], false, () => close()), button('green', 'salva', 'SALVA', [], !hatOk(), () => void salva()));
    act.appendChild(row);
    body.appendChild(act);
    sheet.replaceChildren(head, body);
    if (!hadFocus) return;
    const again = keep ? sheet.querySelector<HTMLElement>(`[data-nav="${CSS.escape(keep)}"]`) : null;
    if (again && !(again as HTMLButtonElement).disabled) again.focus({ preventScroll: true });
    else (navItems()[0] ?? x).focus({ preventScroll: true });
  }

  // ---------- apri / chiudi ----------
  const btn = topButton({ root, id: 'mzEditorBtn', order: 2, label: '', title: 'Il tuo avatar (C)', onClick: () => toggle() });
  btn.el.prepend(headIcon(24));
  function show(): void {
    if (open) return;
    open = true; busy = false; note = null; linkVisibile = false; gen++;
    draft = clampLook(o.me.look);
    sheet.classList.add('on'); btn.setOn(true);
    keys(true);
    render();
    sheet.scrollTop = 0;
    navItems()[0]?.focus({ preventScroll: true });
    o.onOpen?.();
    const g = gen;
    api.lot().then((l) => { lot = l; if (g === gen) render(); }, () => { /* le Perle restano quelle note: lo dirà il server se non bastano */ });
  }
  /** Chiude annullando: l'avatar torna al look salvato (dopo Salva, me.look è già quello nuovo). */
  function close(): void {
    if (!open) return;
    open = false; busy = false; note = null; linkVisibile = false; gen++;
    keys(false);
    const a = document.activeElement as HTMLElement | null;
    if (a && sheet.contains(a)) a.blur();
    sheet.classList.remove('on'); btn.setOn(false);
    draft = clampLook(o.me.look);
    o.avatar.setLook({ ...o.me.look });
    o.onClose?.();
  }
  function toggle(): void { if (open) close(); else show(); }

  registerStateProvider('editor', () => ({ open, draft: { ...draft }, saved: { ...o.me.look }, owned: owned(), perle: perle(), busy, note: note?.text ?? null, linkVisibile }));
  return { open: show, close, toggle, isOpen: () => open };
}
