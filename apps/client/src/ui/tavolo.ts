// Tavolo delle Sfide (F2-tavolo, CONTRACTS §12): scegli un amico e una posta, giochi la Regata, il server rigioca e dà l'esito.
// Solo DOM sopra createSheet. La gara la fa girare chi ci passa `play` (regata.ts via main.ts); qui si chiama poi api.play.
// PC prima: Esc indietro/chiude, frecce su/giù spostano il focus, sinistra/destra cambiano la posta, Invio sceglie, Tab funziona.
// I tasti si ascoltano solo a pannello aperto e visibile (capture su window + stopPropagation): a pannello chiuso nessun handler.
import { BALANCE } from '@marea/content';
import { ZERO, tableInfo, total } from '@marea/sim';
import type { Challenge, LotState, Resources } from '@marea/sim';
import { mancaText } from '../net/api.ts';
import type { Api, Me, PackedInputs, Persona, PlayResult } from '../net/api.ts';
import { el, injectUiStyle } from './style.ts';
import { RES_IDS } from './icons.ts';
import type { ResId } from './icons.ts';
import { createSheet, tickTimers } from './sheet.ts';
import type { Sheet } from './sheet.ts';
import { STEP, viewAmici, viewAttesa, viewEsito, viewHome, viewPosta } from './tavolo_viste.ts';
import type { TavoloCtx } from './tavolo_viste.ts';

export type Tavolo = { open(): void; close(): void; isOpen(): boolean };
export type TavoloOpts = {
  api: Api;
  me: Me;
  /** Fa giocare la gara della sfida; null = annullata (Esc). */
  play: (challenge: Challenge) => Promise<PackedInputs | null>;
  onClose?: () => void;
  /** Il lotto riletto dal server (posta tolta, esito con Perle): la barra delle risorse lo segue subito. */
  onLot?: (lot: LotState) => void;
  /** Dove appendere il pannello (default #ui, poi body). */
  root?: HTMLElement;
  /** Minigioco delle sfide nuove. */
  minigame?: string;
};

export type View =
  | { k: 'home' }
  | { k: 'amici' }
  | { k: 'posta'; to: Persona }
  | { k: 'attesa'; text: string }
  | { k: 'esito'; c: Challenge; r: PlayResult | null };
export type Note = { text: string; bad: boolean } | null;

export { fmtGara } from './tavolo_viste.ts'; // la usa anche la regata

export function createTavolo(o: TavoloOpts): Tavolo {
  const { api, me } = o;
  const minigame = o.minigame ?? 'regata';
  let sheet: Sheet | null = null;
  let open = false, playing = false, busy = false;
  let view: View = { k: 'home' };
  let note: Note = null;
  let lot: LotState | null = me.lotto;
  let list: Challenge[] = [];
  let persone: Persona[] = [];
  let loaded = false;
  const friendLots = new Map<string, LotState | null>();
  let stake: Resources = { ...ZERO, legno: BALANCE.wager.min };
  let timer: ReturnType<typeof setInterval> | null = null;
  let gen = 0; // scarta risposte arrivate dopo una chiusura

  const nomeDi = (id: string): string => (id === me.id ? me.nome : persone.find((p) => p.id === id)?.nome ?? id);
  const altro = (c: Challenge): string => nomeDi(c.from === me.id ? c.to : c.from);
  const errText = (e: unknown): string => {
    const x = e as { message?: string; manca?: Resources };
    const m = mancaText(x?.manca);
    return (x?.message || 'Qualcosa non va, riprova') + (m ? `: ${m}` : '');
  };

  function ensureSheet(): Sheet {
    if (sheet) return sheet;
    injectUiStyle();
    const root = o.root ?? (document.getElementById('ui') as HTMLElement | null) ?? document.body;
    sheet = createSheet(root, onSheetClosed);
    sheet.el.id = 'mzTavolo';
    sheet.el.classList.add('mz-tv');
    sheet.el.setAttribute('role', 'dialog');
    sheet.el.setAttribute('aria-label', 'Tavolo delle Sfide');
    return sheet;
  }

  // ---------- tastiera (solo a pannello aperto e visibile) ----------
  let keysOn = false;
  const navItems = (): HTMLElement[] => {
    if (!sheet) return [];
    return [...sheet.el.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), [tabindex="0"]')].filter((e) => !e.classList.contains('mz-x'));
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!open || playing || !sheet) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation(); // niente movimento dell'avatar mentre il pannello è aperto
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && sheet.el.contains(active);
    const items = navItems();
    switch (e.key) {
      case 'Escape': e.preventDefault(); back(); return;
      case 'ArrowDown': case 'ArrowUp': {
        e.preventDefault();
        if (!items.length) return;
        const i = inside && active ? items.indexOf(active) : -1;
        const n = i < 0 ? (e.key === 'ArrowDown' ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
        items[n]?.focus();
        return;
      }
      case 'ArrowLeft': case 'ArrowRight': case '-': case '+': {
        const r = inside && active ? (active.dataset['res'] as ResId | undefined) : undefined;
        if (r) { e.preventDefault(); bump(r, e.key === 'ArrowRight' || e.key === '+' ? STEP : -STEP); }
        return;
      }
      case 'Enter': {
        if (!inside) { e.preventDefault(); items[0]?.focus(); return; }
        if (active?.dataset['res']) { e.preventDefault(); sheet.el.querySelector<HTMLElement>('[data-nav="sfida"]:not(:disabled)')?.focus(); }
        return; // su un bottone l'Invio lo clicca il browser
      }
      case 'Tab': if (!inside && items[0]) { e.preventDefault(); items[0].focus(); } return;
      default: return;
    }
  };
  const keys = (on: boolean): void => {
    if (on === keysOn) return;
    keysOn = on;
    if (on) addEventListener('keydown', onKey, true);
    else removeEventListener('keydown', onKey, true);
  };

  // ---------- dati ----------
  async function load(): Promise<void> {
    const g = gen;
    const [l, c, p] = await Promise.allSettled([api.lot(), api.challenges(), loaded ? Promise.resolve(persone) : api.persone()]);
    if (g !== gen) return;
    if (l.status === 'fulfilled') { lot = l.value; o.onLot?.(lot); }
    if (c.status === 'fulfilled') list = c.value;
    if (p.status === 'fulfilled') { persone = p.value; loaded = true; }
    const bad = [l, c, p].find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
    if (bad) note = { text: errText(bad.reason), bad: true };
  }
  async function loadFriend(id: string): Promise<void> {
    if (friendLots.has(id)) return;
    friendLots.set(id, null);
    try { friendLots.set(id, await api.lot(id)); } catch { /* l'isola dell'amico è solo un aiuto: senza, niente avviso */ }
    if (open && view.k === 'posta' && view.to.id === id) render();
  }

  // ---------- navigazione ----------
  function go(v: View, n: Note = null): void { view = v; note = n; render(true, true); }
  function back(): void {
    if (busy) return;
    if (view.k === 'posta') go({ k: 'amici' });
    else if (view.k === 'amici' || view.k === 'esito') go({ k: 'home' });
    else if (view.k === 'home') api_close();
  }
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    busy = true; render();
    try { return await fn(); } catch (e) { note = { text: errText(e), bad: true }; return undefined; } finally { busy = false; }
  }

  /** Fa giocare la sfida (pannello nascosto e tasti liberi), poi manda gli input e mostra l'esito. */
  async function giocaTurno(c: Challenge): Promise<void> {
    playing = true; keys(false);
    sheet?.el.classList.remove('on');
    let inputs: PackedInputs | null = null, err: unknown = null;
    try { inputs = await o.play(c); } catch (e) { err = e; }
    playing = false;
    open = true;
    if (!inputs) {
      await load();
      go({ k: 'home' }, { text: err ? errText(err) : 'Gara annullata: puoi rigiocarla finché la sfida è aperta', bad: !!err });
      keys(true); startTick();
      return;
    }
    keys(true); startTick();
    go({ k: 'attesa', text: 'Il server rigioca la tua gara…' });
    busy = true;
    try {
      const r = await api.play(c.id, inputs);
      busy = false;
      list = [r.challenge, ...list.filter((x) => x.id !== r.challenge.id)];
      go({ k: 'esito', c: r.challenge, r });
      void load().then(() => { if (open && view.k === 'esito') render(); });
    } catch (e) {
      busy = false;
      await load();
      go({ k: 'home' }, { text: errText(e), bad: true });
    }
  }

  async function sfida(to: Persona): Promise<void> {
    const c = await run(() => api.createChallenge(to.id, stake, minigame));
    if (!c) { render(); return; }
    list = [c, ...list];
    await giocaTurno(c);
  }
  async function accetta(c: Challenge): Promise<void> {
    const a = await run(() => api.accept(c.id));
    if (!a) { await load(); render(); return; }
    list = list.map((x) => (x.id === a.id ? a : x));
    await giocaTurno(a);
  }
  async function rifiuta(c: Challenge): Promise<void> {
    const r = await run(() => api.decline(c.id));
    if (r) { list = list.map((x) => (x.id === r.id ? r : x)); note = { text: `Sfida di ${nomeDi(c.from)} rifiutata`, bad: false }; }
    render();
  }

  // ---------- posta ----------
  const info = () => (lot ? tableInfo(lot) : { level: 0, wagerMax: 0, free: 0, usedToday: 0, nowMs: 0 });
  function bump(r: ResId, d: number): void {
    const max = info().wagerMax;
    const others = total(stake) - stake[r];
    const v = Math.max(0, Math.min(stake[r] + d, max - others));
    if (v === stake[r]) return;
    stake = { ...stake, [r]: v };
    render();
  }
  function fitStake(): void {
    const max = info().wagerMax;
    if (total(stake) > max) stake = { ...ZERO, legno: Math.min(BALANCE.wager.min, max) };
    if (total(stake) < BALANCE.wager.min && lot) {
      const best = RES_IDS.filter((k) => k !== 'perle').reduce((a, k) => (lot && lot.resources[k] > lot.resources[a] ? k : a), 'legno' as ResId);
      stake = { ...ZERO, [best]: Math.min(BALANCE.wager.min, max) };
    }
  }

  const ctx: TavoloCtx = {
    me,
    get lot() { return lot; }, get list() { return list; }, get persone() { return persone; }, get loaded() { return loaded; },
    get stake() { return stake; }, get note() { return note; }, get busy() { return busy; },
    serverNow: () => api.serverNow(), info, nomeDi, altro, friendLot: (id) => friendLots.get(id),
    go, close: api_close, bump, fitStake, loadFriend, sfida, accetta, rifiuta, gioca: giocaTurno,
  };

  /** focusFirst: se non c'era focus nel pannello va sul primo elemento; force: ci va comunque (dopo il primo caricamento). */
  function render(focusFirst = false, force = false): void {
    if (!open || playing) return;
    const s = ensureSheet();
    const active = document.activeElement as HTMLElement | null;
    const hadFocus = !!active && s.el.contains(active);
    const keep = hadFocus && !force ? active?.dataset['nav'] ?? active?.closest<HTMLElement>('[data-nav]')?.dataset['nav'] : undefined;
    const body = el('div'); body.dataset['panel'] = 'tavolo-' + view.k;
    if (busy) body.setAttribute('aria-busy', 'true');
    if (view.k === 'home') viewHome(ctx, body);
    else if (view.k === 'amici') viewAmici(ctx, body);
    else if (view.k === 'posta') viewPosta(ctx, body, view.to);
    else if (view.k === 'esito') viewEsito(ctx, body, view.c, view.r);
    else viewAttesa(ctx, body, view.text);
    s.open('tavolo', body); // senza firma: ridisegna sempre
    tickTimers(s.el, api.serverNow());
    const again = keep ? s.el.querySelector<HTMLElement>(`[data-nav="${CSS.escape(keep)}"]`) : null;
    if (again && !(again as HTMLButtonElement).disabled) again.focus({ preventScroll: false });
    else if (focusFirst || hadFocus) {
      const first = navItems()[0];
      if (first) first.focus({ preventScroll: true });
      else s.el.querySelector<HTMLElement>('.mz-x')?.focus({ preventScroll: true });
    }
  }

  function startTick(): void {
    if (timer) return;
    timer = setInterval(() => { if (open && !playing && sheet) tickTimers(sheet.el, api.serverNow()); }, 1000);
  }
  function stopTick(): void { if (timer) { clearInterval(timer); timer = null; } }

  function onSheetClosed(): void {
    if (playing) return; // la chiusura durante la gara la gestisce giocaTurno
    open = false; gen++; busy = false;
    keys(false); stopTick();
    const a = document.activeElement as HTMLElement | null;
    if (a && sheet?.el.contains(a)) a.blur();
    o.onClose?.();
  }
  function api_close(): void {
    if (!open || playing) return;
    if (sheet?.key()) sheet.close(); else onSheetClosed();
  }

  return {
    open() {
      if (open || playing) return;
      open = true; note = null; view = { k: 'home' };
      keys(true); startTick();
      render(true);
      const g = gen;
      const was = () => (document.activeElement as HTMLElement | null)?.dataset['nav'];
      const first = was();
      void load().then(() => { if (g === gen && open && view.k === 'home') render(true, was() === first); });
    },
    close: api_close,
    /** false mentre si gioca la gara: il pannello è nascosto e i tasti sono della regata. */
    isOpen: () => open && !playing,
  };
}
