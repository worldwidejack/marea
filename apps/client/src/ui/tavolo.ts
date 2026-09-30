// Tavolo delle Sfide (F2-tavolo, CONTRACTS §12): scegli un amico e una posta, giochi la Regata, il server rigioca e dà l'esito.
// Solo DOM sopra createSheet. La gara la fa girare chi ci passa `play` (regata.ts via main.ts); qui si chiama poi api.play.
// PC prima: Esc indietro/chiude, frecce su/giù spostano il focus, sinistra/destra cambiano la posta, Invio sceglie, Tab funziona.
// I tasti si ascoltano solo a pannello aperto e visibile (capture su window + stopPropagation): a pannello chiuso nessun handler.
import { BALANCE } from '@marea/content';
import { ZERO, add, geq, missing, tableInfo, total, turnOf } from '@marea/sim';
import type { Challenge, LotState, Resources } from '@marea/sim';
import { mancaText } from '../net/api.ts';
import type { Api, Me, PackedInputs, Persona, PlayResult } from '../net/api.ts';
import { el, injectUiStyle } from './style.ts';
import { RES_IDS, RES_NOME, resIcon } from './icons.ts';
import type { ResId } from './icons.ts';
import { costNodes } from './lotpanels.ts';
import { createSheet, tickTimers, timerSpan } from './sheet.ts';
import type { Sheet } from './sheet.ts';

export type Tavolo = { open(): void; close(): void; isOpen(): boolean };
export type TavoloOpts = {
  api: Api;
  me: Me;
  /** Fa giocare la gara della sfida; null = annullata (Esc). */
  play: (challenge: Challenge) => Promise<PackedInputs | null>;
  onClose?: () => void;
  /** Dove appendere il pannello (default #ui, poi body). */
  root?: HTMLElement;
  /** Minigioco delle sfide nuove. */
  minigame?: string;
};

type View =
  | { k: 'home' }
  | { k: 'amici' }
  | { k: 'posta'; to: Persona }
  | { k: 'attesa'; text: string }
  | { k: 'esito'; c: Challenge; r: PlayResult | null };
type Note = { text: string; bad: boolean } | null;

const STEP = 5;
const MEDAGLIA: Record<string, string> = { oro: 'Oro', argento: 'Argento', bronzo: 'Bronzo' };

/** «1:23.4» da millisecondi. */
export function fmtGara(ms: number): string {
  const t = Math.max(0, Math.round(ms / 100));
  const m = Math.floor(t / 600), s = Math.floor((t % 600) / 10), d = t % 10;
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

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
    if (l.status === 'fulfilled') lot = l.value;
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

  // ---------- disegno ----------
  function head(title: string): HTMLElement {
    const h = el('div', 'mz-head');
    h.appendChild(el('div', 'mz-title', title));
    const x = el('button', 'mz-x', '×');
    x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi'; x.dataset['nav'] = 'chiudi';
    x.addEventListener('click', () => api_close());
    h.appendChild(x);
    return h;
  }
  function btn(cls: string, nav: string, main: string | HTMLElement[], sub: (string | Node)[], disabled: boolean, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'mz-btn ' + cls);
    b.dataset['act'] = nav.split(':')[0] ?? nav; b.dataset['nav'] = nav;
    b.disabled = disabled || busy;
    const left = el('span', 'who');
    if (typeof main === 'string') left.textContent = main; else left.append(...main);
    b.appendChild(left);
    if (sub.length) { const s = el('span', 'sub'); s.append(...sub); b.appendChild(s); }
    b.addEventListener('click', () => { if (!b.disabled && !busy) onClick(); });
    return b;
  }
  const noteEl = (n: Note): HTMLElement | null => (n ? el('div', 'mz-note ' + (n.bad ? 'bad' : 'ok'), n.text) : null);
  const medalEl = (m: string | null): HTMLElement => el('span', 'mz-medal ' + (m ?? 'none'), m ? MEDAGLIA[m] ?? m : 'nessuna medaglia');
  const stakeLine = (label: string, r: Resources): HTMLElement => { const d = el('div'); d.append(label, ...costNodes(r)); return d; };

  function statoText(c: Challenge): string {
    const mio = c.from === me.id, lui = altro(c);
    switch (c.state) {
      case 'gioca_sfidante': return mio ? 'tocca a te' : `${lui} sta giocando`;
      case 'aperta': return mio ? `aspetti ${lui}` : 'ti sfida!';
      case 'accettata': return mio ? `${lui} sta giocando` : 'tocca a te';
      case 'chiusa': return c.winner === 'pari' ? 'pari' : (c.winner === 'from') === mio ? 'hai vinto' : 'hai perso';
      case 'rifiutata': return 'rifiutata';
      case 'scaduta': return 'scaduta';
    }
  }

  function viewHome(body: HTMLElement): void {
    const t = info();
    body.appendChild(head('Tavolo delle Sfide'));
    const inf = el('div', 'mz-info');
    if (t.level >= 1) {
      const liberi = Math.max(0, t.free - t.usedToday);
      inf.append(el('div', '', `Posta fino a ${t.wagerMax} · sfide gratis oggi ${liberi}/${t.free}`));
    } else inf.append(el('div', '', 'Per lanciare sfide costruisci il Tavolo sulla tua isola. Puoi comunque rispondere.'));
    body.appendChild(inf);
    const n = noteEl(note); if (n) body.appendChild(n);

    const now = api.serverNow();
    const attive = list.filter((c) => c.state === 'gioca_sfidante' || c.state === 'aperta' || c.state === 'accettata');
    const mieMosse = attive.filter((c) => turnOf(c) === me.id || (c.to === me.id && c.state === 'aperta'));
    const attese = attive.filter((c) => !mieMosse.includes(c));
    const chiuse = list.filter((c) => !attive.includes(c)).slice(0, 6);

    if (mieMosse.length) body.appendChild(el('div', 'mz-tv-sec', 'Tocca a te'));
    for (const c of mieMosse) {
      const sub: Node[] = [...costNodes(c.stake), el('br'), timerSpan(c.expiresMs, 'scade tra ')];
      if (c.to === me.id && c.state === 'aperta') {
        const w = el('div'); w.dataset['cid'] = c.id;
        const who = [el('span', '', `${nomeDi(c.from)} ti sfida`), el('span', 'st', c.scoreFrom !== null ? `da battere: ${c.scoreFrom}` : '')];
        w.appendChild(btn('green', `accetta:${c.id}`, who, sub, false, () => void accetta(c)));
        const row = el('div', 'mz-row');
        row.appendChild(btn('ghost', `rifiuta:${c.id}`, 'RIFIUTA', [], false, () => void rifiuta(c)));
        w.appendChild(row);
        body.appendChild(w);
      } else {
        const who = [el('span', '', `GIOCA contro ${altro(c)}`), el('span', 'st', c.state === 'accettata' && c.scoreFrom !== null ? `da battere: ${c.scoreFrom}` : 'la tua gara')];
        body.appendChild(btn('green', `gioca:${c.id}`, who, sub, now >= c.expiresMs, () => void giocaTurno(c)));
      }
    }
    if (attese.length) body.appendChild(el('div', 'mz-tv-sec', 'In attesa'));
    for (const c of attese) {
      const w = el('div', 'mz-tv-wait'); w.dataset['cid'] = c.id;
      const l = el('span'); l.append(`${altro(c)} · `, ...costNodes(c.stake));
      w.append(l, el('span', 'st', statoText(c)));
      body.appendChild(w);
    }
    body.appendChild(btn('', 'nuova', 'NUOVA SFIDA', ['scegli un amico'], t.level < 1, () => { go({ k: 'amici' }); }));
    if (chiuse.length) body.appendChild(el('div', 'mz-tv-sec', 'Ultime'));
    for (const c of chiuse) {
      const l = el('span', '', `${altro(c)} · ${statoText(c)}`);
      if (c.state === 'chiusa') body.appendChild(btn('ghost', `vedi:${c.id}`, [l], costNodes(c.stake), false, () => go({ k: 'esito', c, r: null })));
      else { const w = el('div', 'mz-tv-wait'); w.append(l, el('span', 'st', '')); w.lastElementChild?.append(...costNodes(c.stake)); body.appendChild(w); }
    }
    if (!list.length && loaded) body.appendChild(el('div', 'mz-info', 'Nessuna sfida per ora.'));
  }

  function viewAmici(body: HTMLElement): void {
    body.appendChild(head('Chi sfidi?'));
    const amici = persone.filter((p) => p.id !== me.id);
    body.appendChild(el('div', 'mz-info', amici.length ? 'Regata sulla laguna: vince il tempo migliore.' : 'Nessun amico ancora: chiedi a Jack di invitarli.'));
    const n = noteEl(note); if (n) body.appendChild(n);
    for (const p of amici) {
      const inCorso = list.some((c) => (c.from === p.id || c.to === p.id) && (c.state === 'gioca_sfidante' || c.state === 'aperta' || c.state === 'accettata'));
      body.appendChild(btn('', `amico:${p.id}`, p.nome.toUpperCase(), inCorso ? ['sfida già in corso'] : [], false, () => {
        fitStake(); void loadFriend(p.id); go({ k: 'posta', to: p });
      }));
    }
    body.appendChild(btn('ghost', 'indietro', 'INDIETRO', [], false, () => go({ k: 'home' })));
  }

  function viewPosta(body: HTMLElement, to: Persona): void {
    const t = info(), min = BALANCE.wager.min, tot = total(stake);
    body.appendChild(head(`Sfida ${to.nome}`));
    const inf = el('div', 'mz-info');
    const r1 = el('div'); r1.append('Posta ', el('span', 'mz-tot', String(tot)), ` · da ${min} a ${t.wagerMax}`);
    inf.append(r1, el('div', '', 'Chi vince prende il doppio. 24 h per rispondere.'));
    body.appendChild(inf);
    for (const r of RES_IDS) {
      const row = el('div', 'mz-step');
      row.tabIndex = 0; row.dataset['res'] = r; row.dataset['nav'] = 'res:' + r;
      row.setAttribute('role', 'spinbutton');
      row.setAttribute('aria-label', RES_NOME[r]);
      row.setAttribute('aria-valuenow', String(stake[r]));
      const name = el('span', 'n'); name.append(resIcon(r, 24), RES_NOME[r]);
      const minus = el('button', '', '−'), plus = el('button', '', '+');
      minus.tabIndex = -1; plus.tabIndex = -1;
      minus.setAttribute('aria-label', `Meno ${RES_NOME[r]}`); plus.setAttribute('aria-label', `Più ${RES_NOME[r]}`);
      minus.dataset['act'] = 'meno'; plus.dataset['act'] = 'piu';
      minus.disabled = busy || stake[r] <= 0;
      plus.disabled = busy || tot >= t.wagerMax;
      minus.addEventListener('click', () => bump(r, -STEP));
      plus.addEventListener('click', () => bump(r, STEP));
      row.append(name, minus, el('span', 'v', String(stake[r])), plus);
      body.appendChild(row);
    }
    const hai = el('div', 'mz-info'); if (lot) hai.appendChild(stakeLine('Hai ', lot.resources));
    body.appendChild(hai);
    const fee = t.usedToday >= t.free ? BALANCE.wager.costoExtraPerle : 0;
    const need = add(stake, { ...ZERO, perle: fee });
    const mio = lot ? missing(lot.resources, need) : null;
    const mioMsg = mio && !geq(lot?.resources ?? ZERO, need) ? mancaText(mio) : '';
    if (fee) body.appendChild(el('div', 'mz-note', `Sfide gratis finite: questa costa ${fee} Perla`));
    if (tot < min) body.appendChild(el('div', 'mz-note bad', `La posta minima è ${min}`));
    if (mioMsg) body.appendChild(el('div', 'mz-note bad', mioMsg.charAt(0).toUpperCase() + mioMsg.slice(1)));
    const fl = friendLots.get(to.id);
    if (fl && !geq(fl.resources, stake)) {
      const m = mancaText(missing(fl.resources, stake)).replace(/^ti mancano/, `a ${to.nome} mancano`);
      body.appendChild(el('div', 'mz-note', `${m.charAt(0).toUpperCase() + m.slice(1)}: non potrà accettare`));
    }
    const n = noteEl(note); if (n) body.appendChild(n);
    const ok = t.level >= 1 && tot >= min && tot <= t.wagerMax && !mioMsg;
    body.appendChild(btn('green', 'sfida', 'SFIDA E GIOCA', costNodes(stake), !ok, () => void sfida(to)));
    body.appendChild(btn('ghost', 'indietro', 'INDIETRO', [], false, () => go({ k: 'amici' })));
  }

  function viewEsito(body: HTMLElement, c: Challenge, r: PlayResult | null): void {
    const mio = c.from === me.id, lui = altro(c);
    const myScore = mio ? c.scoreFrom : c.scoreTo, myMedal = mio ? c.medalFrom : c.medalTo;
    const hisScore = mio ? c.scoreTo : c.scoreFrom, hisMedal = mio ? c.medalTo : c.medalFrom;
    const chiusa = c.state === 'chiusa';
    body.appendChild(head(chiusa ? 'Esito' : 'Gara registrata'));
    if (chiusa) {
      const vinto = c.winner !== 'pari' && (c.winner === 'from') === mio;
      const cls = c.winner === 'pari' ? 'even' : vinto ? 'win' : 'lose';
      body.appendChild(el('div', 'mz-big ' + cls, c.winner === 'pari' ? 'Pari!' : vinto ? 'Hai vinto!' : `Vince ${lui}`));
    }
    const inf = el('div', 'mz-info');
    const d = r?.detail;
    const tu = el('div'); tu.append(`Tu: ${myScore ?? r?.score ?? '—'} · `, medalEl(myMedal ?? r?.medal ?? null));
    inf.appendChild(tu);
    if (d && typeof d['ms'] === 'number') inf.appendChild(el('div', '', `Tempo ${fmtGara(d['ms'])}${typeof d['tot'] === 'number' ? ` · boe ${d['boe'] ?? 0}/${d['tot']}` : ''}`));
    if (hisScore !== null) { const l = el('div'); l.append(`${lui}: ${hisScore} · `, medalEl(hisMedal)); inf.appendChild(l); }
    body.appendChild(inf);
    const post = el('div', 'mz-info');
    if (chiusa) {
      if (c.winner === 'pari') post.appendChild(stakeLine('Poste restituite: ', c.stake));
      else if ((c.winner === 'from') === mio) post.appendChild(stakeLine('Vinci ', c.pot ?? add(c.stake, c.stake)));
      else post.appendChild(stakeLine('Perdi ', c.stake));
      if (c.colpoDiCoda && c.winner === 'to') post.appendChild(el('div', '', 'Colpo di coda: piatto ×1,5'));
    } else if (c.state === 'aperta' && mio) {
      post.append(stakeLine('Posta in gioco: ', c.stake), el('div', '', `Ora tocca a ${lui}: ha 24 h per accettare.`));
    } else post.appendChild(stakeLine('Posta: ', c.stake));
    body.appendChild(post);
    const n = noteEl(note); if (n) body.appendChild(n);
    body.appendChild(btn('', 'ok', 'OK', [], false, () => go({ k: 'home' })));
  }

  /** focusFirst: se non c'era focus nel pannello va sul primo elemento; force: ci va comunque (dopo il primo caricamento). */
  function render(focusFirst = false, force = false): void {
    if (!open || playing) return;
    const s = ensureSheet();
    const active = document.activeElement as HTMLElement | null;
    const hadFocus = !!active && s.el.contains(active);
    const keep = hadFocus && !force ? active?.dataset['nav'] ?? active?.closest<HTMLElement>('[data-nav]')?.dataset['nav'] : undefined;
    const body = el('div'); body.dataset['panel'] = 'tavolo-' + view.k;
    if (busy) body.setAttribute('aria-busy', 'true');
    if (view.k === 'home') viewHome(body);
    else if (view.k === 'amici') viewAmici(body);
    else if (view.k === 'posta') viewPosta(body, view.to);
    else if (view.k === 'esito') viewEsito(body, view.c, view.r);
    else { body.appendChild(head('Tavolo delle Sfide')); body.appendChild(el('div', 'mz-info', view.text)); }
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
