// Editor dell'avatar (F3-avatar, CONTRACTS §13). STUB di WP0 funzionante: pannello #mzEditor con il look attuale e un bottone Chiudi,
// bottone #mzEditorBtn nella barra in alto, tasti Esc/C per chiudere. F3-avatar sostituisce il corpo tenendo firma e id.
import type { Look, LotState } from '@marea/protocol';
import type { Api, Me } from '../net/api.ts';
import { el, injectUiStyle } from './style.ts';
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
};

export function createEditor(o: EditorOpts): Editor {
  injectUiStyle();
  const root = o.root ?? (document.getElementById('ui') as HTMLElement | null) ?? document.body;
  const sheet = el('div', 'mz mz-sheet mz-side'); sheet.id = 'mzEditor'; sheet.setAttribute('role', 'dialog');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', 'Il tuo avatar'));
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.dataset['act'] = 'chiudi'; head.appendChild(x);
  const body = el('div'); body.dataset['panel'] = 'editor';
  sheet.append(head, body); root.appendChild(sheet);
  let open = false;
  const render = () => {
    body.replaceChildren();
    const l = o.me.look;
    body.appendChild(el('div', 'mz-info', `Pelle ${l.pelle} · Capelli ${l.capelli}/${l.coloreCapelli} · Vestito ${l.vestito} · Cappello ${l.cappello}`));
    body.appendChild(el('div', 'mz-note', 'Editor in arrivo (F3-avatar)'));
  };
  // A pannello aperto i tasti non arrivano al gioco (come il Tavolo): solo keydown, mai keyup.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.code === 'KeyC') { e.preventDefault(); close(); }
    e.stopPropagation();
  };
  const btn = topButton({ root, id: 'mzEditorBtn', order: 2, label: 'TU', title: 'Il tuo avatar (C)', onClick: () => toggle() });
  function show(): void {
    if (open) return;
    open = true; render(); sheet.classList.add('on'); btn.setOn(true);
    addEventListener('keydown', onKey, true);
    o.onOpen?.();
  }
  function close(): void {
    if (!open) return;
    open = false; sheet.classList.remove('on'); btn.setOn(false);
    removeEventListener('keydown', onKey, true);
    o.avatar.setLook(o.me.look); // lo stub non modifica nulla: ripristina per sicurezza
    o.onClose?.();
  }
  function toggle(): void { if (open) close(); else show(); }
  x.addEventListener('click', close);
  registerStateProvider('editor', () => ({ open, draft: null, saved: o.me.look, owned: [], perle: null }));
  return { open: show, close, toggle, isOpen: () => open };
}
