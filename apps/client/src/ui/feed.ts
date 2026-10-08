// Feed delle novità (F3-emote-feed, CONTRACTS §13): campanella #mzFeedBtn con badge dei non letti, pannello #mzFeed (F o campanella) con le
// righe di GET /api/feed (non lette in evidenza, ora relativa), lettura all'apertura (POST /api/feed/letto fino all'id più alto).
// Poll ogni 30 s solo con la scheda visibile, più un giro quando torna visibile; il primo ~3 s dopo l'avvio. Righe nuove → toast.
// Errori di rete muti (niente console.error: i test falliscono sugli errori in console; il messaggio sta in api.lastError).
// Il CSS è in un <style id="mz-feed-style"> di questo modulo; solo colori PAL, icona a pixel in <canvas>.
import type { FeedItem } from '@marea/protocol';
import type { Api } from '../net/api.ts';
import type { Hud } from './hud.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { topButton } from './topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';
import { emoteIcon } from '../game/emote.ts';
import type { EmoteId } from '@marea/protocol';
import { AVATAR } from '@marea/content';

export type Feed = { refresh(): Promise<void>; open(): void; close(): void; toggle(): void; isOpen(): boolean; readonly unread: number };
/** `onNews`: righe mai viste (una sfida chiusa, rifiutata o scaduta muove le risorse: main rilegge il lotto). */
/** `vuoto`: la riga quando non c'è niente (senza sfide con posta non si invita al Tavolo). */
export type FeedOpts = { api: Api; hud: Hud; root?: HTMLElement; pollMs?: number; vuoto?: string; onOpen?(): void; onClose?(): void; onNews?(items: FeedItem[]): void };

export const FEED_POLL_MS = 30_000;
const FIRST_MS = 3000;

const P = PAL;
const CSS = `
#mzFeed .mz-feed-list { display: flex; flex-direction: column; gap: 6px; }
.mz-feed-row { padding: 6px 8px 6px 10px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; border-left-width: 6px; color: ${P.sabbia}; font-size: 14px; line-height: 1.35; }
.mz-feed-row .t { display: block; }
.mz-feed-row .q { display: block; margin-top: 2px; font-size: 12px; color: ${P.pietra}; }
.mz-feed-row.new { background: ${P.ombraCalda}; border-color: ${P.giallo}; color: ${P.sabbiaChiara}; font-weight: bold; }
.mz-feed-row.new .q { color: ${P.giallo}; }
.mz-feed-row[data-tipo="sfida_ricevuta"] { border-left-color: ${P.arancio}; }
.mz-feed-row[data-tipo="sfida_accettata"] { border-left-color: ${P.acqua}; }
.mz-feed-row[data-tipo="sfida_chiusa"] { border-left-color: ${P.erba}; }
.mz-feed-row[data-tipo="sfida_rifiutata"], .mz-feed-row[data-tipo="sfida_scaduta"] { border-left-color: ${P.pietraScura}; }
.mz-feed-row[data-tipo="visita"] { border-left-color: ${P.giallo}; display: flex; gap: 8px; align-items: flex-start; }
.mz-feed-row[data-tipo="record"] { border-left-color: ${P.rosso}; }
.mz-feed-row[data-tipo="faro"] { border-left-color: ${P.giallo}; }
.mz-feed-row[data-tipo="visita"] > .mz-ico { margin-top: 2px; }
.mz-feed-row[data-tipo="visita"] > div { flex: 1; min-width: 0; }
.mz-feed-empty { color: ${P.sabbia}; margin: 4px 0 10px; }
#mzFeedBtn .mz-ico { width: 28px; height: 28px; }
`;
let styled = false;
function injectStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style'); s.id = 'mz-feed-style'; s.textContent = CSS; document.head.appendChild(s);
}

const BELL = [
  '................', '.......y........', '......yyy.......', '.....yyyyy......', '....yyyyyyy.....', '....yyyyyyy.....',
  '....yyyyyyy.....', '....yyyyyyy.....', '...yyyyyyyyy....', '..yyyyyyyyyyy...', '.yyyyyyyyyyyyy..', '................',
  '......aaa.......', '.......a........', '................', '................',
];
/** Campanella 16×16 in <canvas>: giallo e arancio con contorno nero caldo. */
function bellIcon(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.className = 'mz-ico'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d'); if (!g) return c;
  const at = (x: number, y: number) => BELL[y]?.[x] ?? '.';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = at(x, y);
    const col = k === 'y' ? P.giallo : k === 'a' ? P.arancio : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) !== '.') ? P.neroCaldo : null;
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

/** «adesso», «5 min fa», «3 h fa», «ieri», «4 giorni fa». */
export function relTime(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ieri' : `${d} giorni fa`;
}
/** Per il toast: la prima frase se sta nei `n` caratteri («Anna ti sfida alla Regata: posta 20 Legno»), altrimenti tagliata con «…». */
const short = (t: string, n = 64) => {
  if (t.length <= n) return t;
  const dot = t.indexOf('. ');
  return dot > 0 && dot < n ? t.slice(0, dot) : t.slice(0, n - 1).trimEnd() + '…';
};

export function createFeed(o: FeedOpts): Feed {
  let open = false, items: FeedItem[] = [], unread = 0, lastId = 0, seenId = 0, busy: Promise<void> | null = null;
  if (!o.api.enabled) {
    // senza link personale niente campanella: un feed inerte con la stessa forma
    registerStateProvider('feed', () => ({ unread: 0, open: false, lastId: 0, items: 0 }));
    return { refresh: async () => {}, open() {}, close() {}, toggle() {}, isOpen: () => false, get unread() { return 0; } };
  }
  injectUiStyle(); injectStyle();
  const root = o.root ?? (document.getElementById('ui') as HTMLElement | null) ?? document.body;
  const pollMs = Math.max(1000, o.pollMs ?? FEED_POLL_MS);
  const sheet = el('div', 'mz mz-sheet mz-side'); sheet.id = 'mzFeed'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Novità');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', 'Novità'));
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.dataset['act'] = 'chiudi'; head.appendChild(x);
  const body = el('div', 'mz-feed-list'); body.dataset['panel'] = 'feed';
  sheet.append(head, body); root.appendChild(sheet);
  /** Id letti in questa apertura: restano in evidenza finché il pannello è aperto, così si vede cosa era nuovo. */
  let fresh = new Set<number>();

  const render = () => {
    body.replaceChildren();
    if (!items.length) { body.appendChild(el('div', 'mz-feed-empty', o.vuoto ?? 'Niente di nuovo. Sfida qualcuno al Tavolo del Porto.')); return; }
    const now = o.api.serverNow();
    for (const it of items) {
      const isNew = !it.letto || fresh.has(it.id);
      const row = el('div', 'mz-feed-row' + (isNew ? ' new' : '')); row.dataset['feed'] = String(it.id); row.dataset['tipo'] = it.tipo;
      if (it.tipo === 'visita') { // #86: il saluto della firma come icona a pixel accanto al testo
        const box = el('div'); box.append(el('span', 't', it.testo), el('span', 'q', relTime(now - it.quando)));
        if (it.emote && AVATAR.emote.includes(it.emote)) row.append(emoteIcon(it.emote as EmoteId, 24));
        row.append(box);
      } else row.append(el('span', 't', it.testo), el('span', 'q', relTime(now - it.quando)));
      body.appendChild(row);
    }
  };
  const btn = topButton({ root, id: 'mzFeedBtn', order: 1, label: '', title: 'Novità (F)', onClick: () => toggle() });
  btn.el.insertBefore(bellIcon(), btn.el.firstChild);

  async function load(): Promise<void> {
    try {
      const r = await o.api.feed();
      items = r.items; unread = r.nonLetti;
      lastId = items.reduce((m, i) => Math.max(m, i.id), lastId);
      const news = items.filter((i) => i.id > seenId && !i.letto);
      seenId = Math.max(seenId, lastId);
      if (news.length) o.onNews?.(news);
      if (news.length && !open) suona('notifica');
      if (open) { for (const i of news) fresh.add(i.id); render(); if (news.length || unread) void markRead(); }
      else if (news.length === 1) o.hud.toast(short(news[0]!.testo), 3500);
      else if (news.length > 1) o.hud.toast(`${news.length} novità · apri la campanella`, 3500);
      btn.setBadge(open ? 0 : unread);
    } catch { /* niente console.error: i test falliscono sugli errori in console; api.lastError ha il messaggio */ }
  }
  /** Un giro alla volta: chi chiama mentre uno è in corso aspetta quello. */
  function refresh(): Promise<void> {
    busy ??= load().finally(() => { busy = null; });
    return busy;
  }
  async function markRead(): Promise<void> {
    if (!lastId) return;
    const upTo = lastId;
    for (const i of items) if (i.id <= upTo && !i.letto) { fresh.add(i.id); i.letto = true; }
    unread = 0; btn.setBadge(0);
    try { unread = await o.api.feedRead(upTo); btn.setBadge(open ? 0 : unread); } catch { /* riprova alla prossima apertura */ }
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyC' && !e.repeat) return; // un pannello alla volta: C passa a main.ts, che chiude il feed e apre l'editor
    if (e.key === 'Escape' || e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) close(); }
    e.stopPropagation(); // col pannello aperto i tasti non arrivano al gioco (mai keyup: input.ts li deve vedere tutti)
  };
  function show(): void {
    if (open) return;
    open = true; fresh = new Set(); render(); sheet.classList.add('on'); btn.setOn(true); btn.setBadge(0);
    addEventListener('keydown', onKey, true);
    void markRead().then(() => refresh());
    o.onOpen?.();
  }
  function close(): void {
    if (!open) return;
    open = false; sheet.classList.remove('on'); btn.setOn(false); btn.setBadge(unread);
    removeEventListener('keydown', onKey, true);
    o.onClose?.();
  }
  function toggle(): void { if (open) close(); else show(); }
  x.addEventListener('click', close);

  // poll: solo a scheda visibile; al ritorno in primo piano un giro subito
  const visible = () => document.visibilityState === 'visible';
  let polls = 0;
  const tick = () => { if (visible()) { polls++; void refresh(); } };
  const first = setTimeout(tick, FIRST_MS);
  const timer = setInterval(tick, pollMs);
  const onVis = () => { if (visible()) { polls++; void refresh(); } };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', onVis); });

  registerStateProvider('feed', () => ({ unread, open, lastId, seenId, items: items.length, polls, pollMs, badge: btn.el.querySelector('.mz-badge.on')?.textContent ?? '' }));
  registerTestHook('feedRefresh', () => refresh());
  return { refresh, open: show, close, toggle, isOpen: () => open, get unread() { return unread; } };
}
