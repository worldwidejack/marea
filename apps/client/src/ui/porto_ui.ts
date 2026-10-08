// Pannelli del Porto (#63-#65), chunk caricato con import() alla prima apertura da game/porto.ts: Mercante delle Perle (corpo in
// porto_mercante.ts), Bacheca delle missioni (tre al giorno, calcolate con @marea/sim/economy/missioni.ts dal lotto, RISCUOTI sul server)
// e le battute della Gente del Porto (scheda in basso, AVANTI). Un pannello alla volta; tastiera in capture su window solo a pannello
// aperto con stopPropagation (mai keyup), come l'editor: Esc chiude, frecce tra i bottoni, sinistra/destra cambiano scheda, E/Spazio/Invio
// fanno andare avanti le battute.
import { GENTE } from '@marea/content/porto.ts';
import type { PersonaPorto } from '@marea/content/porto.ts';
import { finoAlCambio, missioniOf } from '@marea/sim/economy/missioni.ts';
import type { Resources } from '@marea/sim';
import { ApiError } from '../net/api.ts';
import type { PortoCtx } from '../game/porto.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { RES_IDS, pixIcon, resIcon } from './icons.ts';
import { flyResources, tickTimers, timerSpan } from './sheet.ts';
import { mercanteBody } from './porto_mercante.ts';
import type { MercanteState } from './porto_mercante.ts';

export type PortoUiKind = 'mercante' | 'bacheca' | 'parla';
export type PortoUi = {
  readonly kind: PortoUiKind | null;
  mercante(): void; bacheca(): void; parla(p: PersonaPorto): void;
  /** Battuta dopo (l'ultima chiude). */
  avanti(): void;
  close(): void; isOpen(): boolean;
  state(): Record<string, unknown>;
};

const P = PAL;
const STYLE = `
.mz-sheet.mz-pt { box-sizing: border-box; }
.mz-pt .mz-head { gap: 10px; }
.mz-pt-perle { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; min-height: 32px; padding: 0 8px; border: 2px solid ${P.legno}; font-weight: bold; white-space: nowrap; }
.mz-pt-say { margin: 0 0 8px; color: ${P.sabbia}; font-size: 14px; line-height: 1.35; }
.mz-pt-say b { color: ${P.giallo}; }
.mz-pt-tabs { display: flex; gap: 6px; margin-bottom: 4px; }
.mz-pt-tab { flex: 1; min-height: 44px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-pt-tab[aria-pressed="true"] { background: ${P.arancio}; color: ${P.neroCaldo}; border-color: ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-pt-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 3px 6px; min-height: 52px; box-sizing: border-box; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; }
.mz-pt-row.sel { border-color: ${P.giallo}; }
.mz-pt-row .nm { flex: 1; min-width: 0; min-height: 44px; display: flex; flex-direction: column; justify-content: center; padding: 0; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.mz-pt-row div.nm { cursor: default; }
.mz-pt-row .nm b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mz-pt-row .tag { font-size: 11px; font-weight: bold; color: ${P.giallo}; letter-spacing: .04em; }
.mz-pt-row .tag.dim { color: ${P.sabbia}; letter-spacing: 0; font-weight: normal; }
.mz-pt-row .pr { display: inline-flex; align-items: center; gap: 4px; font-weight: bold; white-space: nowrap; }
.mz-pt-row .pr.no { color: ${P.arancio}; }
.mz-pt-act { flex: none; min-width: 96px; min-height: 44px; padding: 0 8px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-pt-act.green { background: ${P.erba}; }
.mz-pt-act:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-pt-act:disabled { background: ${P.roccia}; color: ${P.pietra}; border-color: ${P.pietraScura}; cursor: default; }
.mz-pt-miss { margin: 4px 2px 0; color: ${P.arancio}; font-size: 13px; font-weight: bold; line-height: 1.3; }
.mz-pt-miss.ok { color: ${P.erba}; }
.mz-pt-card { margin-top: 8px; padding: 8px 10px; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.legnoScuro}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-pt-card.fatta { background: ${P.pietraChiara}; }
.mz-pt-card .tx { font-weight: bold; font-size: 14px; line-height: 1.3; }
.mz-pt-bar { position: relative; height: 12px; margin: 6px 0; background: ${P.pietra}; border: 2px solid ${P.neroCaldo}; }
.mz-pt-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: ${P.erbaScura}; }
.mz-pt-card .ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mz-pt-card .pz { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-weight: bold; font-size: 14px; }
.mz-pt-card .pz span { display: inline-flex; align-items: center; gap: 3px; }
.mz-pt-card .cnt { font-size: 12px; color: ${P.roccia}; font-weight: bold; }
.mz-dlg { position: absolute; left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 178px); z-index: 21; display: none; padding: 10px 12px; box-sizing: border-box; background: rgba(46,30,20,.97); border: 3px solid ${P.sabbiaChiara}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-dlg.on { display: block; }
.mz-dlg .who { display: flex; align-items: center; gap: 6px; color: ${P.giallo}; font-weight: bold; font-size: 15px; text-transform: uppercase; letter-spacing: .04em; }
.mz-dlg p { margin: 6px 0 8px; font-size: 16px; line-height: 1.4; }
.mz-dlg .ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mz-dlg .n { color: ${P.sabbia}; font-size: 13px; font-weight: bold; }
.mz-dlg .mz-btn { width: auto; min-width: 140px; margin: 0; justify-content: center; }
@media (min-width: 700px) { .mz-dlg { left: 50%; right: auto; width: 540px; transform: translateX(-50%); bottom: 32px; } }
`;

export function createPortoUi(ctx: PortoCtx): PortoUi {
  injectUiStyle();
  if (!document.getElementById('mz-portoui-style')) { const st = document.createElement('style'); st.id = 'mz-portoui-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const sheet = el('div', 'mz mz-sheet mz-side mz-pt'); sheet.id = 'mzPortoPanel'; sheet.setAttribute('role', 'dialog');
  const dlg = el('div', 'mz mz-dlg'); dlg.id = 'mzDialogo'; dlg.setAttribute('role', 'dialog');
  for (const e of [sheet, dlg]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  ctx.root.append(sheet, dlg);
  const ishi = GENTE.gente.find((p) => p.ruolo === 'mercante');
  let kind: PortoUiKind | null = null, gen = 0, aperture = 0, timer = 0;
  let persona: PersonaPorto | null = null, riga = 0;
  const merc: MercanteState = { tab: 'cappelli', prova: null, note: null, busy: false };
  const bach = { busy: false, note: null as { i: number; text: string; bad: boolean } | null, riscosse: 0 };

  // ---------- tastiera ----------
  const items = (): HTMLElement[] => [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  const onKey = (e: KeyboardEvent): void => {
    if (!kind || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation(); // WASD/frecce/C/F/M non arrivano al gioco
    if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat) close(); return; }
    if (kind === 'parla') {
      if (['Enter', 'Space', 'KeyE'].includes(e.code)) { e.preventDefault(); if (!e.repeat) avanti(); }
      return;
    }
    if (e.code === 'KeyE') { e.preventDefault(); if (!e.repeat) close(); return; }
    const list = items(), a = document.activeElement as HTMLElement | null, i = a ? list.indexOf(a) : -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      list[i < 0 ? (d > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + d))]?.focus();
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && kind === 'mercante') {
      e.preventDefault(); merc.tab = merc.tab === 'cappelli' ? 'decor' : 'cappelli'; merc.note = null; render();
      sheet.querySelector<HTMLElement>(`[data-tab="${merc.tab}"]`)?.focus();
    } else if (e.key === 'Enter' && i < 0) { e.preventDefault(); list[0]?.focus(); }
  };
  const keys = (on: boolean) => { if (on) addEventListener('keydown', onKey, true); else removeEventListener('keydown', onKey, true); };

  // ---------- disegno ----------
  function head(title: string, icon: 'mercante' | 'bacheca'): HTMLElement {
    const h = el('div', 'mz-head'), t = el('div', 'mz-title'); t.style.display = 'flex'; t.style.alignItems = 'center'; t.style.gap = '6px';
    t.append(pixIcon(icon, 24), el('span', '', title));
    const lot = ctx.getLot(), pc = el('span', 'mz-pt-perle'); pc.title = 'Le tue Perle'; pc.dataset['perle'] = String(lot?.resources.perle ?? '');
    pc.append(resIcon('perle', 16), lot ? String(lot.resources.perle) : '…');
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi';
    x.addEventListener('click', () => close());
    h.append(t, pc, x);
    return h;
  }
  function bachecaBody(): HTMLElement {
    const body = el('div'); body.dataset['panel'] = 'bacheca';
    const lot = ctx.getLot(), now = ctx.api?.serverNow() ?? Date.now();
    const say = el('p', 'mz-pt-say'); say.append('Tre lavoretti al giorno, uguali solo per te. Nuovi tra ', timerSpan(now + finoAlCambio(now)), '.');
    body.appendChild(say);
    if (!lot || !ctx.api?.enabled) { body.appendChild(el('div', 'mz-pt-miss', 'Le missioni sono per chi ha il link personale: chiedilo a Jack')); return body; }
    const list = el('div');
    for (const m of missioniOf(lot, now).list) {
      const c = el('div', 'mz-pt-card' + (m.riscossa ? ' fatta' : '')); c.dataset['missione'] = String(m.i); c.dataset['tipo'] = m.tipo;
      const bar = el('div', 'mz-pt-bar'), fill = el('i'); fill.style.width = `${Math.round((100 * m.fatto) / m.n)}%`; bar.appendChild(fill);
      const pz = el('div', 'pz');
      for (const id of RES_IDS) if (m.premio[id] > 0) { const s = el('span'); s.append(resIcon(id, 16), `+${m.premio[id]}`); pz.appendChild(s); }
      const b = el('button', 'mz-pt-act' + (m.compiuta && !m.riscossa ? ' green' : ''), m.riscossa ? 'RISCOSSA' : m.compiuta ? 'RISCUOTI' : 'IN CORSO');
      b.type = 'button'; b.dataset['act'] = 'riscuoti'; b.disabled = !m.compiuta || m.riscossa || bach.busy;
      b.addEventListener('click', () => void riscuoti(m.i, b));
      const ft = el('div', 'ft'); ft.append(pz, b);
      c.append(el('div', 'tx', m.testo), bar, el('div', 'cnt', m.riscossa ? 'Fatta. La bacheca è fiera di te' : `${m.fatto} / ${m.n}`), ft);
      if (bach.note?.i === m.i) c.appendChild(el('div', 'mz-pt-miss' + (bach.note.bad ? '' : ' ok'), bach.note.text));
      list.appendChild(c);
    }
    body.appendChild(list);
    return body;
  }
  function render(): void {
    if (kind !== 'mercante' && kind !== 'bacheca') return;
    const active = document.activeElement as HTMLElement | null;
    const keep = active && sheet.contains(active) ? `${active.closest<HTMLElement>('[data-item],[data-missione]')?.dataset['item'] ?? active.closest<HTMLElement>('[data-missione]')?.dataset['missione'] ?? ''}|${active.dataset['act'] ?? active.dataset['tab'] ?? ''}` : null;
    sheet.dataset['kind'] = kind;
    if (kind === 'mercante') {
      const say = el('p', 'mz-pt-say');
      const lines = ishi?.battute ?? [];
      say.append(el('b', '', `${ishi?.nome ?? 'Il Mercante'}: `), lines[aperture % Math.max(1, lines.length)] ?? '');
      sheet.replaceChildren(head('Mercante', 'mercante'), say, mercanteBody(ctx, merc, render));
    } else sheet.replaceChildren(head('Bacheca', 'bacheca'), bachecaBody());
    tickTimers(sheet, ctx.api?.serverNow() ?? Date.now());
    if (keep) {
      const [item, act] = keep.split('|');
      const box = item ? sheet.querySelector<HTMLElement>(`[data-item="${CSS.escape(item)}"], [data-missione="${CSS.escape(item)}"]`) : sheet;
      const again = box?.querySelector<HTMLElement>(`[data-act="${CSS.escape(act ?? '')}"]:not(:disabled), [data-tab="${CSS.escape(act ?? '')}"]`);
      (again ?? items()[0])?.focus({ preventScroll: true });
    }
  }

  async function riscuoti(i: number, b: HTMLElement): Promise<void> {
    if (bach.busy || !ctx.api) return;
    const g = gen; bach.busy = true; bach.note = null; render();
    try {
      const r = await ctx.api.riscuoti(i);
      ctx.setLot(r.lot); bach.riscosse++;
      if (g === gen) bach.note = { i, text: 'Premio riscosso!', bad: false };
      fly(b, r.premio);
    } catch (e) { if (g === gen) bach.note = { i, text: e instanceof ApiError ? e.message : 'Qualcosa non va, riprova', bad: true }; }
    bach.busy = false;
    if (g === gen) render();
  }
  function fly(from: HTMLElement, premio: Resources): void {
    const r = from.getBoundingClientRect(), rr = ctx.root.getBoundingClientRect(), p = { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 };
    for (const id of RES_IDS) if (premio[id] > 0) flyResources(ctx.root, p, ctx.hud.resAnchor?.(id) ?? null, id, premio[id], () => ctx.hud.bump?.(id));
  }

  // ---------- apri / chiudi ----------
  function openSheet(k: 'mercante' | 'bacheca'): void {
    close(true);
    kind = k; gen++; aperture++;
    merc.note = null; merc.prova = null; merc.busy = false; bach.note = null; bach.busy = false;
    sheet.classList.add('on'); keys(true); render();
    sheet.scrollTop = 0;
    items()[0]?.focus({ preventScroll: true });
    timer = window.setInterval(() => tickTimers(sheet, ctx.api?.serverNow() ?? Date.now()), 1000);
    // contatori e Perle freschi dal server (le missioni contano anche quello che hai fatto altrove)
    const g = gen;
    if (ctx.api?.enabled) ctx.api.lot().then((l) => { ctx.setLot(l); if (g === gen) render(); }, () => { /* restano quelli noti */ });
  }
  function parla(p: PersonaPorto): void {
    close(true);
    kind = 'parla'; gen++; persona = p; riga = 0;
    dlg.classList.add('on'); keys(true); renderDlg();
  }
  function renderDlg(): void {
    if (kind !== 'parla' || !persona) return;
    const who = el('div', 'who'); who.append(pixIcon('parla', 16), el('span', '', persona.nome));
    const last = riga >= persona.battute.length - 1;
    const b = el('button', 'mz-btn' + (last ? ' green' : ''), last ? 'CIAO' : 'AVANTI ›'); b.type = 'button'; b.dataset['act'] = last ? 'ciao' : 'avanti';
    b.addEventListener('click', () => avanti());
    const ft = el('div', 'ft'); ft.append(el('span', 'n', `${riga + 1}/${persona.battute.length}`), b);
    dlg.dataset['persona'] = persona.id;
    dlg.replaceChildren(who, el('p', '', persona.battute[riga] ?? ''), ft);
  }
  function avanti(): void {
    if (kind !== 'parla' || !persona) return;
    if (riga >= persona.battute.length - 1) { close(); return; }
    riga++; renderDlg();
  }
  function close(silent = false): void {
    if (!kind) return;
    const was = kind;
    kind = null; gen++; keys(false); clearInterval(timer);
    const a = document.activeElement as HTMLElement | null;
    if (a && (sheet.contains(a) || dlg.contains(a))) a.blur();
    sheet.classList.remove('on'); dlg.classList.remove('on');
    if (was === 'mercante' && merc.prova !== null && ctx.me) ctx.setLook({ ...ctx.me.look }); // la prova si toglie: torna il look salvato
    merc.prova = null; persona = null;
    if (!silent) ctx.onClose();
  }

  return {
    get kind() { return kind; },
    mercante: () => openSheet('mercante'),
    bacheca: () => openSheet('bacheca'),
    parla, avanti, close: () => close(), isOpen: () => kind !== null,
    state: () => ({ kind, tab: merc.tab, prova: merc.prova, note: merc.note?.text ?? bach.note?.text ?? null, busy: merc.busy || bach.busy, persona: persona?.id ?? null, riga, riscosse: bach.riscosse }),
  };
}
