// Viste del Tavolo delle Sfide (F3-pulizia, CONTRACTS §13): home, amici, posta, esito. Solo disegno del DOM: dati e azioni arrivano da `TavoloCtx`.
// Da tavolo.ts si importano solo tipi (nessun import circolare a runtime).
import { BALANCE } from '@marea/content';
import { ZERO, add, geq, missing, total, turnOf } from '@marea/sim';
import type { Challenge, LotState, Resources } from '@marea/sim';
import { mancaText } from '../net/api.ts';
import type { Me, Persona, PlayResult } from '../net/api.ts';
import { el } from './style.ts';
import { RES_IDS, RES_NOME, resIcon } from './icons.ts';
import type { ResId } from './icons.ts';
import { costNodes } from './lotpanels.ts';
import { timerSpan } from './sheet.ts';
import type { Note, View } from './tavolo.ts';

/** Passo dei pulsanti +/− della posta. */
export const STEP = 5;
const MEDAGLIA: Record<string, string> = { oro: 'Oro', argento: 'Argento', bronzo: 'Bronzo' };

/** «1:23.4» da millisecondi. */
export function fmtGara(ms: number): string {
  const t = Math.max(0, Math.round(ms / 100));
  const m = Math.floor(t / 600), s = Math.floor((t % 600) / 10), d = t % 10;
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

/** Dati e callback di cui le viste hanno bisogno (getter: leggono sempre lo stato vivo di createTavolo). */
export type TavoloCtx = {
  readonly me: Me;
  readonly lot: LotState | null;
  readonly list: Challenge[];
  readonly persone: Persona[];
  readonly loaded: boolean;
  readonly stake: Resources;
  readonly note: Note;
  readonly busy: boolean;
  serverNow(): number;
  info(): { level: number; wagerMax: number; free: number; usedToday: number };
  nomeDi(id: string): string;
  altro(c: Challenge): string;
  /** Lotto dell'amico: undefined = non ancora chiesto, null = in arrivo o non disponibile. */
  friendLot(id: string): LotState | null | undefined;
  go(v: View, n?: Note): void;
  /** Chiude il pannello (la X). */
  close(): void;
  bump(r: ResId, d: number): void;
  fitStake(): void;
  loadFriend(id: string): Promise<void>;
  sfida(to: Persona): Promise<void>;
  accetta(c: Challenge): Promise<void>;
  rifiuta(c: Challenge): Promise<void>;
  gioca(c: Challenge): Promise<void>;
};

function head(ctx: TavoloCtx, title: string): HTMLElement {
  const h = el('div', 'mz-head');
  h.appendChild(el('div', 'mz-title', title));
  const x = el('button', 'mz-x', '×');
  x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi'; x.dataset['nav'] = 'chiudi';
  x.addEventListener('click', () => ctx.close());
  h.appendChild(x);
  return h;
}
function btn(ctx: TavoloCtx, cls: string, nav: string, main: string | HTMLElement[], sub: (string | Node)[], disabled: boolean, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'mz-btn ' + cls);
  b.dataset['act'] = nav.split(':')[0] ?? nav; b.dataset['nav'] = nav;
  b.disabled = disabled || ctx.busy;
  const left = el('span', 'who');
  if (typeof main === 'string') left.textContent = main; else left.append(...main);
  b.appendChild(left);
  if (sub.length) { const s = el('span', 'sub'); s.append(...sub); b.appendChild(s); }
  b.addEventListener('click', () => { if (!b.disabled && !ctx.busy) onClick(); });
  return b;
}
const noteEl = (n: Note): HTMLElement | null => (n ? el('div', 'mz-note ' + (n.bad ? 'bad' : 'ok'), n.text) : null);
const medalEl = (m: string | null): HTMLElement => el('span', 'mz-medal ' + (m ?? 'none'), m ? MEDAGLIA[m] ?? m : 'nessuna medaglia');
const stakeLine = (label: string, r: Resources): HTMLElement => { const d = el('div'); d.append(label, ...costNodes(r)); return d; };

function statoText(ctx: TavoloCtx, c: Challenge): string {
  const mio = c.from === ctx.me.id, lui = ctx.altro(c);
  switch (c.state) {
    case 'gioca_sfidante': return mio ? 'tocca a te' : `${lui} sta giocando`;
    case 'aperta': return mio ? `aspetti ${lui}` : 'ti sfida!';
    case 'accettata': return mio ? `${lui} sta giocando` : 'tocca a te';
    case 'chiusa': return c.winner === 'pari' ? 'pari' : (c.winner === 'from') === mio ? 'hai vinto' : 'hai perso';
    case 'rifiutata': return 'rifiutata';
    case 'scaduta': return 'scaduta';
  }
}

export function viewHome(ctx: TavoloCtx, body: HTMLElement): void {
  const t = ctx.info();
  body.appendChild(head(ctx, 'Tavolo delle Sfide'));
  const inf = el('div', 'mz-info');
  if (t.level >= 1) {
    const liberi = Math.max(0, t.free - t.usedToday);
    inf.append(el('div', '', `Posta fino a ${t.wagerMax} · sfide gratis oggi ${liberi}/${t.free}`));
  } else inf.append(el('div', '', 'Per lanciare sfide costruisci il Tavolo sulla tua isola. Puoi comunque rispondere.'));
  body.appendChild(inf);
  const n = noteEl(ctx.note); if (n) body.appendChild(n);

  const now = ctx.serverNow();
  const attive = ctx.list.filter((c) => c.state === 'gioca_sfidante' || c.state === 'aperta' || c.state === 'accettata');
  const mieMosse = attive.filter((c) => turnOf(c) === ctx.me.id || (c.to === ctx.me.id && c.state === 'aperta'));
  const attese = attive.filter((c) => !mieMosse.includes(c));
  const chiuse = ctx.list.filter((c) => !attive.includes(c)).slice(0, 6);

  if (mieMosse.length) body.appendChild(el('div', 'mz-tv-sec', 'Tocca a te'));
  for (const c of mieMosse) {
    const sub: Node[] = [...costNodes(c.stake), el('br'), timerSpan(c.expiresMs, 'scade tra ')];
    if (c.to === ctx.me.id && c.state === 'aperta') {
      const w = el('div'); w.dataset['cid'] = c.id;
      const who = [el('span', '', `${ctx.nomeDi(c.from)} ti sfida`), el('span', 'st', c.scoreFrom !== null ? `da battere: ${c.scoreFrom}` : '')];
      w.appendChild(btn(ctx, 'green', `accetta:${c.id}`, who, sub, false, () => void ctx.accetta(c)));
      const row = el('div', 'mz-row');
      row.appendChild(btn(ctx, 'ghost', `rifiuta:${c.id}`, 'RIFIUTA', [], false, () => void ctx.rifiuta(c)));
      w.appendChild(row);
      body.appendChild(w);
    } else {
      const who = [el('span', '', `GIOCA contro ${ctx.altro(c)}`), el('span', 'st', c.state === 'accettata' && c.scoreFrom !== null ? `da battere: ${c.scoreFrom}` : 'la tua gara')];
      body.appendChild(btn(ctx, 'green', `gioca:${c.id}`, who, sub, now >= c.expiresMs, () => void ctx.gioca(c)));
    }
  }
  if (attese.length) body.appendChild(el('div', 'mz-tv-sec', 'In attesa'));
  for (const c of attese) {
    const w = el('div', 'mz-tv-wait'); w.dataset['cid'] = c.id;
    const l = el('span'); l.append(`${ctx.altro(c)} · `, ...costNodes(c.stake));
    w.append(l, el('span', 'st', statoText(ctx, c)));
    body.appendChild(w);
  }
  body.appendChild(btn(ctx, '', 'nuova', 'NUOVA SFIDA', ['scegli un amico'], t.level < 1, () => { ctx.go({ k: 'amici' }); }));
  if (chiuse.length) body.appendChild(el('div', 'mz-tv-sec', 'Ultime'));
  for (const c of chiuse) {
    const l = el('span', '', `${ctx.altro(c)} · ${statoText(ctx, c)}`);
    if (c.state === 'chiusa') body.appendChild(btn(ctx, 'ghost', `vedi:${c.id}`, [l], costNodes(c.stake), false, () => ctx.go({ k: 'esito', c, r: null })));
    else { const w = el('div', 'mz-tv-wait'); w.append(l, el('span', 'st', '')); w.lastElementChild?.append(...costNodes(c.stake)); body.appendChild(w); }
  }
  if (!ctx.list.length && ctx.loaded) body.appendChild(el('div', 'mz-info', 'Nessuna sfida per ora.'));
}

export function viewAmici(ctx: TavoloCtx, body: HTMLElement): void {
  body.appendChild(head(ctx, 'Chi sfidi?'));
  const amici = ctx.persone.filter((p) => p.id !== ctx.me.id);
  body.appendChild(el('div', 'mz-info', amici.length ? 'Regata sulla laguna: vince il tempo migliore.' : 'Nessun amico ancora: chiedi a Jack di invitarli.'));
  const n = noteEl(ctx.note); if (n) body.appendChild(n);
  for (const p of amici) {
    const inCorso = ctx.list.some((c) => (c.from === p.id || c.to === p.id) && (c.state === 'gioca_sfidante' || c.state === 'aperta' || c.state === 'accettata'));
    body.appendChild(btn(ctx, '', `amico:${p.id}`, p.nome.toUpperCase(), inCorso ? ['sfida già in corso'] : [], false, () => {
      ctx.fitStake(); void ctx.loadFriend(p.id); ctx.go({ k: 'posta', to: p });
    }));
  }
  body.appendChild(btn(ctx, 'ghost', 'indietro', 'INDIETRO', [], false, () => ctx.go({ k: 'home' })));
}

export function viewPosta(ctx: TavoloCtx, body: HTMLElement, to: Persona): void {
  const t = ctx.info(), min = BALANCE.wager.min, tot = total(ctx.stake);
  body.appendChild(head(ctx, `Sfida ${to.nome}`));
  const inf = el('div', 'mz-info');
  const r1 = el('div'); r1.append('Posta ', el('span', 'mz-tot', String(tot)), ` · da ${min} a ${t.wagerMax}`);
  inf.append(r1, el('div', '', 'Chi vince prende il doppio. 24 h per rispondere.'));
  body.appendChild(inf);
  for (const r of RES_IDS) {
    const row = el('div', 'mz-step');
    row.tabIndex = 0; row.dataset['res'] = r; row.dataset['nav'] = 'res:' + r;
    row.setAttribute('role', 'spinbutton');
    row.setAttribute('aria-label', RES_NOME[r]);
    row.setAttribute('aria-valuenow', String(ctx.stake[r]));
    const name = el('span', 'n'); name.append(resIcon(r, 24), RES_NOME[r]);
    const minus = el('button', '', '−'), plus = el('button', '', '+');
    minus.tabIndex = -1; plus.tabIndex = -1;
    minus.setAttribute('aria-label', `Meno ${RES_NOME[r]}`); plus.setAttribute('aria-label', `Più ${RES_NOME[r]}`);
    minus.dataset['act'] = 'meno'; plus.dataset['act'] = 'piu';
    minus.disabled = ctx.busy || ctx.stake[r] <= 0;
    plus.disabled = ctx.busy || tot >= t.wagerMax;
    minus.addEventListener('click', () => ctx.bump(r, -STEP));
    plus.addEventListener('click', () => ctx.bump(r, STEP));
    row.append(name, minus, el('span', 'v', String(ctx.stake[r])), plus);
    body.appendChild(row);
  }
  const hai = el('div', 'mz-info'); if (ctx.lot) hai.appendChild(stakeLine('Hai ', ctx.lot.resources));
  body.appendChild(hai);
  const fee = t.usedToday >= t.free ? BALANCE.wager.costoExtraPerle : 0;
  const need = add(ctx.stake, { ...ZERO, perle: fee });
  const mio = ctx.lot ? missing(ctx.lot.resources, need) : null;
  const mioMsg = mio && !geq(ctx.lot?.resources ?? ZERO, need) ? mancaText(mio) : '';
  if (fee) body.appendChild(el('div', 'mz-note', `Sfide gratis finite: questa costa ${fee} Perla`));
  if (tot < min) body.appendChild(el('div', 'mz-note bad', `La posta minima è ${min}`));
  if (mioMsg) body.appendChild(el('div', 'mz-note bad', mioMsg.charAt(0).toUpperCase() + mioMsg.slice(1)));
  const fl = ctx.friendLot(to.id);
  if (fl && !geq(fl.resources, ctx.stake)) {
    const m = mancaText(missing(fl.resources, ctx.stake)).replace(/^ti mancano/, `a ${to.nome} mancano`);
    body.appendChild(el('div', 'mz-note', `${m.charAt(0).toUpperCase() + m.slice(1)}: non potrà accettare`));
  }
  const n = noteEl(ctx.note); if (n) body.appendChild(n);
  const ok = t.level >= 1 && tot >= min && tot <= t.wagerMax && !mioMsg;
  body.appendChild(btn(ctx, 'green', 'sfida', 'SFIDA E GIOCA', costNodes(ctx.stake), !ok, () => void ctx.sfida(to)));
  body.appendChild(btn(ctx, 'ghost', 'indietro', 'INDIETRO', [], false, () => ctx.go({ k: 'amici' })));
}

export function viewEsito(ctx: TavoloCtx, body: HTMLElement, c: Challenge, r: PlayResult | null): void {
  const mio = c.from === ctx.me.id, lui = ctx.altro(c);
  const myScore = mio ? c.scoreFrom : c.scoreTo, myMedal = mio ? c.medalFrom : c.medalTo;
  const hisScore = mio ? c.scoreTo : c.scoreFrom, hisMedal = mio ? c.medalTo : c.medalFrom;
  const chiusa = c.state === 'chiusa';
  body.appendChild(head(ctx, chiusa ? 'Esito' : 'Gara registrata'));
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
  const n = noteEl(ctx.note); if (n) body.appendChild(n);
  body.appendChild(btn(ctx, '', 'ok', 'OK', [], false, () => ctx.go({ k: 'home' })));
}

/** Vista di attesa (il server rigioca la gara). */
export function viewAttesa(ctx: TavoloCtx, body: HTMLElement, text: string): void {
  body.appendChild(head(ctx, 'Tavolo delle Sfide'));
  body.appendChild(el('div', 'mz-info', text));
}
