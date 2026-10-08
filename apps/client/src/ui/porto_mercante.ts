// Mercante delle Perle (#63), corpo del pannello: cappelli (prova sul tuo avatar, COMPRA, INDOSSA) e decorazioni (COMPRA → posata
// sulla tua isola, nella cella libera più vicina a casa). Le esclusive del Mercante (avatar.json / decor.json `mercante: true`) in cima.
// Tutto deciso dal server: Perle, posseduti, celle. Fa parte del chunk dei pannelli del Porto (ui/porto_ui.ts).
import { AVATAR, DECOR } from '@marea/content';
import { cellsOf, decorCellError, defaultTemplate } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { ApiError, mancaText, perleText } from '../net/api.ts';
import type { PortoCtx } from '../game/porto.ts';
import { el } from './style.ts';
import { resIcon } from './icons.ts';

export type Tab = 'cappelli' | 'decor';
export type Note = { id: string; text: string; bad: boolean } | null;
export type MercanteState = { tab: Tab; prova: number | null; note: Note; busy: boolean };

const HATS = AVATAR.cappelli.map((h, i) => ({ ...h, i })).filter((h) => h.perle > 0).sort((a, b) => Number(!!b.mercante) - Number(!!a.mercante) || a.perle - b.perle);
const DECORS = [...DECOR].sort((a, b) => Number(!!b.mercante) - Number(!!a.mercante) || a.perle - b.perle);

/** Cella libera per una decorazione: sabbia/erba del template, la più vicina allo spawn di casa ma non attaccata (lì si arriva). */
export function cellaLibera(lot: LotState): [number, number] | null {
  const t = defaultTemplate();
  if (!t) return null;
  const casa = cellsOf(t, 'P')[0] ?? [0, 0];
  const ok = [...cellsOf(t, 'g'), ...cellsOf(t, '.')].filter((c) => !decorCellError(lot, c, t) && Math.max(Math.abs(c[0] - casa[0]), Math.abs(c[1] - casa[1])) >= 2);
  ok.sort((a, b) => Math.hypot(a[0] - casa[0], a[1] - casa[1]) - Math.hypot(b[0] - casa[0], b[1] - casa[1]) || a[1] - b[1] || a[0] - b[0]);
  return ok[0] ?? null;
}

const errText = (e: unknown): string => {
  if (e instanceof ApiError && e.manca) return e.manca.perle > 0 && !e.manca.legno && !e.manca.pietra ? perleText(e.manca.perle) : `${e.message}: ${mancaText(e.manca)}`;
  return e instanceof ApiError ? e.message : 'Qualcosa non va, riprova';
};

/** Il corpo del pannello. `redraw` ridisegna (dopo ogni azione). */
export function mercanteBody(ctx: PortoCtx, st: MercanteState, redraw: () => void): HTMLElement {
  const lot = ctx.getLot(), perle = lot?.resources.perle ?? null, online = !!ctx.api?.enabled && !!lot;
  const owned = (id: string) => (lot?.posseduti ?? []).includes(id);
  const body = el('div'); body.dataset['panel'] = 'mercante';
  const tabs = el('div', 'mz-pt-tabs');
  for (const [id, nome] of [['cappelli', 'CAPPELLI'], ['decor', 'DECORAZIONI']] as const) {
    const b = el('button', 'mz-pt-tab', nome); b.type = 'button'; b.dataset['tab'] = id; b.setAttribute('aria-pressed', String(st.tab === id));
    b.addEventListener('click', () => { st.tab = id; st.note = null; redraw(); });
    tabs.appendChild(b);
  }
  body.appendChild(tabs);
  if (!online) body.appendChild(el('div', 'mz-pt-miss', 'Per comprare serve il tuo link personale: chiedilo a Jack'));

  const price = (n: number) => { const s = el('span', 'pr' + (perle !== null && perle < n ? ' no' : '')); s.append(resIcon('perle', 16), String(n)); return s; };
  const act = (text: string, nav: string, cls: string, disabled: boolean, fn: () => void) => {
    const b = el('button', 'mz-pt-act ' + cls, text); b.type = 'button'; b.dataset['act'] = nav; b.disabled = disabled || st.busy;
    b.addEventListener('click', () => { if (!b.disabled && !st.busy) fn(); });
    return b;
  };
  const noteFor = (id: string): HTMLElement | null => (st.note && st.note.id === id ? el('div', 'mz-pt-miss' + (st.note.bad ? '' : ' ok'), st.note.text) : null);
  const busyRun = async (id: string, fn: () => Promise<string>) => {
    st.busy = true; st.note = null; redraw();
    try { st.note = { id, text: await fn(), bad: false }; } catch (e) { st.note = { id, text: errText(e), bad: true }; }
    st.busy = false; redraw();
  };

  if (st.tab === 'cappelli') {
    for (const h of HATS) {
      const mine = owned(h.id), worn = ctx.me?.look.cappello === h.i;
      const row = el('div', 'mz-pt-row' + (st.prova === h.i ? ' sel' : '')); row.dataset['item'] = h.id;
      const nm = el('button', 'nm'); nm.type = 'button'; nm.dataset['act'] = 'prova'; nm.title = 'Provalo sul tuo avatar';
      nm.append(el('b', '', h.nome), el('small', h.mercante ? 'tag' : 'tag dim', h.mercante ? 'ESCLUSIVA' : mine ? 'già tuo' : 'si trova anche nell’editor'));
      nm.addEventListener('click', () => { st.prova = st.prova === h.i ? null : h.i; ctx.setLook({ ...(ctx.me?.look ?? DEFAULT), cappello: st.prova ?? (ctx.me?.look.cappello ?? 0) }); redraw(); });
      row.append(nm, price(h.perle));
      if (mine) row.appendChild(act(worn ? 'ADDOSSO' : 'INDOSSA', 'indossa', 'green', worn || !online, () => void busyRun(h.id, async () => {
        const l: Look = { ...(ctx.me?.look ?? DEFAULT), cappello: h.i };
        await ctx.api!.look(l);
        if (ctx.me) ctx.me.look = l;
        st.prova = null; ctx.setLook(l);
        return `${h.nome}: ti sta benissimo`;
      })));
      else row.appendChild(act('COMPRA', 'compra', '', !online, () => {
        if (perle !== null && perle < h.perle) { st.note = { id: h.id, text: perleText(h.perle - perle), bad: true }; redraw(); return; }
        void busyRun(h.id, async () => { const l = await ctx.api!.buyHat(h.id); ctx.setLot(l); return `${h.nome}: è tuo! Premi INDOSSA`; });
      }));
      body.appendChild(row);
      const n = noteFor(h.id); if (n) body.appendChild(n);
    }
  } else {
    for (const d of DECORS) {
      const quante = lot?.decor.filter((x) => x.decor === d.id).length ?? 0;
      const row = el('div', 'mz-pt-row'); row.dataset['item'] = d.id;
      const nm = el('div', 'nm');
      nm.append(el('b', '', d.nome), el('small', d.mercante ? 'tag' : 'tag dim', [d.mercante ? 'ESCLUSIVA' : '', quante ? `ne hai ${quante}` : ''].filter(Boolean).join(' · ') || 'per la tua isola'));
      row.append(nm, price(d.perle), act('COMPRA', 'compra', '', !online, () => {
        if (perle !== null && perle < d.perle) { st.note = { id: d.id, text: perleText(d.perle - perle), bad: true }; redraw(); return; }
        void busyRun(d.id, async () => {
          const cur = ctx.getLot(); const cell = cur ? cellaLibera(cur) : null;
          if (!cell) throw new ApiError(409, 'Sulla tua isola non c’è più posto per le decorazioni');
          const l = await ctx.api!.decor(d.id, cell, 0); ctx.setLot(l);
          return `${d.nome}: consegnata vicino a casa. Toccala sull’isola per spostarla`;
        });
      }));
      body.appendChild(row);
      const n = noteFor(d.id); if (n) body.appendChild(n);
    }
  }
  return body;
}
const DEFAULT: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
