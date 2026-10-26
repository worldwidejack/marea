// Mercante in piazza, corpo del pannello: cappelli e vestiti del giorno (economy/mercante.ts: 4 + 4 a caso, chi esce oggi riposa 2 giorni),
// ognuno col suo disegno (assets/abiti/<modello>.png, assets/blender/anteprime_abiti.py): tocchi il disegno → lo provi addosso, COMPRA,
// poi INDOSSA (o dalla Borsa). Poi decorazioni (COMPRA → nel magazzino di casa, si posano con ARREDA) e colori esclusivi della barca
// (prova sulla tua barca, COMPRA, poi SCAFO o VELA). Tutto deciso dal server: monete, posseduti, vetrina. Chunk dei pannelli (ui/porto_ui.ts).
import { AVATAR, DECOR } from '@marea/content';
import { barcaDi, casaDi, chiaveDecor, finoAMezzanotte, ownsAbito, possiedeColore, vetrinaMercante } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { ApiError, mancaText, moneteText } from '../net/api.ts';
import { disegnoAbito, disegnoCappello } from '../game/abiti.ts';
import type { PortoCtx } from '../game/porto.ts';
import { PAL as P, el } from './style.ts';
import { resIcon } from './icons.ts';

export type Tab = 'cappelli' | 'vestiti' | 'decor' | 'barca';
export const TABS: readonly Tab[] = ['cappelli', 'vestiti', 'decor', 'barca'];
export type Note = { id: string; text: string; bad: boolean } | null;
/** `prova`: cosa si sta provando addosso («cappello:<id>» o «abito:<id>»); `provaBarca`: il colore esclusivo sullo scafo (#107). */
export type MercanteState = { tab: Tab; prova: string | null; provaBarca: string | null; note: Note; busy: boolean };

const DECORS = [...DECOR].sort((a, b) => Number(!!b.mercante) - Number(!!a.mercante) || a.monete - b.monete);
const COLORI = AVATAR.barca.colori.filter((k) => k.mercante).sort((a, b) => a.monete - b.monete);
const DEFAULT: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1, abito: 0 };

const CSS = `
.mz-mc-griglia { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.mz-mc-pz { display: flex; flex-direction: column; gap: 4px; padding: 6px; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.legnoScuro}; box-shadow: 0 3px 0 ${P.neroCaldo}; min-width: 0; }
.mz-mc-pz.sel { border-color: ${P.arancio}; box-shadow: 0 0 0 2px ${P.arancio}, 0 3px 0 ${P.neroCaldo}; }
.mz-mc-pz .fig { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; cursor: pointer; background: ${P.sabbia}; border: 2px solid ${P.legno}; border-radius: 10px; }
.mz-mc-pz .fig img { width: 100%; height: 100%; object-fit: contain; display: block; }
.mz-mc-pz .fig .prova { position: absolute; left: 4px; bottom: 4px; padding: 1px 5px; background: ${P.neroCaldo}; color: ${P.sabbiaChiara}; font-size: 10px; font-weight: bold; }
.mz-mc-pz b { font-size: 13px; line-height: 1.15; min-height: 2.3em; }
.mz-mc-pz .pr { display: inline-flex; align-items: center; gap: 4px; font-weight: bold; }
.mz-mc-pz .pr.no { color: ${P.rosso}; }
.mz-mc-pz .mz-pt-act { min-width: 0; width: 100%; }
.mz-mc-dopo { margin: 8px 2px 0; color: ${P.sabbia}; font-size: 12px; }
`;

const errText = (e: unknown): string => {
  if (e instanceof ApiError && e.manca) return (e.manca.monete ?? 0) > 0 ? moneteText(e.manca.monete ?? 0) : `${e.message}: ${mancaText(e.manca)}`;
  return e instanceof ApiError ? e.message : 'Qualcosa non va, riprova';
};

/** Il corpo del pannello. `redraw` ridisegna (dopo ogni azione). */
export function mercanteBody(ctx: PortoCtx, st: MercanteState, redraw: () => void): HTMLElement {
  if (!document.getElementById('mz-mercante-style')) { const s = document.createElement('style'); s.id = 'mz-mercante-style'; s.textContent = CSS; document.head.appendChild(s); }
  const lot = ctx.getLot(), monete = lot?.monete ?? null, online = !!ctx.api?.enabled && !!lot;
  const owned = (id: string) => (lot?.posseduti ?? []).includes(id);
  const adesso = ctx.api?.serverNow() ?? Date.now(), oggi = vetrinaMercante(adesso);
  const body = el('div'); body.dataset['panel'] = 'mercante';
  const tabs = el('div', 'mz-pt-tabs');
  for (const [id, nome] of [['cappelli', 'Cappelli'], ['vestiti', 'Vestiti'], ['decor', 'Casa'], ['barca', 'Barca']] as const) {
    const b = el('button', 'mz-pt-tab', nome); b.type = 'button'; b.dataset['tab'] = id; b.setAttribute('aria-pressed', String(st.tab === id));
    b.addEventListener('click', () => { st.tab = id; st.note = null; redraw(); });
    tabs.appendChild(b);
  }
  body.appendChild(tabs);
  if (!online) body.appendChild(el('div', 'mz-pt-miss', 'Per comprare serve il tuo link personale: chiedilo a Jack'));

  const price = (n: number) => { const s = el('span', 'pr' + (monete !== null && monete < n ? ' no' : '')); s.append(resIcon('monete', 16), String(n)); return s; };
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
  const salvato = (): Look => ({ ...DEFAULT, ...(ctx.me?.look ?? {}) });
  /** Prova, compra, indossa: lo stesso per cappelli e vestiti. */
  function pezzo(chiave: string, nome: string, prezzo: number, disegno: string, mio: boolean, addosso: boolean, conPezzo: Partial<Look>, compra: () => Promise<void>): HTMLElement {
    const card = el('div', 'mz-mc-pz' + (st.prova === chiave ? ' sel' : '')); card.dataset['item'] = chiave;
    const fig = el('button', 'fig'); fig.type = 'button'; fig.dataset['act'] = 'prova'; fig.title = 'Provalo addosso';
    const im = document.createElement('img'); im.src = disegno; im.alt = nome; fig.appendChild(im);
    fig.appendChild(el('span', 'prova', st.prova === chiave ? 'Addosso' : 'Prova'));
    fig.addEventListener('click', () => { st.prova = st.prova === chiave ? null : chiave; ctx.setLook(st.prova ? { ...salvato(), ...conPezzo } : salvato()); redraw(); });
    card.append(fig, el('b', '', nome));
    if (mio) card.appendChild(act(addosso ? 'Addosso' : 'Indossa', 'indossa', 'green', addosso || !online, () => void busyRun(chiave, async () => {
      const l: Look = { ...salvato(), ...conPezzo };
      await ctx.api!.look(l);
      if (ctx.me) ctx.me.look = { ...ctx.me.look, ...l };
      st.prova = null; ctx.setLook(l);
      return `${nome}: ti sta benissimo`;
    })));
    else {
      card.appendChild(price(prezzo));
      card.appendChild(act('Compra', 'compra', '', !online, () => {
        if (monete !== null && monete < prezzo) { st.note = { id: chiave, text: moneteText(prezzo - monete), bad: true }; redraw(); return; }
        void busyRun(chiave, async () => { await compra(); return `${nome}: è tuo! Premi «Indossa»`; });
      }));
    }
    const n = noteFor(chiave); if (n) card.appendChild(n);
    return card;
  }
  const dopo = () => { const h = Math.max(1, Math.round(finoAMezzanotte(adesso) / 3_600_000)); return el('p', 'mz-mc-dopo', `Merce nuova a mezzanotte (tra ${h} ${h === 1 ? 'ora' : 'ore'}). Quello che esce oggi non torna per due giorni.`); };

  if (st.tab === 'cappelli' || st.tab === 'vestiti') {
    const g = el('div', 'mz-mc-griglia');
    if (st.tab === 'cappelli') for (const id of oggi.cappelli) {
      const i = AVATAR.cappelli.findIndex((h) => h.id === id), h = AVATAR.cappelli[i]!;
      g.appendChild(pezzo(`cappello:${id}`, h.nome, h.monete, disegnoCappello(id), owned(id), ctx.me?.look.cappello === i, { cappello: i },
        async () => { ctx.setLot(await ctx.api!.buyHat(id)); }));
    }
    else for (const id of oggi.abiti) {
      const i = AVATAR.abiti.findIndex((a) => a.id === id), a = AVATAR.abiti[i]!;
      g.appendChild(pezzo(`abito:${id}`, a.nome, a.monete, disegnoAbito(id), ownsAbito(lot, id), (ctx.me?.look.abito ?? 0) === i, { abito: i },
        async () => { ctx.setLot(await ctx.api!.buyAbito(id)); }));
    }
    body.append(g, dopo());
  } else if (st.tab === 'barca') {
    const mia = barcaDi(ctx.me?.look);
    const usa = (k: (typeof COLORI)[number], dove: 'scafo' | 'vela') => void busyRun(k.id, async () => {
      const b = await ctx.api!.barca({ ...mia, [dove]: k.id });
      if (ctx.me) ctx.me.look = { ...ctx.me.look, barca: b };
      st.provaBarca = null; ctx.world.setBarca(b);
      return `${k.nome}: ${dove === 'scafo' ? 'scafo ridipinto' : 'vela nuova'}`;
    });
    for (const k of COLORI) {
      const mine = possiedeColore(lot, k.id);
      const row = el('div', 'mz-pt-row' + (st.provaBarca === k.id ? ' sel' : '')); row.dataset['item'] = k.id;
      const nm = el('button', 'nm'); nm.type = 'button'; nm.dataset['act'] = 'prova'; nm.title = 'Provalo sulla tua barca';
      const chip = el('span', 'mz-pt-chip'); chip.style.background = k.hex;
      const b = el('b'); b.append(chip, k.nome);
      nm.append(b, el('small', mine ? 'tag dim' : 'tag', mine ? 'tuo: per scafo e vela' : 'Esclusiva · scafo o vela'));
      nm.addEventListener('click', () => { st.provaBarca = st.provaBarca === k.id ? null : k.id; ctx.world.setBarca(st.provaBarca ? { ...mia, scafo: k.id } : mia); redraw(); });
      row.appendChild(nm);
      if (mine) {
        row.append(act('Scafo', 'scafo', 'green mini', !online || mia.scafo === k.id, () => usa(k, 'scafo')), act('Vela', 'vela', 'green mini', !online || mia.vela === k.id, () => usa(k, 'vela')));
      } else {
        row.append(price(k.monete), act('Compra', 'compra', '', !online, () => {
          if (monete !== null && monete < k.monete) { st.note = { id: k.id, text: moneteText(k.monete - monete), bad: true }; redraw(); return; }
          void busyRun(k.id, async () => { const l = await ctx.api!.buyColore(k.id); ctx.setLot(l); return `${k.nome}: è tuo! Premi «Scafo» o «Vela»`; });
        }));
      }
      body.appendChild(row);
      const n = noteFor(k.id); if (n) body.appendChild(n);
    }
  } else {
    for (const d of DECORS) {
      const k = chiaveDecor(d.id), casa = casaDi(lot), quante = (casa.magazzino?.[k] ?? 0) + (casa.arredi ?? []).filter((x) => x.mobile === k).length;
      const row = el('div', 'mz-pt-row'); row.dataset['item'] = d.id;
      const nm = el('div', 'nm');
      nm.append(el('b', '', d.nome), el('small', d.mercante ? 'tag' : 'tag dim', [d.mercante ? 'Esclusiva' : '', quante ? `ne hai ${quante}` : ''].filter(Boolean).join(' · ') || 'per la tua casa'));
      row.append(nm, price(d.monete), act('Compra', 'compra', '', !online, () => {
        if (monete !== null && monete < d.monete) { st.note = { id: d.id, text: moneteText(d.monete - monete), bad: true }; redraw(); return; }
        void busyRun(d.id, async () => {
          const l = await ctx.api!.decor(d.id); ctx.setLot(l);
          return `${d.nome}: è nel magazzino di casa. Posala con «Arreda»`;
        });
      }));
      body.appendChild(row);
      const n = noteFor(d.id); if (n) body.appendChild(n);
    }
  }
  return body;
}
