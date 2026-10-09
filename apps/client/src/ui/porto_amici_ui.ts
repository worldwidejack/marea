// Pannelli del Porto tra amici (#110 #111), chunk caricato con import() alla prima apertura da game/porto_amici.ts:
//  - Tabellone dei record: per ogni minigioco da solo il migliore di oggi e il migliore di sempre tra gli amici (nome, punteggio come lo
//    mostra il gioco, medaglia). I punteggi li scrive il server dopo il replay (GET /api/record).
//  - Faro comune: livello, barre verso il prossimo livello (Legno e Pietra totali), bottoni per versare 50 / 200 / TUTTO dal Magazzino
//    (POST /api/faro/versa: decide il server), bonus di adesso e del prossimo livello, chi ha versato di più.
// Tastiera in capture solo a pannello aperto (come porto_ui.ts): Esc o E chiudono, frecce tra i bottoni.
import { FARO } from '@marea/content/porto_amici.ts';
import { finoAlCambio } from '@marea/sim/economy/missioni.ts';
import { ApiError, mancaText } from '../net/api.ts';
import type { FaroVista, RecordRiga, RecordVista } from '../net/api.ts';
import type { PortoAmiciCtx } from '../game/porto_amici.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { pixIcon, resIcon } from './icons.ts';
import { tickTimers, timerSpan } from './sheet.ts';

export type PortoAmiciUi = {
  readonly kind: 'record' | 'faro' | null;
  record(): void; faro(): void; close(): void; isOpen(): boolean;
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
.mz-pa-lv { display: inline-flex; align-items: center; min-height: 32px; padding: 0 8px; margin-left: auto; border: 2px solid ${P.giallo}; color: ${P.giallo}; font-weight: bold; white-space: nowrap; }
.mz-pa-bar { position: relative; height: 16px; margin: 3px 0 2px; background: ${P.roccia}; border: 2px solid ${P.neroCaldo}; }
.mz-pa-bar i { position: absolute; left: 0; top: 0; bottom: 0; }
.mz-pa-bar[data-res="legno"] i { background: ${P.legnoChiaro}; }
.mz-pa-bar[data-res="pietra"] i { background: ${P.pietra}; }
.mz-pa-num { display: flex; justify-content: space-between; font-size: 12px; color: ${P.sabbiaChiara}; }
.mz-pa-versa { margin-top: 8px; padding: 6px 8px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; }
.mz-pa-versa .t { display: flex; align-items: center; gap: 6px; font-weight: bold; font-size: 14px; }
.mz-pa-versa .t small { margin-left: auto; font-weight: normal; color: ${P.sabbia}; }
.mz-pa-btns { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 6px; margin-top: 6px; }
.mz-pa-act { min-height: 44px; padding: 0 6px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-pa-act:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-pa-act:disabled { background: ${P.roccia}; color: ${P.pietra}; border-color: ${P.pietraScura}; cursor: default; }
.mz-pa-note { margin: 6px 2px 0; color: ${P.erba}; font-size: 13px; font-weight: bold; line-height: 1.3; }
.mz-pa-note.bad { color: ${P.arancio}; }
.mz-pa-h { margin: 10px 0 2px; font-size: 13px; font-weight: bold; color: ${P.sabbia}; text-transform: uppercase; letter-spacing: .05em; }
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
  if (mg === 'consegne' && 'consegne' in d) return `${num(d, 'consegne')}/${num(d, 'totale') || 5} pacchi`;
  if ((mg === 'ingorgo' || mg === 'pinguini') && 'risolti' in d) return `${num(d, 'risolti')}/${num(d, 'totale') || 3} · ${num(d, 'mosse')} mosse`;
  return `${r.score.toLocaleString('it-IT')} punti`;
}
const fmt = (n: number) => n.toLocaleString('it-IT');

export function createPortoAmiciUi(ctx: PortoAmiciCtx): PortoAmiciUi {
  injectUiStyle();
  if (!document.getElementById('mz-amiciui-style')) { const st = document.createElement('style'); st.id = 'mz-amiciui-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const sheet = el('div', 'mz mz-sheet mz-side mz-pa'); sheet.id = 'mzAmiciPanel'; sheet.setAttribute('role', 'dialog');
  for (const ev of ['pointerdown', 'touchstart']) sheet.addEventListener(ev, (x) => x.stopPropagation());
  ctx.root.appendChild(sheet);
  let kind: 'record' | 'faro' | null = null, gen = 0, timer = 0;
  let righe: RecordRiga[] | null = null, carica = false, errore: string | null = null;
  const st = { busy: false, note: null as { text: string; bad: boolean } | null, versati: 0 };
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
  function head(title: string, icon: 'record' | 'faro', extra?: HTMLElement): HTMLElement {
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
    for (const r of righe) {
      const box = el('div', 'mz-pa-rec'); box.dataset['minigioco'] = r.minigame;
      const cols = el('div', 'mz-pa-cols'); cols.append(cella('OGGI', r.minigame, r.oggi), cella('SEMPRE', r.minigame, r.sempre));
      box.append(el('b', '', r.nome), cols);
      body.appendChild(box);
    }
    return body;
  }
  function barra(res: 'legno' | 'pietra', ha: number, serve: number, da: number): HTMLElement {
    const w = el('div'); w.dataset['barra'] = res;
    const bar = el('div', 'mz-pa-bar'); bar.dataset['res'] = res;
    const fill = el('i'); fill.style.width = `${Math.max(0, Math.min(100, Math.round((100 * (ha - da)) / Math.max(1, serve - da))))}%`; bar.appendChild(fill);
    const n = el('div', 'mz-pa-num'); const l = el('span'); l.append(resIcon(res, 16)); l.style.display = 'inline-flex'; l.style.gap = '4px'; l.append(res === 'legno' ? 'Legno' : 'Pietra');
    n.append(l, el('span', '', `${fmt(ha)} / ${fmt(serve)}`));
    w.append(n, bar);
    return w;
  }
  function faroBody(f: FaroVista | null): HTMLElement {
    const body = el('div'); body.dataset['panel'] = 'faro';
    if (!f) { body.appendChild(el('div', 'mz-pa-note' + (ctx.api?.enabled ? '' : ' bad'), ctx.api?.enabled ? 'Guardo il faro…' : 'Il faro si costruisce col link personale: chiedilo a Jack')); return body; }
    const say = el('p', 'mz-pa-say');
    const pc = (b: number) => `+${Math.round(b * 100)} %`;
    if (f.livello > 0) say.append('Adesso: ', el('b', '', `Segherie e Cave ${pc(f.bonus)} per tutti`), '. ');
    else say.append('Un faro per tutto l\'arcipelago: ogni Legno e ogni Pietra di chiunque lo fanno crescere. ');
    if (f.prossimo) say.append(`Al livello ${f.prossimo.livello}: `, el('b', '', pc(f.prossimo.bonus)), '.');
    else say.append(el('b', '', 'Grande Faro completo: grazie a tutti!'));
    body.appendChild(say);
    if (f.prossimo) {
      const prima = FARO.livelli[f.prossimo.livello - 2];
      body.append(barra('legno', f.legno, f.prossimo.legno, prima?.legno ?? 0), barra('pietra', f.pietra, f.prossimo.pietra, prima?.pietra ?? 0));
      const lot = ctx.getLot();
      for (const res of ['legno', 'pietra'] as const) {
        const ha = lot?.resources[res] ?? 0, manca = Math.max(0, (FARO.livelli[FARO.livelli.length - 1]?.[res] ?? 0) - f[res]);
        const box = el('div', 'mz-pa-versa'); box.dataset['versa'] = res;
        const t = el('div', 't'); t.append(resIcon(res, 16), `Versa ${res === 'legno' ? 'Legno' : 'Pietra'}`, el('small', '', `ne hai ${fmt(ha)}`));
        const btns = el('div', 'mz-pa-btns');
        const tutto = Math.min(ha, manca);
        for (const n of [...FARO.versa, -1]) {
          const q = n < 0 ? tutto : n;
          const b = el('button', 'mz-pa-act', n < 0 ? `TUTTO${tutto > 0 ? ' ' + fmt(tutto) : ''}` : String(n)); b.type = 'button';
          b.dataset['act'] = 'versa'; b.dataset['q'] = n < 0 ? 'tutto' : String(n);
          b.disabled = st.busy || !lot || q <= 0 || q > ha || q > manca;
          b.addEventListener('click', () => void versa(res, q));
          btns.appendChild(b);
        }
        box.append(t, btns);
        body.appendChild(box);
      }
      if (!lot) body.appendChild(el('div', 'mz-pa-note bad', 'Per versare serve la tua isola (link personale)'));
    }
    if (st.note) body.appendChild(el('div', 'mz-pa-note' + (st.note.bad ? ' bad' : ''), st.note.text));
    body.appendChild(el('div', 'mz-pa-h', 'Chi ha dato di più'));
    if (!f.classifica.length) body.appendChild(el('div', 'mz-pa-say', 'Ancora nessuno: il primo nome qui potrebbe essere il tuo.'));
    f.classifica.forEach((c, i) => {
      const r = el('div', 'mz-pa-top' + (c.id === meId() ? ' io' : '')); r.dataset['chi'] = c.id;
      const q = (res: 'legno' | 'pietra') => { const s = el('span', 'q'); s.append(resIcon(res, 16), fmt(c[res])); return s; };
      r.append(el('span', 'n', String(i + 1)), el('span', 'nm', c.nome), q('legno'), q('pietra'));
      body.appendChild(r);
    });
    return body;
  }
  function render(): void {
    if (!kind) return;
    const active = document.activeElement as HTMLElement | null;
    const keep = active && sheet.contains(active) ? `${active.closest<HTMLElement>('[data-versa]')?.dataset['versa'] ?? ''}|${active.dataset['q'] ?? active.dataset['act'] ?? ''}` : null;
    sheet.dataset['kind'] = kind;
    if (kind === 'record') sheet.replaceChildren(head('Record', 'record'), recordBody());
    else {
      const f = ctx.getFaro(), lv = el('span', 'mz-pa-lv', f ? `LIV. ${f.livello}/${f.max}` : 'LIV. –'); lv.dataset['livello'] = String(f?.livello ?? '');
      sheet.replaceChildren(head('Grande Faro', 'faro', lv), faroBody(f));
    }
    tickTimers(sheet, ctx.api?.serverNow() ?? Date.now());
    if (keep) {
      const [res, q] = keep.split('|');
      const box = res ? sheet.querySelector<HTMLElement>(`[data-versa="${CSS.escape(res)}"]`) : sheet;
      (box?.querySelector<HTMLElement>(`[data-q="${CSS.escape(q ?? '')}"]:not(:disabled), [data-act="${CSS.escape(q ?? '')}"]`) ?? items()[0])?.focus({ preventScroll: true });
    }
  }

  async function versa(res: 'legno' | 'pietra', q: number): Promise<void> {
    if (st.busy || !ctx.api || q <= 0) return;
    const g = gen; st.busy = true; st.note = null; render();
    try {
      const r = await ctx.api.faroVersa(res === 'legno' ? q : 0, res === 'pietra' ? q : 0);
      ctx.setLot(r.lot); ctx.setFaro(r.faro); st.versati++;
      const dato = r.dono.legno ? `${fmt(r.dono.legno)} Legno` : `${fmt(r.dono.pietra)} Pietra`;
      if (g === gen) st.note = { text: r.saliti.length ? `Il Grande Faro sale al livello ${r.faro.livello}! Grazie per ${dato}` : `Versati ${dato}. Il faro ringrazia`, bad: false };
    } catch (e) {
      if (g === gen) st.note = { text: e instanceof ApiError ? (e.manca ? `${e.message}: ${mancaText(e.manca)}` : e.message) : 'Qualcosa non va, riprova', bad: true };
      if (e instanceof ApiError && e.status === 409) void ctx.api.faro().then(ctx.setFaro, () => { /* resta quello noto */ });
    }
    st.busy = false;
    if (g === gen) render();
  }

  // ---------- apri / chiudi ----------
  function apri(k: 'record' | 'faro'): void {
    close(true);
    kind = k; gen++; st.note = null; st.busy = false;
    sheet.classList.add('on'); keys(true); render();
    sheet.scrollTop = 0;
    items()[0]?.focus({ preventScroll: true });
    timer = window.setInterval(() => tickTimers(sheet, ctx.api?.serverNow() ?? Date.now()), 1000);
    const g = gen;
    if (!ctx.api?.enabled) return;
    if (k === 'record') {
      carica = true; errore = null;
      ctx.api.record().then((r) => { righe = r; }, (e: unknown) => { errore = e instanceof ApiError ? e.message : 'Tabellone non letto, riprova'; })
        .finally(() => { carica = false; if (g === gen) render(); });
    } else {
      // faro e Magazzino freschi dal server (gli altri versano anche mentre guardi)
      void Promise.allSettled([ctx.api.faro().then(ctx.setFaro), ctx.api.lot().then(ctx.setLot)]).then(() => { if (g === gen) render(); });
    }
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
    faro: () => apri('faro'),
    close: () => close(), isOpen: () => kind !== null,
    state: () => ({ kind, busy: st.busy, note: st.note?.text ?? null, versati: st.versati, carica, righe: righe?.map((r) => ({ minigame: r.minigame, oggi: r.oggi ? { chi: r.oggi.chi, score: r.oggi.score, testo: punteggioText(r.minigame, r.oggi) } : null, sempre: r.sempre ? { chi: r.sempre.chi, score: r.sempre.score, testo: punteggioText(r.minigame, r.sempre) } : null })) ?? null }),
  };
}
