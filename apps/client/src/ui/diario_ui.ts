// Diario del capitano (#87), chunk caricato con import() alla prima apertura da game/diario.ts. Un album a pagine: Pesci (sagoma a pixel
// di ogni specie, quante volte), Perle, Animali avvistati, Medaglie (la migliore per minigioco), Isole visitate (la forma vera dell'isola,
// un pixel per cella), Traguardi (progresso, RISCUOTI sul server, titolo sotto il nome). Caselle grigie con «?» per quello che manca,
// contatore «3/12» su ogni linguetta. Si può sfogliare anche il diario di un amico (sola lettura, dal suo lotto).
// Un pollice: linguette e caselle ≥ 44 px. Tastiera in capture solo a pannello aperto: Esc/J chiude, ←/→ linguette, ↑/↓ tra i bottoni.
import { MINIGAMES_CFG } from '@marea/content';
import type { PescaPesce, PescaRarita } from '@marea/content';
import { DIARIO, ISOLE_DIARIO, TRAGUARDI } from '@marea/content/diario.ts';
import { diarioOf, titoloDi, traguardiOf } from '@marea/sim/economy/diario.ts';
import type { TraguardoStato } from '@marea/sim/economy/diario.ts';
import type { DiarioState, LotState, Resources } from '@marea/sim';
import { ApiError } from '../net/api.ts';
import type { DiarioCtx, DiarioTab } from '../game/diario.ts';
import { DIARIO_TABS, libroIcon } from '../game/diario.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { pixIcon, resIcon } from './icons.ts';
import { flyResources } from './sheet.ts';
import { pesceCanvas } from './pesci_sprite.ts';
import { ANIMALI_ART, ISOLA, MEDAGLIA, MED_COL, PERLE_ART, STELLA, ZAMPA, artCanvas, isolaCanvas, medagliaCanvas } from './diario_disegni.ts';
import { suona } from '../audio/ponte.ts';

const P = PAL;
const CFG = MINIGAMES_CFG.pesca;
const PESCI: readonly PescaPesce[] = CFG.pesci;
const RAR_COL: Record<PescaRarita, string> = { comune: P.pietraChiara, noncomune: P.erba, raro: P.acquaBassa, leggendario: P.giallo };
const TAB_NOME: Record<DiarioTab, string> = { pesci: 'Pesci', perle: 'Perle', animali: 'Animali', medaglie: 'Medaglie', isole: 'Isole', traguardi: 'Traguardi' };

const STYLE = `
.mz-sheet.mz-dia { box-sizing: border-box; max-height: 76%; padding-top: 8px; }
@media (min-width: 700px) { .mz-sheet.mz-dia { left: auto; right: 8px; top: 60px; bottom: 8px; width: 460px; max-height: none; } }
.mz-dia .mz-head { gap: 8px; margin-bottom: 6px; }
.mz-dia .mz-title { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mz-dia .chi-t { display: flex; flex-direction: column; min-width: 0; margin-left: auto; text-align: right; font-size: 12px; font-weight: bold; color: ${P.sabbia}; line-height: 1.25; }
.mz-dia .chi-t b { color: ${P.giallo}; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mz-dia-chi { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 6px; padding-bottom: 2px; }
.mz-dia-chi button { flex: none; min-width: 56px; min-height: 40px; padding: 0 10px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-dia-chi button[aria-pressed="true"] { border-color: ${P.giallo}; color: ${P.giallo}; }
.mz-dia-tabs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-bottom: 6px; }
.mz-dia-tab { position: relative; min-height: 50px; padding: 3px 0 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbia}; font: bold 11px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-dia-tab[aria-pressed="true"] { background: ${P.arancio}; color: ${P.neroCaldo}; border-color: ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-dia-tab i { position: absolute; top: -7px; right: -5px; min-width: 16px; height: 16px; padding: 0 3px; background: ${P.rosso}; color: ${P.sabbiaChiara}; border: 2px solid ${P.neroCaldo}; font: bold 10px/16px ui-monospace, Menlo, monospace; font-style: normal; }
.mz-dia-pg { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 2px 0 6px; padding-bottom: 2px; border-bottom: 2px solid ${P.legno}; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; color: ${P.sabbia}; }
.mz-dia-pg b { color: ${P.giallo}; font-size: 15px; letter-spacing: 0; }
.mz-dia-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
.mz-dia-cell { position: relative; min-height: 92px; padding: 4px 2px 3px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 2px; background: ${P.sabbiaChiara}; border: 2px solid ${P.legnoScuro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.neroCaldo}; font: bold 11px ui-monospace, Menlo, monospace; line-height: 1.15; text-align: center; cursor: pointer; }
.mz-dia-cell .img { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 40px; }
.mz-dia-cell .img canvas { image-rendering: pixelated; }
.mz-dia-cell .nm { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.mz-dia-cell .n { position: absolute; top: 2px; right: 3px; color: ${P.legno}; font-size: 11px; }
.mz-dia-cell .rar { position: absolute; left: 0; right: 0; bottom: -2px; height: 4px; background: var(--r, transparent); }
.mz-dia-cell.no { background: ${P.pietra}; border-color: ${P.pietraScura}; color: ${P.roccia}; }
.mz-dia-cell.no .q { position: absolute; left: 0; right: 0; top: 18px; text-align: center; font-size: 26px; color: ${P.sabbiaChiara}; text-shadow: 0 2px 0 ${P.roccia}; pointer-events: none; }
.mz-dia-cell.sel { border-color: ${P.giallo}; box-shadow: 0 3px 0 ${P.giallo}; }
.mz-dia-cell:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-dia-nota { margin-top: 8px; min-height: 44px; padding: 6px 8px; background: ${P.ombraCalda}; border: 2px dashed ${P.legno}; font-size: 13px; line-height: 1.35; color: ${P.sabbia}; }
.mz-dia-nota b { color: ${P.sabbiaChiara}; }
.mz-dia-nota .k { color: ${P.giallo}; }
.mz-dia-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; min-height: 52px; padding: 3px 8px; box-sizing: border-box; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; }
.mz-dia-row .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; font-weight: bold; font-size: 14px; }
.mz-dia-row .nm small { font-size: 12px; color: ${P.sabbia}; font-weight: normal; }
.mz-dia-row .md { font-weight: bold; text-transform: uppercase; font-size: 13px; }
.mz-dia-card { margin-top: 8px; padding: 7px 9px; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.legnoScuro}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-dia-card.fatto { background: ${P.erbaChiara}; }
.mz-dia-card.riscosso { background: ${P.pietraChiara}; }
.mz-dia-card .hd { display: flex; align-items: center; gap: 6px; }
.mz-dia-card .hd b { flex: 1; min-width: 0; font-size: 14px; }
.mz-dia-card .tx { font-size: 13px; line-height: 1.3; margin-top: 2px; }
.mz-dia-card .tl { font-size: 12px; font-weight: bold; color: ${P.legno}; }
.mz-dia-card .tl.uso { color: ${P.rosso}; }
.mz-dia-bar { position: relative; height: 10px; margin: 6px 0 4px; background: ${P.pietra}; border: 2px solid ${P.neroCaldo}; }
.mz-dia-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: ${P.erbaScura}; }
.mz-dia-card .ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mz-dia-card .pz { display: inline-flex; align-items: center; gap: 4px; font-weight: bold; font-size: 14px; }
.mz-dia-card .cnt { font-size: 12px; color: ${P.roccia}; font-weight: bold; }
.mz-dia-act { flex: none; min-width: 104px; min-height: 44px; padding: 0 8px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-dia-act.green { background: ${P.erba}; }
.mz-dia-act.ghost { background: ${P.legnoScuro}; color: ${P.sabbiaChiara}; border-color: ${P.legnoChiaro}; }
.mz-dia-act:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-dia-act:disabled { background: ${P.roccia}; color: ${P.pietra}; border-color: ${P.pietraScura}; cursor: default; }
.mz-dia-miss { margin: 4px 2px 0; color: ${P.rosso}; font-size: 13px; font-weight: bold; }
.mz-dia-miss.ok { color: ${P.erbaScura}; }
.mz-dia-vuoto { margin-top: 8px; color: ${P.sabbia}; font-size: 13px; }
`;

export function createDiarioUi(ctx: DiarioCtx) {
  injectUiStyle();
  if (!document.getElementById('mz-diarioui-style')) { const st = document.createElement('style'); st.id = 'mz-diarioui-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const sheet = el('div', 'mz mz-sheet mz-dia'); sheet.id = 'mzDiario'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Diario del capitano');
  for (const ev of ['pointerdown', 'touchstart']) sheet.addEventListener(ev, (x) => x.stopPropagation());
  ctx.root.appendChild(sheet);
  const meId = ctx.me?.id ?? null;
  let open = false, tab: DiarioTab = 'pesci', gen = 0, sel: string | null = null;
  /** Di chi è il diario aperto (null = mio) e il suo lotto (gli altri: letto dal server, sola lettura). */
  let chi: string | null = null, altrui: LotState | null = null, carica = false;
  const note = { busy: false, testo: null as { id: string; text: string; bad: boolean } | null, riscossi: 0 };

  const lot = (): LotState | null => (chi ? altrui : ctx.getLot());
  const amiciDi = (id: string | null) => ctx.owners.filter((w) => w.id !== (id ?? meId)).length;
  const mio = () => chi === null && !!ctx.api?.enabled && !!meId;

  // ---------- tastiera ----------
  const items = (): HTMLElement[] => [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  const onKey = (e: KeyboardEvent): void => {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation(); // WASD, frecce, C/F/M/I non arrivano al gioco
    if (e.code === 'Escape' || e.code === 'KeyJ') { e.preventDefault(); if (!e.repeat) close(); return; }
    const list = items(), a = document.activeElement as HTMLElement | null, i = a ? list.indexOf(a) : -1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const k = DIARIO_TABS.indexOf(tab), d = e.key === 'ArrowRight' ? 1 : -1;
      vai(DIARIO_TABS[(k + d + DIARIO_TABS.length) % DIARIO_TABS.length]!);
      sheet.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus({ preventScroll: true });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      list[i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + d))]?.focus();
    }
  };
  const keys = (on: boolean) => { if (on) addEventListener('keydown', onKey, true); else removeEventListener('keydown', onKey, true); };

  // ---------- conteggi delle linguette ----------
  type Conta = { fatto: number; tot: number };
  const conti = (l: LotState | null, d: DiarioState): Record<DiarioTab, Conta> => {
    const amiciIsole = ctx.owners.filter((w) => w.id !== (chi ?? meId)).map((w) => `lotto:${w.id}`);
    const tr = l ? traguardiOf(l, { amici: amiciDi(chi) }) : [];
    return {
      pesci: { fatto: PESCI.filter((p) => (d.pesci[p.id] ?? 0) > 0).length, tot: PESCI.length },
      perle: { fatto: DIARIO.perle.filter((p) => (d.perle[p.id] ?? 0) > 0).length, tot: DIARIO.perle.length },
      animali: { fatto: DIARIO.animali.filter((a) => d.animali.includes(a.id)).length, tot: DIARIO.animali.length },
      medaglie: { fatto: DIARIO.minigiochi.filter((m) => d.medaglie[m.id]).length, tot: DIARIO.minigiochi.length },
      isole: { fatto: [...ISOLE_DIARIO.map((i) => i.id), ...amiciIsole].filter((id) => d.isole.includes(id)).length, tot: ISOLE_DIARIO.length + amiciIsole.length },
      traguardi: { fatto: tr.filter((t) => t.riscosso).length, tot: tr.length },
    };
  };

  // ---------- disegno ----------
  function head(d: DiarioState): HTMLElement {
    const h = el('div', 'mz-head'), t = el('div', 'mz-title');
    t.append(libroIcon(), el('span', '', 'Diario'));
    const nome = chi ? ctx.owners.find((w) => w.id === chi)?.nome ?? chi : ctx.me?.nome ?? 'Ospite';
    const ct = el('div', 'chi-t'); ct.dataset['chi'] = chi ?? 'io';
    ct.append(el('span', '', chi ? `di ${nome}` : 'capitano ' + nome));
    const tit = titoloDi(d.titolo);
    ct.appendChild(el('b', '', tit ? `«${tit}»` : 'senza titolo'));
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc, J)'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi';
    x.addEventListener('click', () => close());
    h.append(t, ct, x);
    return h;
  }
  function chiRow(): HTMLElement | null {
    const altri = ctx.owners.filter((w) => w.id !== meId);
    if (!altri.length || !ctx.api?.enabled) return null;
    const r = el('div', 'mz-dia-chi');
    const b = (id: string | null, nome: string) => {
      const x = el('button', '', nome); x.type = 'button'; x.dataset['chi'] = id ?? 'io'; x.setAttribute('aria-pressed', String(chi === id));
      x.addEventListener('click', () => void scegliChi(id));
      r.appendChild(x);
    };
    if (meId) b(null, 'Tu');
    for (const w of altri) b(w.id, w.nome);
    return r;
  }
  function tabs(c: Record<DiarioTab, Conta>, pronti: number): HTMLElement {
    const r = el('div', 'mz-dia-tabs'); r.setAttribute('role', 'tablist');
    const icone: Record<DiarioTab, () => HTMLElement> = {
      pesci: () => pixIcon('pesca', 20), perle: () => pixIcon('perle', 20), animali: () => artCanvas(ZAMPA, 2.5),
      medaglie: () => artCanvas(MEDAGLIA, 2.5, { col: { m: P.giallo } }), isole: () => artCanvas(ISOLA, 2.5), traguardi: () => artCanvas(STELLA, 2.5),
    };
    for (const t of DIARIO_TABS) {
      const b = el('button', 'mz-dia-tab'); b.type = 'button'; b.dataset['tab'] = t; b.title = TAB_NOME[t]; b.setAttribute('role', 'tab');
      b.setAttribute('aria-pressed', String(tab === t)); b.setAttribute('aria-label', `${TAB_NOME[t]} ${c[t].fatto} su ${c[t].tot}`);
      b.append(icone[t](), el('span', '', `${c[t].fatto}/${c[t].tot}`));
      if (t === 'traguardi' && pronti > 0 && mio()) b.appendChild(el('i', '', String(pronti)));
      b.addEventListener('click', () => vai(t));
      r.appendChild(b);
    }
    return r;
  }
  function pagina(c: Conta): HTMLElement {
    const h = el('div', 'mz-dia-pg'); h.append(el('span', '', TAB_NOME[tab]), el('b', '', `${c.fatto}/${c.tot}`));
    return h;
  }
  /** Una casella dell'album: immagine, nome, quante; grigia con «?» se manca. */
  function cella(id: string, img: HTMLElement, nome: string, n: number | null, trovato: boolean, extra?: (c: HTMLElement) => void): HTMLElement {
    const c = el('button', 'mz-dia-cell' + (trovato ? '' : ' no') + (sel === id ? ' sel' : '')); c.type = 'button'; c.dataset['cella'] = id;
    c.setAttribute('aria-label', trovato ? nome : 'Non ancora trovato');
    const im = el('div', 'img'); im.appendChild(img);
    c.append(im, el('span', 'nm', trovato ? nome : '???'));
    if (trovato && n !== null && n > 0) c.appendChild(el('span', 'n', `×${n}`));
    if (!trovato) c.appendChild(el('span', 'q', '?'));
    extra?.(c);
    c.addEventListener('click', () => { sel = sel === id ? null : id; render(); });
    return c;
  }
  function nota(righe: (string | Node)[]): HTMLElement {
    const n = el('div', 'mz-dia-nota'); n.dataset['nota'] = sel ?? '';
    n.append(...righe);
    return n;
  }
  const b = (t: string) => el('b', '', t), k = (t: string) => el('span', 'k', t);
  const mariDi = (id: string) => Object.values(CFG.mari).filter((m) => m.pesci.includes(id)).map((m) => m.nome).join(', ');

  function bodyPesci(d: DiarioState): HTMLElement[] {
    const g = el('div', 'mz-dia-grid');
    for (const p of PESCI) {
      const n = d.pesci[p.id] ?? 0;
      g.appendChild(cella(p.id, pesceCanvas(p, 3, n === 0), p.nome, n, n > 0, (c) => { const r = el('span', 'rar'); r.style.setProperty('--r', RAR_COL[p.rarita]); c.appendChild(r); }));
    }
    const p = PESCI.find((x) => x.id === sel), n = p ? d.pesci[p.id] ?? 0 : 0;
    const info = p
      ? (n > 0 ? [b(p.nome), ' · ', k(CFG.rarita[p.rarita].nome), ` · pescato ${n} ${n === 1 ? 'volta' : 'volte'}. `, p.battuta] : [b('???'), ' · ', k(CFG.rarita[p.rarita].nome), ` · non ancora pescato. Vive in: ${mariDi(p.id) || 'mari lontani'}.`])
      : ['Tocca un pesce per leggere la sua scheda. Si pesca dalla barca ferma in acqua profonda (P).'];
    return [g, nota(info)];
  }
  function bodyPerle(d: DiarioState): HTMLElement[] {
    const g = el('div', 'mz-dia-grid');
    for (const p of DIARIO.perle) { const n = d.perle[p.id] ?? 0; g.appendChild(cella(p.id, artCanvas(PERLE_ART[p.id] ?? PERLE_ART['bianca']!, 5, { ombra: n === 0 }), p.nome, n, n > 0)); }
    const p = DIARIO.perle.find((x) => x.id === sel), n = p ? d.perle[p.id] ?? 0 : 0;
    const tot = Object.values(d.perle).reduce((a, x) => a + x, 0);
    return [g, nota(p ? (n > 0 ? [b(p.nome), ` · trovate ${n}. `, p.battuta] : [b('???'), ' · non ancora trovata. Tuffati dalla barca ferma su acqua bassa (T).']) : [`In tutto ${tot} tra perle e conchiglie. Tocca una casella per la scheda.`])];
  }
  function bodyAnimali(d: DiarioState): HTMLElement[] {
    const g = el('div', 'mz-dia-grid');
    for (const a of DIARIO.animali) { const ok = d.animali.includes(a.id); g.appendChild(cella(a.id, artCanvas(ANIMALI_ART[a.id] ?? ANIMALI_ART['gabbiano']!, 4, { ombra: !ok }), a.nome, null, ok)); }
    const a = DIARIO.animali.find((x) => x.id === sel), ok = !!a && d.animali.includes(a.id);
    return [g, nota(a ? (ok ? [b(a.nome), ' · avvistato. ', a.battuta] : [b('???'), ` · non ancora avvistato. Cercalo ${a.dove}.`]) : ['Gli animali si segnano da soli quando ci passi vicino.'])];
  }
  function bodyMedaglie(d: DiarioState): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const m of DIARIO.minigiochi) {
      const med = d.medaglie[m.id] ?? null, n = d.giocati[m.id] ?? 0;
      const r = el('div', 'mz-dia-row'); r.dataset['minigioco'] = m.id;
      const nm = el('div', 'nm'); nm.append(el('span', '', m.nome), el('small', '', n ? `${n} ${n === 1 ? 'partita' : 'partite'}` : 'mai giocato'));
      const md = el('span', 'md', med ?? '—'); md.style.color = med ? MED_COL[med] : P.pietra;
      r.append(medagliaCanvas(med, 4), nm, md);
      out.push(r);
    }
    out.push(nota(['La medaglia migliore per ogni minigioco: la registra il server quando rigioca la tua partita.']));
    return out;
  }
  function bodyIsole(d: DiarioState): HTMLElement[] {
    const g = el('div', 'mz-dia-grid');
    const voci = [...ISOLE_DIARIO.map((i) => ({ id: i.id, nome: i.nome })), ...ctx.owners.filter((w) => w.id !== (chi ?? meId)).map((w) => ({ id: `lotto:${w.id}`, nome: `Isola di ${w.nome}` }))];
    for (const v of voci) { const ok = d.isole.includes(v.id); g.appendChild(cella(v.id, isolaCanvas(ctx, v.id, ok), v.nome, null, ok)); }
    const v = voci.find((x) => x.id === sel), ok = !!v && d.isole.includes(v.id);
    return [g, nota(v ? (ok ? [b(v.nome), ' · visitata.'] : [b('???'), ' · non ancora visitata: vacci in barca.']) : ['Un\'isola si segna quando ci arrivi (in barca basta entrare nelle sue acque).'])];
  }
  function bodyTraguardi(l: LotState | null, d: DiarioState): HTMLElement[] {
    if (!l) return [el('div', 'mz-dia-vuoto', 'I traguardi sono per chi ha il link personale: chiedilo a Jack')];
    const ordine = (t: TraguardoStato) => (t.compiuto && !t.riscosso ? 0 : !t.riscosso ? 1 - t.fatto / t.n : 2);
    const list = traguardiOf(l, { amici: amiciDi(chi) }).sort((a, z) => ordine(a) - ordine(z));
    const out: HTMLElement[] = [];
    for (const t of list) {
      const c = el('div', 'mz-dia-card' + (t.riscosso ? ' riscosso' : t.compiuto ? ' fatto' : '')); c.dataset['traguardo'] = t.id;
      const hd = el('div', 'hd'); hd.append(artCanvas(STELLA, 2, t.compiuto ? {} : { ombra: true }), el('b', '', t.nome));
      const pz = el('span', 'pz'); pz.append(resIcon('perle', 16), `+${t.perle}`); hd.appendChild(pz);
      const bar = el('div', 'mz-dia-bar'), fill = el('i'); fill.style.width = `${Math.round((100 * t.fatto) / t.n)}%`; bar.appendChild(fill);
      const uso = d.titolo === t.id;
      const tl = el('div', 'tl' + (uso ? ' uso' : ''), uso ? `Titolo «${t.titolo}» · in uso` : `Titolo: «${t.titolo}»`);
      const ft = el('div', 'ft'); ft.appendChild(el('span', 'cnt', t.riscosso ? 'Riscosso' : `${t.fatto} / ${t.n}`));
      if (mio()) {
        let btn: HTMLButtonElement;
        if (!t.riscosso) {
          btn = el('button', 'mz-dia-act' + (t.compiuto ? ' green' : ''), t.compiuto ? 'RISCUOTI' : 'IN CORSO'); btn.dataset['act'] = 'riscuoti';
          btn.disabled = !t.compiuto || note.busy;
          btn.addEventListener('click', () => void riscuoti(t.id, btn));
        } else {
          btn = el('button', 'mz-dia-act' + (uso ? ' ghost' : ''), uso ? 'TOGLI' : 'USA TITOLO'); btn.dataset['act'] = 'titolo';
          btn.disabled = note.busy;
          btn.addEventListener('click', () => void titolo(uso ? null : t.id));
        }
        btn.type = 'button'; ft.appendChild(btn);
      }
      c.append(hd, el('div', 'tx', t.testo), bar, tl, ft);
      if (note.testo?.id === t.id) c.appendChild(el('div', 'mz-dia-miss' + (note.testo.bad ? '' : ' ok'), note.testo.text));
      out.push(c);
    }
    return out;
  }

  function render(): void {
    if (!open) return;
    const active = document.activeElement as HTMLElement | null;
    const keep = active && sheet.contains(active) ? { tab: active.dataset['tab'], cella: active.dataset['cella'], chi: active.dataset['chi'], tr: active.closest<HTMLElement>('[data-traguardo]')?.dataset['traguardo'], act: active.dataset['act'] } : null;
    const l = lot(), d = l ? diarioOf(l) : diarioOf({ owner: '' } as LotState);
    const c = conti(l, d), pronti = l && mio() ? traguardiOf(l, { amici: amiciDi(null) }).filter((t) => t.compiuto && !t.riscosso).length : 0;
    sheet.dataset['tab'] = tab; sheet.dataset['chi'] = chi ?? 'io';
    const corpo = carica ? [el('div', 'mz-dia-vuoto', 'Sfoglio il diario…')]
      : tab === 'pesci' ? bodyPesci(d) : tab === 'perle' ? bodyPerle(d) : tab === 'animali' ? bodyAnimali(d) : tab === 'medaglie' ? bodyMedaglie(d) : tab === 'isole' ? bodyIsole(d) : bodyTraguardi(l, d);
    const parti: HTMLElement[] = [head(d)];
    const cr = chiRow(); if (cr) parti.push(cr);
    parti.push(tabs(c, pronti), pagina(c[tab]), ...corpo);
    sheet.replaceChildren(...parti);
    if (keep) {
      const q = keep.tab ? `[data-tab="${CSS.escape(keep.tab)}"]` : keep.cella ? `[data-cella="${CSS.escape(keep.cella)}"]` : keep.chi ? `.mz-dia-chi [data-chi="${CSS.escape(keep.chi)}"]`
        : keep.tr ? `[data-traguardo="${CSS.escape(keep.tr)}"] [data-act]:not(:disabled)` : null;
      (q ? sheet.querySelector<HTMLElement>(q) : null)?.focus({ preventScroll: true });
    }
  }
  function vai(t: DiarioTab): void { if (t === tab) return; tab = t; sel = null; note.testo = null; sheet.scrollTop = 0; render(); }

  async function scegliChi(id: string | null): Promise<void> {
    if (id === chi) return;
    chi = id; altrui = null; sel = null; note.testo = null;
    if (!id || !ctx.api) { carica = false; render(); return; }
    const g = ++gen; carica = true; render();
    try { const l = await ctx.api.lot(id); if (g === gen && chi === id) altrui = l; } catch { if (g === gen) chi = null; ctx.hud.toast('Diario non raggiungibile: riprova', 2200); }
    if (g === gen) { carica = false; render(); }
  }
  async function riscuoti(id: string, btn: HTMLElement): Promise<void> {
    if (note.busy || !ctx.api) return;
    const g = gen; note.busy = true; note.testo = null; render();
    try {
      const r = await ctx.api.diarioRiscuoti(id);
      ctx.setLot(r.lot); note.riscossi++;
      if (g === gen) note.testo = { id, text: 'Premio riscosso! Ora il titolo è tuo', bad: false };
      fly(btn, r.premio); suona('medaglia_oro');
    } catch (e) { if (g === gen) note.testo = { id, text: e instanceof ApiError ? e.message : 'Qualcosa non va, riprova', bad: true }; }
    note.busy = false;
    if (g === gen) render();
  }
  async function titolo(id: string | null): Promise<void> {
    if (note.busy || !ctx.api) return;
    const g = gen, cur = diarioOf(ctx.getLot() ?? ({ owner: '' } as LotState)).titolo;
    note.busy = true; note.testo = null; render();
    try {
      const l = await ctx.api.diarioTitolo(id);
      ctx.setLot(l);
      const tid = id ?? cur ?? '';
      if (g === gen) note.testo = { id: tid, text: id ? `Ora sotto il tuo nome c'è «${titoloDi(id) ?? ''}»` : 'Titolo tolto', bad: false };
    } catch (e) { if (g === gen) note.testo = { id: id ?? cur ?? '', text: e instanceof ApiError ? e.message : 'Qualcosa non va, riprova', bad: true }; }
    note.busy = false;
    if (g === gen) render();
  }
  function fly(from: HTMLElement, premio: Resources): void {
    const r = from.getBoundingClientRect(), rr = ctx.root.getBoundingClientRect(), p = { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 };
    if (premio.perle > 0) flyResources(ctx.root, p, ctx.hud.resAnchor?.('perle') ?? null, 'perle', premio.perle, () => ctx.hud.bump?.('perle'));
  }

  function apri(t?: DiarioTab): void {
    if (t) { tab = t; sel = null; }
    if (open) { render(); return; }
    open = true; gen++; note.testo = null; note.busy = false;
    if (!meId) chi = null;
    sheet.classList.add('on'); keys(true); render();
    sheet.scrollTop = 0;
    sheet.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus({ preventScroll: true });
    suona('apri');
    // il diario fresco dal server (le partite e i premi di altrove contano)
    const g = gen;
    if (ctx.api?.enabled && chi === null) ctx.api.lot().then((l) => { ctx.setLot(l); if (g === gen && chi === null) render(); }, () => { /* resta quello noto */ });
  }
  function close(): void {
    if (!open) return;
    open = false; gen++; keys(false); carica = false;
    const a = document.activeElement as HTMLElement | null;
    if (a && sheet.contains(a)) a.blur();
    sheet.classList.remove('on'); sheet.replaceChildren();
    suona('chiudi');
    ctx.onClose();
  }

  return {
    open: apri, close, isOpen: () => open,
    state: () => ({ open, tab, chi, sel, busy: note.busy, nota: note.testo?.text ?? null, riscossi: note.riscossi, carica, traguardi: TRAGUARDI.length }),
  };
}
