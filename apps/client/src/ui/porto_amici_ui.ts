// Pannello del Porto tra amici, chunk caricato con import() alla prima apertura da game/porto_amici.ts: il Tabellone dei record,
// per ogni minigioco da solo il migliore di oggi e il migliore di sempre tra gli amici (nome, punteggio come lo mostra il gioco, medaglia).
// I punteggi li scrive il server dopo il replay (GET /api/record). In cima i collezionisti: chi ha consegnato più pesci e insetti
// al mobiliere (GET /api/collezione).
// Tastiera in capture solo a pannello aperto (come porto_ui.ts): Esc o E chiudono, frecce tra i bottoni.
import { finoAlCambio } from '@marea/sim/economy/missioni.ts';
import { ApiError } from '../net/api.ts';
import type { CollezioneRiga, RecordRiga, RecordVista } from '../net/api.ts';
import type { PortoAmiciCtx } from '../game/porto_amici.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { pixIcon } from './icons.ts';
import { tickTimers, timerSpan } from './sheet.ts';

export type PortoAmiciUi = {
  readonly kind: 'record' | null;
  record(): void; close(): void; isOpen(): boolean;
  state(): Record<string, unknown>;
};

const P = PAL;
const MED: Record<string, string> = { oro: P.giallo, argento: P.pietraChiara, bronzo: P.arancio };
const STYLE = `
.mz-pa .mz-head { gap: 10px; }
.mz-pa-say { margin: 0 0 8px; color: ${P.sabbia}; font-size: 14px; line-height: 1.35; }
.mz-pa-say b { color: ${P.giallo}; }
.mz-pa-rec { margin-top: 6px; padding: 5px 8px 6px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; }
.mz-pa-rec > b { display: block; font-size: 14px; color: ${P.sabbiaChiara}; margin-bottom: 3px; }
.mz-pa-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mz-pa-cell { min-width: 0; display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 2px 6px; background: rgba(35,32,31,.45); }
.mz-pa-cell .k { flex: none; font-size: 10px; font-weight: bold; color: ${P.sabbia}; letter-spacing: .05em; writing-mode: horizontal-tb; }
.mz-pa-cell .v { min-width: 0; display: flex; flex-direction: column; line-height: 1.15; }
.mz-pa-cell .v span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: bold; }
.mz-pa-cell .v small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: ${P.sabbiaChiara}; }
.mz-pa-cell.io .v span { color: ${P.giallo}; }
.mz-pa-cell.vuoto .v span { color: ${P.pietraScura}; font-weight: normal; }
.mz-pa-med { flex: none; width: 14px; height: 14px; box-sizing: border-box; border: 2px solid ${P.neroCaldo}; }
.mz-pa-med.no { background: ${P.roccia}; border-color: ${P.pietraScura}; }
.mz-pa-note { margin: 6px 2px 0; color: ${P.erba}; font-size: 13px; font-weight: bold; line-height: 1.3; }
.mz-pa-note.bad { color: ${P.arancio}; }
.mz-pa-top { display: flex; align-items: center; gap: 8px; min-height: 30px; font-size: 14px; border-bottom: 1px solid ${P.legno}; }
.mz-pa-top .n { width: 20px; color: ${P.giallo}; font-weight: bold; }
.mz-pa-top .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: bold; }
.mz-pa-top .q { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; font-size: 13px; }
.mz-pa-top.io .nm { color: ${P.giallo}; }
`;

const num = (d: Record<string, number>, k: string): number => (typeof d[k] === 'number' ? d[k] : 0);
/** Il punteggio come lo mostra il gioco quando è facile (tempo, pacchi, livelli), altrimenti i punti. */
/** Tempo di una corsa: 1:24,3. */
export const tempoCorsa = (ms: number): string => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0').replace('.', ',')}`;
export function punteggioText(mg: string, r: { score: number; detail: Record<string, number> }): string {
  const d = r.detail ?? {};
  if (mg === 'regata' && num(d, 'ms') > 0 && num(d, 'boe') >= num(d, 'tot') && num(d, 'tot') > 0) return `${(num(d, 'ms') / 1000).toFixed(1).replace('.', ',')} s`;
  if (mg === 'corse' && num(d, 'ms') > 0 && num(d, 'giri') >= num(d, 'tot') && num(d, 'tot') > 0) return `${tempoCorsa(num(d, 'ms'))} · ${num(d, 'pos')}°`; // Isola delle Corse
  if (mg === 'snowboard' && num(d, 'finale') > 0) return `${tempoCorsa(num(d, 'finale'))} finale`; // Isola dell'Adrenalina: la classifica è a tempo
  if (mg === 'consegne' && 'consegne' in d) return `${num(d, 'consegne')}/${num(d, 'totale') || 5} pacchi`;
  if ((mg === 'ingorgo' || mg === 'pinguini') && 'risolti' in d) return `${num(d, 'risolti')}/${num(d, 'totale') || 3} · ${num(d, 'mosse')} mosse`;
  return `${r.score.toLocaleString('it-IT')} punti`;
}

export function createPortoAmiciUi(ctx: PortoAmiciCtx): PortoAmiciUi {
  injectUiStyle();
  if (!document.getElementById('mz-amiciui-style')) { const st = document.createElement('style'); st.id = 'mz-amiciui-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const sheet = el('div', 'mz mz-sheet mz-side mz-pa'); sheet.id = 'mzAmiciPanel'; sheet.setAttribute('role', 'dialog');
  for (const ev of ['pointerdown', 'touchstart']) sheet.addEventListener(ev, (x) => x.stopPropagation());
  ctx.root.appendChild(sheet);
  let kind: 'record' | null = null, gen = 0, timer = 0;
  let righe: RecordRiga[] | null = null, carica = false, errore: string | null = null, collez: CollezioneRiga[] | null = null;
  const meId = () => ctx.me?.id ?? '';

  // ---------- tastiera ----------
  const items = (): HTMLElement[] => [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  const onKey = (e: KeyboardEvent): void => {
    if (!kind || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();
    if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); if (!e.repeat) close(); return; }
    const list = items(), a = document.activeElement as HTMLElement | null, i = a ? list.indexOf(a) : -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      list[i < 0 ? (d > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + d))]?.focus();
    }
  };
  const keys = (on: boolean) => { if (on) addEventListener('keydown', onKey, true); else removeEventListener('keydown', onKey, true); };

  // ---------- disegno ----------
  function head(title: string, icon: 'record', extra?: HTMLElement): HTMLElement {
    const h = el('div', 'mz-head'), t = el('div', 'mz-title'); t.style.display = 'flex'; t.style.alignItems = 'center'; t.style.gap = '6px';
    t.append(pixIcon(icon, 24), el('span', '', title));
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi';
    x.addEventListener('click', () => close());
    h.append(t, ...(extra ? [extra] : []), x);
    return h;
  }
  function cella(etichetta: string, mg: string, v: RecordVista | null): HTMLElement {
    const c = el('div', 'mz-pa-cell' + (!v ? ' vuoto' : v.chi === meId() ? ' io' : '')); c.dataset['cella'] = etichetta.toLowerCase();
    const med = el('span', 'mz-pa-med' + (v?.medal ? '' : ' no')); if (v?.medal) { med.style.background = MED[v.medal] ?? P.roccia; med.title = v.medal; }
    const val = el('div', 'v');
    if (v) val.append(el('span', '', v.nome), el('small', '', punteggioText(mg, v))); else val.append(el('span', '', 'nessuno'), el('small', '', '—'));
    c.append(el('span', 'k', etichetta), med, val);
    if (v) c.dataset['chi'] = v.chi;
    return c;
  }
  function recordBody(): HTMLElement {
    const body = el('div'); body.dataset['panel'] = 'record';
    const now = ctx.api?.serverNow() ?? Date.now();
    const say = el('p', 'mz-pa-say'); say.append('Il migliore di oggi e il migliore di sempre tra gli amici. «Oggi» riparte tra ', timerSpan(now + finoAlCambio(now)), '.');
    body.appendChild(say);
    if (!ctx.api?.enabled) { body.appendChild(el('div', 'mz-pa-note bad', 'Il tabellone è per chi ha il link personale: chiedilo a Jack')); return body; }
    if (!righe) { body.appendChild(el('div', 'mz-pa-note' + (errore ? ' bad' : ''), errore ?? 'Leggo il tabellone…')); return body; }
    // i collezionisti (#457): pesci e insetti consegnati al mobiliere
    if (collez?.length) {
      const box = el('div', 'mz-pa-rec'); box.dataset['minigioco'] = 'collezione';
      box.appendChild(el('b', '', 'Collezionisti · pesci e insetti registrati da Fulvio'));
      collez.forEach((c, i) => {
        const r = el('div', 'mz-pa-top' + (c.id === meId() ? ' io' : '')); r.dataset['chi'] = c.id;
        const tot = el('span', 'q'); tot.append(el('b', '', String(c.pesci + c.insetti)));
        r.append(el('span', 'n', String(i + 1)), el('span', 'nm', c.nome), el('span', 'q', `${c.pesci} pesci`), el('span', 'q', `${c.insetti} insetti`), tot);
        box.appendChild(r);
      });
      body.appendChild(box);
    }
    for (const r of righe) {
      const box = el('div', 'mz-pa-rec'); box.dataset['minigioco'] = r.minigame;
      const cols = el('div', 'mz-pa-cols'); cols.append(cella('Oggi', r.minigame, r.oggi), cella('Sempre', r.minigame, r.sempre));
      box.append(el('b', '', r.nome), cols);
      body.appendChild(box);
    }
    return body;
  }
  function render(): void {
    if (!kind) return;
    const active = document.activeElement as HTMLElement | null;
    const keep = active && sheet.contains(active) ? active.dataset['act'] ?? '' : null;
    sheet.dataset['kind'] = kind;
    sheet.replaceChildren(head('Record', 'record'), recordBody());
    tickTimers(sheet, ctx.api?.serverNow() ?? Date.now());
    if (keep !== null) (sheet.querySelector<HTMLElement>(`[data-act="${CSS.escape(keep)}"]`) ?? items()[0])?.focus({ preventScroll: true });
  }

  // ---------- apri / chiudi ----------
  function apri(k: 'record'): void {
    close(true);
    kind = k; gen++;
    sheet.classList.add('on'); keys(true); render();
    sheet.scrollTop = 0;
    items()[0]?.focus({ preventScroll: true });
    timer = window.setInterval(() => tickTimers(sheet, ctx.api?.serverNow() ?? Date.now()), 1000);
    const g = gen;
    if (!ctx.api?.enabled) return;
    carica = true; errore = null;
    ctx.api.record().then((r) => { righe = r; }, (e: unknown) => { errore = e instanceof ApiError ? e.message : 'Tabellone non letto, riprova'; })
      .finally(() => { carica = false; if (g === gen) render(); });
    ctx.api.collezione().then((c) => { collez = c; if (g === gen) render(); }, () => { /* senza collezionisti il tabellone c'è lo stesso */ });
  }
  function close(silent = false): void {
    if (!kind) return;
    kind = null; gen++; keys(false); clearInterval(timer);
    const a = document.activeElement as HTMLElement | null;
    if (a && sheet.contains(a)) a.blur();
    sheet.classList.remove('on');
    if (!silent) ctx.onClose();
  }

  return {
    get kind() { return kind; },
    record: () => apri('record'),
    close: () => close(), isOpen: () => kind !== null,
    state: () => ({ kind, carica, collezione: collez, righe: righe?.map((r) => ({ minigame: r.minigame, oggi: r.oggi ? { chi: r.oggi.chi, score: r.oggi.score, testo: punteggioText(r.minigame, r.oggi) } : null, sempre: r.sempre ? { chi: r.sempre.chi, score: r.sempre.score, testo: punteggioText(r.minigame, r.sempre) } : null })) ?? null }),
  };
}
