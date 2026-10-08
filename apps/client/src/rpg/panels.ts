// Pannelli del personaggio e degli edifici GDR (R-pannelli, CONTRACTS §15 e §13): un solo foglio #mzEroe (classe mz-sheet mz-side) che
// mostra la scheda del personaggio (Personaggio / Abilità / Zaino) o un edificio (Banco, Tavolo Alchemico, Forziere, Serra).
// Un pannello alla volta: aprendolo si chiudono gli altri fogli; se se ne apre un altro (o si scende nel dungeon) questo si chiude.
// Tasti in capture con stopPropagation (mai keyup): Esc e I chiudono, ←/→ cambiano scheda, ↑/↓ spostano il fuoco; C e F passano a main.
// Le azioni vanno a POST /api/rpg: il lotto nuovo → ctx.setLot; errori (ApiError, già in italiano) → toast.
// Nel dungeon (openHero con un RunBag, dungeon v5) la scheda mostra lo zaino della spedizione: Equipaggia/Togli e Butta via vanno alla sim
// come azioni (la partita è in pausa finché la scheda è aperta); livelli, perk e libri si fanno fuori dal dungeon.
import { building } from '@marea/content';
import type { LotState } from '@marea/sim';
import { heroDerived, heroOf } from '@marea/sim/rpg/hero.ts';
import { buildingLevel } from '@marea/sim/rpg/bag.ts';
import type { RpgAction } from '@marea/sim/rpg/types.ts';
import { el, injectUiStyle } from '../ui/style.ts';
import { registerStateProvider } from '../test/testapi.ts';
import type { BuildingKind, PanelCtx, RunBag } from './types.ts';
import { injectRpgStyle } from './hero_style.ts';
import { renderPg, renderSkills } from './hero_tabs.ts';
import { renderBag } from './hero_bag.ts';
import { renderForge } from './forge.ts';
import { harvest, renderAlchemy, renderSerra } from './alchemy.ts';
import { renderChest } from './chest.ts';
import { renderContrabbando } from './contrabbando.ts';
import type { UiState, View } from './items_ui.ts';

type ViewId = 'eroe' | BuildingKind | 'contrabbando';
const titolo = (v: ViewId): string => (v === 'eroe' ? 'Personaggio' : v === 'contrabbando' ? 'Il Furetto · contrabbando' : building(v).nome);
const TABS: readonly { id: UiState['tab']; nome: string }[] = [{ id: 'pg', nome: 'Personaggio' }, { id: 'abilita', nome: 'Abilità' }, { id: 'zaino', nome: 'Zaino' }];

let ctx: PanelCtx | null = null, sheet: HTMLElement | null = null, view: ViewId | null = null;
let busy = false, lastSet: LotState | null = null, drawn: LotState | null = null, raf = 0, resetScroll = false;
/** Zaino della spedizione in corso (scheda aperta nel dungeon), null sull'isola. */
let bag: RunBag | null = null;
/** Battuta del Furetto in cima al suo banco (la sceglie game/porto.ts a ogni apertura). */
let battuta = '';
const ui: UiState = { tab: 'pg', skill: null, item: null, mat: 'legno', cat: 'leggere', chest: null, serra: null, focus: null, butta: null };

const curLot = (): LotState | null => ctx?.getLot() ?? lastSet;
const heroBtn = (): HTMLElement | null => document.getElementById('mzHeroBtn');

function ensureSheet(root: HTMLElement): HTMLElement {
  if (sheet && sheet.isConnected) return sheet;
  const s = el('div', 'mz mz-sheet mz-side mz-rpg'); s.id = 'mzEroe';
  s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'Personaggio');
  for (const ev of ['pointerdown', 'touchstart']) s.addEventListener(ev, (e) => e.stopPropagation()); // niente tocchi al canvas o al joystick
  root.appendChild(s);
  sheet = s;
  return s;
}

function act(a: RpgAction, ok?: (l: LotState) => string | void): void {
  const c = ctx;
  if (busy || !c) return;
  if (bag) {
    // nel dungeon: equip e butta sono azioni della sim (registrate col tick, il server le rigioca); il resto aspetta l'isola
    const why = a.t === 'equip' ? bag.act({ t: 'equip', slot: a.slot, item: a.item }) : a.t === 'butta' ? bag.act({ t: 'butta', item: a.item, n: a.n }) : 'Questo lo fai fuori dal dungeon';
    const l = curLot();
    const msg = !why && l ? ok?.(l) : null;
    render();
    c.hud.toast(why ?? msg ?? 'Fatto', why ? 2500 : 1800);
    return;
  }
  busy = true; render();
  c.api.rpg(a).then((l) => {
    lastSet = l; c.setLot(l); busy = false;
    const msg = ok?.(l);
    render();
    if (msg) c.hud.toast(msg, 2500);
  }, (e: unknown) => {
    busy = false; render();
    c.hud.toast(e instanceof Error && e.message ? e.message : 'Non riuscito: riprova', 3000);
  });
}

function header(lot: LotState | null): HTMLElement {
  const top = el('div', 'mz-rp-top');
  const head = el('div', 'mz-head');
  const h = bag ? bag.hero() : lot ? heroOf(lot) : null;
  const title = el('div', 'mz-title', view === 'eroe' || !view ? (bag ? 'Zaino · dungeon' : 'Personaggio') : titolo(view));
  const lv = view === 'eroe' ? (h ? `L${h.livello}` : '') : lot && view && view !== 'contrabbando' ? `L${buildingLevel(lot, view)}` : '';
  if (lv) title.append(' ', el('span', 'mz-lvl', lv));
  head.appendChild(title);
  if (h) { const c = el('span', 'mz-rp-coins'); c.append(el('i'), String(h.monete)); c.title = 'Monete'; head.appendChild(c); }
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi'; x.dataset['k'] = 'chiudi';
  x.addEventListener('click', () => closePanels());
  head.appendChild(x);
  top.appendChild(head);
  if (view === 'eroe') {
    const tabs = el('div', 'mz-rp-tabs');
    for (const t of TABS) {
      const b = el('button', 'mz-rp-tab' + (ui.tab === t.id ? ' on' : ''), t.nome);
      b.type = 'button'; b.dataset['tab'] = t.id; b.dataset['k'] = `tab:${t.id}`; b.setAttribute('aria-pressed', ui.tab === t.id ? 'true' : 'false');
      const badge = t.id === 'pg' ? (h?.scelte ?? 0) : t.id === 'abilita' ? (h?.perkPunti ?? 0) : 0;
      if (badge > 0) b.appendChild(el('i', 'mz-badge on', String(badge)));
      b.addEventListener('click', () => setTab(t.id));
      tabs.appendChild(b);
    }
    top.appendChild(tabs);
  }
  return top;
}

function setTab(t: UiState['tab']): void {
  if (ui.tab === t) return;
  ui.tab = t; ui.item = null; resetScroll = true; render();
}

function render(): void {
  if (!sheet || !ctx || !view) return;
  const lot = curLot();
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active && sheet.contains(active) ? active.dataset['k'] ?? null : null;
  const scroll = resetScroll ? 0 : sheet.scrollTop;
  resetScroll = false;
  const body = el('div'); body.dataset['panel'] = view === 'eroe' ? `eroe-${ui.tab}` : view;
  const hero = bag ? bag.hero() : lot ? heroOf(lot) : null;
  if (!lot) body.appendChild(el('div', 'mz-rp-note', 'Serve la tua isola: apri MAREA col tuo link personale.'));
  else if (!hero) body.appendChild(el('div', 'mz-rp-note', 'Questa discesa è iniziata prima dell’aggiornamento: lo zaino si cambia dalla prossima.'));
  else {
    if (bag) body.appendChild(el('div', 'mz-rp-sotto', bag.insieme ? 'Sei nel dungeon con la squadra: il gioco NON è in pausa, occhio ai nemici!' : 'Sei nel dungeon: il gioco è in pausa. Cambia arma o butta via quello che non serve.'));
    const v: View = { ctx, lot, hero, busy, ui, act, rerender: render, sotto: !!bag };
    if (view === 'eroe') (ui.tab === 'pg' ? renderPg : ui.tab === 'abilita' ? renderSkills : renderBag)(v, body);
    else if (view === 'banco') renderForge(v, body);
    else if (view === 'alchimia') renderAlchemy(v, body);
    else if (view === 'forziere') renderChest(v, body);
    else if (view === 'contrabbando') renderContrabbando(v, body, battuta);
    else renderSerra(v, body);
  }
  const top = header(lot);
  sheet.replaceChildren(top, body);
  sheet.style.setProperty('--rp-top', `${top.offsetHeight}px`); // le testate delle colonne del Forziere restano sotto quella del foglio
  sheet.dataset['view'] = view;
  sheet.classList.toggle('sotto', !!bag); // nel dungeon la scheda resta visibile (body.mz-sotto nasconde quella dell'isola)
  sheet.setAttribute('aria-busy', busy ? 'true' : 'false');
  sheet.scrollTop = scroll;
  drawn = lot;
  const q = (k: string) => sheet?.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`) ?? null;
  if (focusKey) q(focusKey)?.focus({ preventScroll: true });
  if (ui.focus) { const e = q(ui.focus); ui.focus = null; if (e) { e.scrollIntoView({ block: 'center' }); e.focus({ preventScroll: true }); } }
}

const onKey = (e: KeyboardEvent): void => {
  if (!view || !sheet) return;
  if ((e.code === 'KeyC' || e.code === 'KeyF') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) return; // main apre editor/feed, e questo si chiude
  if (e.key === 'Escape' || e.code === 'KeyI') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) closePanels(); return; }
  if (view === 'eroe' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === ui.tab), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(n.id);
    sheet.querySelector<HTMLElement>(`[data-tab="${n.id}"]`)?.focus({ preventScroll: true });
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled)')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = items[i < 0 ? 0 : Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    next?.focus({ preventScroll: true }); next?.scrollIntoView({ block: 'nearest' });
  }
  e.stopPropagation(); // col pannello aperto i tasti non arrivano al gioco (Invio e Spazio premono il bottone col fuoco)
};

/** Ogni frame finché è aperto: un altro foglio o il dungeon lo chiudono; un lotto nuovo (poll, altra azione) lo ridisegna. */
function watch(): void {
  raf = 0;
  if (!view) return;
  if (document.body.classList.contains('mz-sotto') !== !!bag || document.querySelector('.mz-sheet.on:not(#mzEroe)')) { closePanels(); return; }
  const l = ctx?.getLot() ?? null;
  if (!busy && !bag && l && l !== drawn) render();
  raf = requestAnimationFrame(watch);
}

function show(c: PanelCtx, v: ViewId): void {
  ctx = c;
  injectUiStyle(); injectRpgStyle();
  const s = ensureSheet(c.root);
  for (const x of document.querySelectorAll<HTMLElement>('.mz-sheet.on:not(#mzEroe) [data-act="chiudi"]')) x.click(); // un pannello alla volta
  if (view !== v) { resetScroll = true; ui.item = null; ui.chest = null; ui.skill = null; ui.butta = null; if (v !== 'serra') ui.serra = null; }
  const was = view;
  view = v;
  s.setAttribute('aria-label', titolo(v));
  s.classList.add('on');
  heroBtn()?.classList.toggle('on', v === 'eroe');
  if (!was) addEventListener('keydown', onKey, true);
  render();
  if (!was) s.querySelector<HTMLElement>(v === 'eroe' ? `[data-tab="${ui.tab}"]` : 'button:not(:disabled):not(.mz-x)')?.focus({ preventScroll: true });
  if (!raf) raf = requestAnimationFrame(watch);
}

/** Scheda del personaggio; con `b` (nel dungeon) sullo zaino della spedizione, aperta sulla scheda Zaino. */
export function openHero(c: PanelCtx, b?: RunBag): void {
  if (!!b !== !!bag) closePanels();
  bag = b ?? null;
  if (bag) { ui.tab = 'zaino'; ui.item = null; ui.butta = null; resetScroll = true; }
  show(c, 'eroe');
}
export function openBuilding(c: PanelCtx, kind: BuildingKind): void {
  if (bag) return; // nel dungeon niente edifici
  show(c, kind);
  if (kind !== 'serra') return;
  // «Raccogli» dal foglio della Serra: raccoglie subito se c'è qualcosa di pronto, poi mostra cosa è arrivato
  ui.serra = null;
  const lot = curLot();
  if (lot && sheet?.querySelector('[data-act="serra"]:not(:disabled)')) harvest({ ctx: c, lot, hero: heroOf(lot), busy, ui, act, rerender: render, sotto: false });
}
/** Banco del Contrabbandiere al Porto (game/porto.ts via ui/eroe.ts). */
export function openContrabbando(c: PanelCtx, frase: string): void {
  if (bag) return;
  battuta = frase;
  show(c, 'contrabbando');
}
export function closePanels(): void {
  if (!view) { bag = null; return; }
  view = null; bag = null; ui.butta = null;
  removeEventListener('keydown', onKey, true);
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  heroBtn()?.classList.remove('on');
  if (sheet) {
    if (sheet.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    sheet.classList.remove('on'); sheet.replaceChildren();
  }
}
export function isPanelOpen(): boolean { return view !== null; }
/** Dungeon insieme (#118): un'azione dello zaino è arrivata dal server (turno): la scheda aperta si ridisegna. */
export function refreshBag(): void { if (bag && view) render(); }

// state().eroe (?test=1): sostituisce quello di ui/eroe.ts appena il chunk è caricato
registerStateProvider('eroe', () => {
  const l = curLot(), h = bag ? bag.hero() : l ? heroOf(l) : null, d = h ? heroDerived(h) : null;
  return {
    loaded: true, open: view !== null, view, tab: view === 'eroe' ? ui.tab : null, busy, sotto: !!bag,
    livello: h?.livello ?? 0, xp: h?.xp ?? 0, carico: d?.carico ?? 0, caricoMax: d?.caricoMax ?? 0, scelte: h?.scelte ?? 0, perkPunti: h?.perkPunti ?? 0,
    monete: h?.monete ?? 0, equip: h ? { ...h.equip } : {}, inv: h ? { ...h.inv } : {}, forziere: l?.forziere ? { ...l.forziere } : {},
  };
});
