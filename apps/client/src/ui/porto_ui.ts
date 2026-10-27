// Pannelli del Porto (#63-#65), chunk caricato con import() alla prima apertura da game/porto.ts: Mercante del Porto (corpo in
// porto_mercante.ts), Bacheca delle missioni (tre al giorno, calcolate con @marea/sim/economy/missioni.ts dal lotto, RISCUOTI sul server)
// e le battute della Gente del Porto (scheda in basso, AVANTI). Un pannello alla volta; tastiera in capture su window solo a pannello
// aperto con stopPropagation (mai keyup), come l'editor: Esc chiude, frecce tra i bottoni, sinistra/destra cambiano scheda, E/Spazio/Invio
// fanno andare avanti le battute.
import { GENTE } from '@marea/content/porto.ts';
import type { PersonaPorto } from '@marea/content/porto.ts';
import { finoAlCambio, missioniOf } from '@marea/sim/economy/missioni.ts';
import type { LotState } from '@marea/sim';
import { barcaDi } from '@marea/sim';
import { ApiError } from '../net/api.ts';
import type { PortoCtx } from '../game/porto.ts';
import { el, injectUiStyle } from './style.ts';
import { CORNICE_LIBRO, FONT_LIBRO, LIBRO, RAMETTO, injectKit } from './kit.ts';
import { pixIcon, resIcon } from './icons.ts';
import { flyResources, tickTimers, timerSpan } from './sheet.ts';
import { TABS, mercanteBody } from './porto_mercante.ts';
import type { MercanteState } from './porto_mercante.ts';
import { chiacchierata, favoreInCorso } from './paesani_dlg.ts';
import type { Pagina, Scheda } from './paesani_dlg.ts';
import { registerTestHook } from '../test/testapi.ts';

export type PortoUiKind = 'mercante' | 'bacheca' | 'parla';
export type PortoUi = {
  readonly kind: PortoUiKind | null;
  mercante(): void; bacheca(): void; parla(p: PersonaPorto): void;
  /** Battuta dopo (l'ultima chiude). */
  avanti(): void;
  close(): void; isOpen(): boolean;
  state(): Record<string, unknown>;
};

const L = LIBRO;
// Pannello del Porto e dialogo dei paesani nello stile del kit («libro illustrato», ui/kit.ts), come le botteghe.
const BTN = `position: relative; min-height: 44px; border-radius: 12px; border: 2px solid ${L.oro}; background: ${L.acqua}; color: ${L.cartaChiara}; font: 700 15px ${FONT_LIBRO}; text-shadow: 0 1px 0 ${L.acquaScura}; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 3px 0 1.5px ${L.inchiostro}; cursor: pointer;`;
const BTN_GIU = `transform: translateY(2px); box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 1px 0 1.5px ${L.inchiostro};`;
const BTN_SPENTO = `background: ${L.cartaScura}; color: ${L.inchiostro2}; text-shadow: none; border-color: ${L.filo}; box-shadow: 0 0 0 1.5px ${L.inchiostro2}; cursor: default;`;
const BTN_CARTA = `background: ${L.cartaChiara}; color: ${L.inchiostro}; text-shadow: none; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.cartaScura}, 0 3px 0 1.5px ${L.inchiostro};`;
const STYLE = `
#mzPortoPanel, #mzDialogo { color: ${L.inchiostro}; font: 700 15px ${FONT_LIBRO}; font-variant-numeric: lining-nums; }
#mzPortoPanel.mz-sheet { box-sizing: border-box; padding: 8px 10px 10px; background: ${L.carta}; border-radius: 16px; ${CORNICE_LIBRO(3)} }
#mzPortoPanel .mz-head { gap: 8px; margin-bottom: 6px; }
#mzPortoPanel .mz-title { min-width: 0; font: italic 700 24px ${FONT_LIBRO}; letter-spacing: 0; color: ${L.inchiostro}; white-space: nowrap; }
#mzPortoPanel .mz-title::after { content: ''; flex: none; display: block; width: 34px; height: 17px; margin-left: 4px; vertical-align: -2px; background: ${RAMETTO} center / contain no-repeat; }
#mzPortoPanel .mz-x { border-radius: 50%; border: 2px solid ${L.inchiostro}; background: ${L.cartaChiara}; color: ${L.inchiostro}; box-shadow: inset 0 0 0 2px ${L.oro}, 0 2px 0 rgba(46,33,24,.35); font: 700 22px/1 ${FONT_LIBRO}; }
#mzPortoPanel .mz-btn, #mzDialogo .mz-btn { ${BTN} padding: 0 18px; }
#mzPortoPanel .mz-btn.ghost, #mzDialogo .mz-btn.ghost { ${BTN_CARTA} }
#mzPortoPanel .mz-btn:active:not(:disabled), #mzDialogo .mz-btn:active:not(:disabled) { ${BTN_GIU} }
.mz-pt-monete { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; min-height: 32px; padding: 0 10px; border-radius: 999px; background: ${L.cartaScura}; border: 1.5px solid ${L.oro}; white-space: nowrap; }
.mz-pt-say { margin: 0 0 8px; padding: 6px 10px; border-radius: 12px; background: ${L.cartaChiara}; border: 1.5px solid ${L.filo}; font-size: 14px; font-weight: 400; font-style: italic; line-height: 1.35; }
.mz-pt-say b { color: ${L.acquaScura}; font-weight: 700; font-style: normal; }
.mz-pt-tabs { display: flex; gap: 4px; margin: 0 -2px 4px; border-bottom: 2px solid ${L.oro}; }
.mz-pt-tab { flex: 1; min-height: 44px; padding: 0 4px; border: 2px solid ${L.oro}; border-bottom: 0; border-radius: 10px 10px 0 0; background: ${L.cartaScura}; color: ${L.inchiostro2}; font: 700 15px ${FONT_LIBRO}; cursor: pointer; }
.mz-pt-tab[aria-pressed="true"] { background: ${L.acqua}; color: ${L.cartaChiara}; text-shadow: 0 1px 0 ${L.acquaScura}; }
.mz-pt-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 4px 6px; min-height: 52px; box-sizing: border-box; border-radius: 10px; background: ${L.cartaChiara}; border: 1.5px solid ${L.filo}; }
.mz-pt-row.sel { border-color: ${L.acqua}; }
.mz-pt-row .nm { flex: 1; min-width: 0; min-height: 44px; display: flex; flex-direction: column; justify-content: center; padding: 0; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.mz-pt-row div.nm { cursor: default; }
.mz-pt-row .nm b { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mz-pt-row .tag { font-size: 12px; font-weight: 700; color: ${L.acquaScura}; }
.mz-pt-row .tag.dim { color: ${L.inchiostro2}; font-weight: 400; font-style: italic; }
.mz-pt-row .pr { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.mz-pt-row .pr.no { color: ${L.rosso}; }
.mz-pt-act { ${BTN} flex: none; min-width: 96px; padding: 0 12px; }
.mz-pt-act.mini { min-width: 64px; padding: 0 6px; }
.mz-pt-chip { display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px; border: 1.5px solid ${L.inchiostro}; border-radius: 4px; }
.mz-pt-act:active:not(:disabled) { ${BTN_GIU} }
.mz-pt-act:disabled { ${BTN_SPENTO} }
.mz-pt-miss { margin: 4px 2px 0; color: ${L.rosso}; font-size: 13px; line-height: 1.3; }
.mz-pt-miss.ok { color: ${L.foglia}; }
.mz-pt-card { margin-top: 8px; padding: 8px 10px; border-radius: 12px; background: ${L.cartaChiara}; border: 1.5px solid ${L.filo}; }
.mz-pt-card.fatta { background: ${L.cartaScura}; }
.mz-pt-card .tx { font-size: 15px; line-height: 1.3; }
.mz-pt-bar { position: relative; height: 12px; margin: 6px 0; overflow: hidden; border-radius: 999px; background: ${L.cartaScura}; border: 1.5px solid ${L.inchiostro2}; }
.mz-pt-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: ${L.acqua}; }
.mz-pt-card .ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mz-pt-card .pz { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 14px; }
.mz-pt-card .pz span { display: inline-flex; align-items: center; gap: 3px; }
.mz-pt-card .cnt { font-size: 12px; color: ${L.inchiostro2}; font-weight: 400; font-style: italic; }
.mz-dlg { position: absolute; left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 178px); z-index: 21; display: none; padding: 10px 12px; box-sizing: border-box; background: ${L.carta}; border-radius: 16px; ${CORNICE_LIBRO(3)} }
.mz-dlg.on { display: block; }
.mz-dlg .who { display: flex; align-items: center; gap: 6px; color: ${L.acquaScura}; font: italic 700 19px ${FONT_LIBRO}; }
.mz-dlg p { margin: 6px 0 8px; font-size: 17px; font-weight: 400; line-height: 1.4; }
.mz-dlg .ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mz-dlg .n { color: ${L.inchiostro2}; font-size: 13px; }
.mz-dlg .mz-btn { width: auto; min-width: 140px; margin: 0; justify-content: center; }
.mz-dlg .nt { margin: -2px 0 8px; color: ${L.inchiostro2}; font-size: 13px; font-weight: 400; font-style: italic; line-height: 1.35; }
.mz-dlg .nt.bad { color: ${L.rosso}; font-weight: 700; font-style: normal; }
.mz-dlg .sc { display: flex; gap: 8px; }
.mz-dlg .sc .mz-btn { min-width: 0; padding: 6px 14px; }
@media (min-width: 700px) { .mz-dlg { left: 50%; right: auto; width: 540px; transform: translateX(-50%); bottom: 32px; } }
`;

export function cancelloVuotoAperto(lot: LotState | null): boolean {
  const h = lot?.hero;
  if (h) {
    if ((h.inv?.['unico_anello_onda'] ?? 0) > 0) return true;
    if (h.equip?.anello1 === 'unico_anello_onda' || h.equip?.anello2 === 'unico_anello_onda') return true;
    if ((h.completati ?? []).includes('vuoto')) return true;
    if ((h.lanterne?.['vuoto'] ?? -1) >= 0) return true;
  }
  try { if (localStorage.getItem('marea:cancello_vuoto_aperto') === '1') return true; } catch { /* pazienza */ }
  return false;
}

/** Le battute in fila della gente che non è paesana (i paesani hanno la chiacchierata di paesani_dlg.ts). */
export function battuteDi(p: PersonaPorto): string[] { return p.battute ?? []; }
/** Prove e screenshot: l'ora (ms) delle chiacchiere dei paesani; null = quella del server. */
let oraFinta: number | null = null;

export function createPortoUi(ctx: PortoCtx): PortoUi {
  injectUiStyle(); injectKit(); // il kit porta il carattere del libro (Alegreya)
  if (!document.getElementById('mz-portoui-style')) { const st = document.createElement('style'); st.id = 'mz-portoui-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const sheet = el('div', 'mz mz-sheet mz-side mz-pt'); sheet.id = 'mzPortoPanel'; sheet.setAttribute('role', 'dialog');
  const dlg = el('div', 'mz mz-dlg'); dlg.id = 'mzDialogo'; dlg.setAttribute('role', 'dialog');
  for (const e of [sheet, dlg]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  ctx.root.append(sheet, dlg);
  const ishi = GENTE.gente.find((p) => p.ruolo === 'mercante');
  let kind: PortoUiKind | null = null, gen = 0, aperture = 0, timer = 0;
  let persona: PersonaPorto | null = null, riga = 0;
  /** La chiacchierata con un paesano (null = battute in fila), l'errore del server sulla pagina, quando è apparsa (niente doppi tocchi sulle scelte). */
  let pagine: Pagina[] | null = null, notaErr: string | null = null, mostrataAt = 0, cieloUsato: { pioggia: number; vento: number } | null = null;
  registerTestHook('paesaniOra', (ms) => { oraFinta = ms === null || ms === undefined ? null : Number(ms); return true; });
  const merc: MercanteState = { tab: 'cappelli', prova: null, provaBarca: null, note: null, busy: false };
  const bach = { busy: false, note: null as { i: number; text: string; bad: boolean } | null, riscosse: 0 };

  // ---------- tastiera ----------
  const items = (): HTMLElement[] => [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  const onKey = (e: KeyboardEvent): void => {
    if (!kind || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation(); // WASD/frecce/C/F/M non arrivano al gioco
    if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat) close(); return; }
    if (kind === 'parla') {
      const sc = [...dlg.querySelectorAll<HTMLElement>('.sc button')];
      if (sc.length && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); const i = sc.indexOf(document.activeElement as HTMLElement);
        sc[(i < 0 ? 0 : i + (e.key === 'ArrowRight' ? 1 : sc.length - 1)) % sc.length]?.focus();
        return;
      }
      if (['Enter', 'Space', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        if (e.repeat) return;
        if (sc.length) { if (performance.now() - mostrataAt > 400) (sc.includes(document.activeElement as HTMLElement) ? document.activeElement as HTMLElement : sc[0])?.click(); }
        else avanti();
      }
      return;
    }
    if (e.code === 'KeyE') { e.preventDefault(); if (!e.repeat) close(); return; }
    const list = items(), a = document.activeElement as HTMLElement | null, i = a ? list.indexOf(a) : -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      list[i < 0 ? (d > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + d))]?.focus();
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && kind === 'mercante') {
      e.preventDefault(); merc.tab = TABS[(TABS.indexOf(merc.tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!; merc.note = null; render();
      sheet.querySelector<HTMLElement>(`[data-tab="${merc.tab}"]`)?.focus();
    } else if (e.key === 'Enter' && i < 0) { e.preventDefault(); list[0]?.focus(); }
  };
  const keys = (on: boolean) => { if (on) addEventListener('keydown', onKey, true); else removeEventListener('keydown', onKey, true); };

  // ---------- disegno ----------
  function head(title: string, icon: 'mercante' | 'bacheca'): HTMLElement {
    const h = el('div', 'mz-head'), t = el('div', 'mz-title'); t.style.display = 'flex'; t.style.alignItems = 'center'; t.style.gap = '6px';
    t.append(pixIcon(icon, 24), el('span', '', title));
    const lot = ctx.getLot(), pc = el('span', 'mz-pt-monete'); pc.title = 'Le tue monete'; pc.dataset['monete'] = String(lot?.monete ?? '');
    pc.append(resIcon('monete', 16), lot ? String(lot.monete) : '…');
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
    const fav = favoreInCorso(lot, now); // il favore di un paesano: si fa nel Borgo, qui solo il promemoria
    if (fav) {
      const c = el('div', 'mz-pt-card'); c.dataset['favore'] = '1';
      const cnt = el('div', 'cnt'); cnt.append('Favore di un paesano · scade tra ', timerSpan(fav.scade));
      c.append(el('div', 'tx', fav.testo), cnt);
      list.appendChild(c);
    }
    for (const m of missioniOf(lot, now).list) {
      const c = el('div', 'mz-pt-card' + (m.riscossa ? ' fatta' : '')); c.dataset['missione'] = String(m.i); c.dataset['tipo'] = m.tipo;
      const bar = el('div', 'mz-pt-bar'), fill = el('i'); fill.style.width = `${Math.round((100 * m.fatto) / m.n)}%`; bar.appendChild(fill);
      const pz = el('div', 'pz');
      if (m.premio > 0) { const s = el('span'); s.append(resIcon('monete', 16), `+${m.premio}`); pz.appendChild(s); }
      const b = el('button', 'mz-pt-act' + (m.compiuta && !m.riscossa ? ' green' : ''), m.riscossa ? 'Riscossa' : m.compiuta ? 'Riscuoti' : 'In corso');
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
  function fly(from: HTMLElement, premio: number): void {
    const r = from.getBoundingClientRect(), rr = ctx.root.getBoundingClientRect(), p = { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 };
    if (premio > 0) flyResources(ctx.root, p, ctx.hud.resAnchor?.('monete') ?? null, 'monete', premio, () => ctx.hud.bump?.('monete'));
  }

  // ---------- apri / chiudi ----------
  function openSheet(k: 'mercante' | 'bacheca'): void {
    close(true);
    kind = k; gen++; aperture++;
    merc.note = null; merc.prova = null; merc.provaBarca = null; merc.busy = false; bach.note = null; bach.busy = false;
    sheet.classList.add('on'); keys(true); render();
    sheet.scrollTop = 0;
    items()[0]?.focus({ preventScroll: true });
    timer = window.setInterval(() => tickTimers(sheet, ctx.api?.serverNow() ?? Date.now()), 1000);
    // contatori e monete freschi dal server (le missioni contano anche quello che hai fatto altrove)
    const g = gen;
    if (ctx.api?.enabled) ctx.api.lot().then((l) => { ctx.setLot(l); if (g === gen) render(); }, () => { /* restano quelli noti */ });
  }

  function parla(p: PersonaPorto): void {
    close(true);
    kind = 'parla'; gen++; persona = p; riga = 0; pagine = null; notaErr = null;
    if (p.ruolo === 'paesano') {
      const g = gen;
      const scheda: Scheda = {
        viva: () => g === gen && kind === 'parla',
        poi: (nuove) => { if (g !== gen || !pagine) return; pagine.splice(riga + 1, pagine.length, ...nuove); riga++; notaErr = null; renderDlg(); },
        nota: (t) => { if (g !== gen) return; notaErr = t; renderDlg(); },
        chiudi: () => { if (g === gen) close(); },
        vola: (n) => { const b = dlg.querySelector<HTMLElement>('.ft') ?? dlg; fly(b, n); },
      };
      const c = ctx.cielo?.() ?? null; cieloUsato = c;
      pagine = chiacchierata({ id: p.id, ctx, cielo: c, cancello: cancelloVuotoAperto(ctx.getLot()), ora: oraFinta ?? ctx.api?.serverNow() ?? Date.now(), scheda });
      if (!pagine.length) pagine = [{ testo: '…' }];
    }
    dlg.classList.add('on'); keys(true); renderDlg();
  }
  /** Le pagine della scheda: la chiacchierata del paesano o le battute in fila. */
  const pagineDi = (p: PersonaPorto): Pagina[] => pagine ?? battuteDi(p).map((testo) => ({ testo }));
  function renderDlg(): void {
    if (kind !== 'parla' || !persona) return;
    const lines = pagineDi(persona), pg = lines[riga];
    const who = el('div', 'who'); who.append(pixIcon('parla', 16), el('span', '', persona.nome));
    const last = riga >= lines.length - 1;
    const ft = el('div', 'ft'); ft.append(el('span', 'n', lines.length > 1 ? `${riga + 1}/${lines.length}` : ''));
    if (pg?.scelte?.length) {
      const sc = el('div', 'sc');
      for (const s of pg.scelte) {
        const b = el('button', 'mz-btn' + (s.principale ? ' green' : ' ghost'), s.label); b.type = 'button'; b.dataset['act'] = s.act;
        b.addEventListener('click', () => { if (b.disabled) return; for (const x of sc.querySelectorAll('button')) (x as HTMLButtonElement).disabled = true; void s.fai(); });
        sc.appendChild(b);
      }
      ft.appendChild(sc);
    } else {
      const b = el('button', 'mz-btn' + (last ? ' green' : ''), last ? 'Ciao' : 'Avanti ›'); b.type = 'button'; b.dataset['act'] = last ? 'ciao' : 'avanti';
      b.addEventListener('click', () => avanti());
      ft.appendChild(b);
    }
    dlg.dataset['persona'] = persona.id;
    const parts: HTMLElement[] = [who, el('p', '', pg?.testo ?? '')];
    if (notaErr) parts.push(el('div', 'nt bad', notaErr));
    else if (pg?.nota) parts.push(el('div', 'nt', pg.nota));
    dlg.replaceChildren(...parts, ft);
    mostrataAt = performance.now();
    if (pg?.scelte?.length) dlg.querySelector<HTMLElement>('.sc button')?.focus({ preventScroll: true });
  }
  function avanti(): void {
    if (kind !== 'parla' || !persona) return;
    const lines = pagineDi(persona);
    if (lines[riga]?.scelte?.length) return; // sulle scelte si tocca un bottone (il bottone A del telefono non sceglie per te)
    if (riga >= lines.length - 1) { close(); return; }
    riga++; notaErr = null; renderDlg();
  }
  function close(silent = false): void {
    if (!kind) return;
    const was = kind;
    kind = null; gen++; keys(false); clearInterval(timer);
    const a = document.activeElement as HTMLElement | null;
    if (a && (sheet.contains(a) || dlg.contains(a))) a.blur();
    sheet.classList.remove('on'); dlg.classList.remove('on');
    if (was === 'mercante' && merc.prova !== null && ctx.me) ctx.setLook({ ...ctx.me.look }); // la prova si toglie: torna il look salvato
    if (was === 'mercante' && merc.provaBarca !== null) ctx.world.setBarca(barcaDi(ctx.me?.look)); // anche quella della barca (#107)
    merc.prova = null; merc.provaBarca = null; persona = null; pagine = null; notaErr = null;
    if (!silent) ctx.onClose();
  }

  return {
    get kind() { return kind; },
    mercante: () => openSheet('mercante'),
    bacheca: () => openSheet('bacheca'),
    parla, avanti, close: () => close(), isOpen: () => kind !== null,
    state: () => ({ kind, tab: merc.tab, prova: merc.prova, provaBarca: merc.provaBarca, note: merc.note?.text ?? bach.note?.text ?? null, busy: merc.busy || bach.busy, persona: persona?.id ?? null, riga, battuta: persona ? (pagineDi(persona)[riga]?.testo ?? null) : null, pagine: persona ? pagineDi(persona).map((x) => ({ testo: x.testo, nota: x.nota ?? null, scelte: x.scelte?.map((s) => s.act) ?? [] })) : null, notaErr, cielo: cieloUsato, cancelloAperto: cancelloVuotoAperto(ctx.getLot()), riscosse: bach.riscosse }),
  };
}
