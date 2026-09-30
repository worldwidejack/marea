// Feed delle novità (F3-emote-feed, CONTRACTS §13). STUB di WP0 funzionante: campanella #mzFeedBtn con badge, pannello #mzFeed con le
// righe di GET /api/feed, lettura all'apertura. Manca (lo fa F3-emote-feed): poll a 30 s solo a scheda visibile, toast delle novità,
// tasto F, stile a pixel definitivo. Il CSS proprio va in un <style> di questo modulo, non in style.ts.
import type { FeedItem } from '@marea/protocol';
import type { Api } from '../net/api.ts';
import type { Hud } from './hud.ts';
import { el, injectUiStyle } from './style.ts';
import { topButton } from './topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Feed = { refresh(): Promise<void>; open(): void; close(): void; toggle(): void; isOpen(): boolean; readonly unread: number };
export type FeedOpts = { api: Api; hud: Hud; root?: HTMLElement; pollMs?: number; onOpen?(): void; onClose?(): void };

export function createFeed(o: FeedOpts): Feed {
  injectUiStyle();
  const root = o.root ?? (document.getElementById('ui') as HTMLElement | null) ?? document.body;
  const sheet = el('div', 'mz mz-sheet mz-side'); sheet.id = 'mzFeed'; sheet.setAttribute('role', 'dialog');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', 'Novità'));
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.dataset['act'] = 'chiudi'; head.appendChild(x);
  const body = el('div'); body.dataset['panel'] = 'feed';
  sheet.append(head, body); root.appendChild(sheet);
  let open = false, items: FeedItem[] = [], unread = 0, lastId = 0;
  const render = () => {
    body.replaceChildren();
    if (!items.length) { body.appendChild(el('div', 'mz-info', 'Niente di nuovo. Sfida qualcuno al Tavolo del Porto.')); return; }
    for (const it of items) { const row = el('div', 'mz-info' + (it.letto ? '' : ' mz-tot'), it.testo); row.dataset['feed'] = String(it.id); body.appendChild(row); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.code === 'KeyF') { e.preventDefault(); close(); }
    e.stopPropagation();
  };
  const btn = topButton({ root, id: 'mzFeedBtn', order: 1, label: '!', title: 'Novità (F)', onClick: () => toggle() });
  async function refresh(): Promise<void> {
    if (!o.api.enabled) return;
    try {
      const r = await o.api.feed();
      items = r.items; unread = r.nonLetti; lastId = items.reduce((m, i) => Math.max(m, i.id), lastId);
      btn.setBadge(unread);
      if (open) render();
    } catch { /* niente console.error: i test falliscono sugli errori in console; api.lastError ha il messaggio */ }
  }
  async function markRead(): Promise<void> {
    if (!unread || !lastId) return;
    try { unread = await o.api.feedRead(lastId); btn.setBadge(unread); } catch { /* riprova al prossimo giro */ }
  }
  function show(): void {
    if (open) return;
    open = true; render(); sheet.classList.add('on'); btn.setOn(true);
    addEventListener('keydown', onKey, true);
    void refresh().then(markRead);
    o.onOpen?.();
  }
  function close(): void {
    if (!open) return;
    open = false; sheet.classList.remove('on'); btn.setOn(false);
    removeEventListener('keydown', onKey, true);
    o.onClose?.();
  }
  function toggle(): void { if (open) close(); else show(); }
  x.addEventListener('click', close);
  registerStateProvider('feed', () => ({ unread, open, lastId, items: items.length }));
  registerTestHook('feedRefresh', () => refresh());
  void refresh();
  return { refresh, open: show, close, toggle, isOpen: () => open, get unread() { return unread; } };
}
