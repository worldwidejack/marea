// Diario del capitano (#87), chunk caricato con import() alla prima apertura da game/diario.ts. Un album a pagine: Pesci (#457: disegno a pixel
// di ogni specie, quante volte, scheda dopo la consegna al mobiliere), Perle, Animali avvistati, Medaglie (la migliore per minigioco), Isole visitate (la forma vera dell'isola,
// un pixel per cella). Caselle grigie con «?» per quello che manca, contatore dei trovati su ogni linguetta. Si può sfogliare anche il diario
// di un amico (sola lettura, dal suo lotto). I traguardi coi titoli sono stati tolti (tag archivio/spenti-traguardi).
// Un pollice: linguette e caselle ≥ 44 px. Tastiera in capture solo a pannello aperto: Esc/J chiude, ←/→ linguette, ↑/↓ tra i bottoni.
import { DIARIO, ISOLE_DIARIO } from '@marea/content/diario.ts';
import { diarioOf } from '@marea/sim/economy/diario.ts';
import type { DiarioState, LotState } from '@marea/sim';
import type { DiarioCtx, DiarioTab } from '../game/diario.ts';
import { DIARIO_TABS, libroIcon } from '../game/diario.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { pixIcon } from './icons.ts';
import { pesceCanvas } from './pesci_sprite.ts';
import { PESCI, PESCI_CFG } from '@marea/content/pesci.ts';
import type { PesceDef } from '@marea/content/pesci.ts';
import { pesciOf } from '@marea/sim/economy/pesci.ts';
import { INSETTI, INSETTI_CFG } from '@marea/content/insetti.ts';
import type { InsettoDef } from '@marea/content/insetti.ts';
import { insettiOf } from '@marea/sim/economy/insetti.ts';
import { insettoCanvas } from './insetti_sprite.ts';
import { ANIMALI_ART, ISOLA, MEDAGLIA, MED_COL, PERLE_ART, ZAMPA, artCanvas, isolaCanvas, medagliaCanvas } from './diario_disegni.ts';
import { suona } from '../audio/ponte.ts';

const P = PAL;
const INS_RAR_COL: Record<InsettoDef['rarita'], string> = { comune: P.pietraChiara, noncomune: P.erba, raro: P.acquaBassa, ultrararo: P.giallo };
const INS_DOVE: Record<InsettoDef['tipo'], string> = { volante: 'vola in giro', terra: 'cammina nell’erba', sasso: 'esce dai sassi colpiti con la pala', albero: 'cade dagli alberi scossi' };
const INS_STAGIONE: Record<InsettoDef['stagione'], string> = { tutto: 'tutto l’anno', primavera: 'in primavera', estate: 'd’estate', autunno: 'd’autunno', inverno: 'd’inverno' };
const INS_FASCIA: Record<InsettoDef['fascia'], string> = { sempre: 'giorno e notte', giorno: 'di giorno', notte: 'di notte' };
/** «vola in giro d'estate, di notte». */
const doveInsetto = (i: InsettoDef): string => `${INS_DOVE[i.tipo]} ${INS_STAGIONE[i.stagione]}, ${INS_FASCIA[i.fascia]}`;
/** «si pesca dalla riva d'estate, di notte · ombra grande» (#457). */
const dovePesce = (p: PesceDef): string => `si pesca ${p.zona === 'riva' ? 'dalle rive di Borgo Marea' : 'dalla barca in mare aperto'} ${INS_STAGIONE[p.stagione]}, ${INS_FASCIA[p.fascia]} · ombra ${PESCI_CFG.taglie[p.taglia - 1]?.nome.toLowerCase() ?? ''}`;
const TAB_NOME: Record<DiarioTab, string> = { pesci: 'Pesci', insetti: 'Insetti', perle: 'Perle', animali: 'Animali', medaglie: 'Medaglie', isole: 'Isole' };

const STYLE = `
.mz-sheet.mz-dia { box-sizing: border-box; max-height: 76%; padding-top: 8px; }
@media (min-width: 700px) { .mz-sheet.mz-dia { left: auto; right: 8px; top: 60px; bottom: 8px; width: 460px; max-height: none; } }
.mz-dia .mz-head { gap: 8px; margin-bottom: 6px; }
.mz-dia .mz-title { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mz-dia .chi-t { display: flex; flex-direction: column; min-width: 0; margin-left: auto; text-align: right; font-size: 12px; font-weight: bold; color: ${P.sabbia}; line-height: 1.25; }
.mz-dia-chi { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 6px; padding-bottom: 2px; }
.mz-dia-chi button { flex: none; min-width: 56px; min-height: 40px; padding: 0 10px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-dia-chi button[aria-pressed="true"] { border-color: ${P.giallo}; color: ${P.giallo}; }
.mz-dia-tabs { display: grid; grid-template-columns: repeat(var(--n, 6), 1fr); gap: 4px; margin-bottom: 6px; }
.mz-dia-tab { position: relative; min-height: 50px; padding: 3px 0 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbia}; font: bold 11px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-dia-tab[aria-pressed="true"] { background: ${P.arancio}; color: ${P.neroCaldo}; border-color: ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
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
.mz-dia-cell.tuo { background: ${P.erbaChiara}; }
.mz-dia-cell .tuo { position: absolute; top: 2px; left: 4px; color: ${P.erbaScura}; font-size: 12px; }
.mz-dia-cell.sel { border-color: ${P.giallo}; box-shadow: 0 3px 0 ${P.giallo}; }
.mz-dia-cell:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-dia-nota { margin-top: 8px; min-height: 44px; padding: 6px 8px; background: ${P.ombraCalda}; border: 2px dashed ${P.legno}; font-size: 13px; line-height: 1.35; color: ${P.sabbia}; }
.mz-dia-nota b { color: ${P.sabbiaChiara}; }
.mz-dia-nota .k { color: ${P.giallo}; }
.mz-dia-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; min-height: 52px; padding: 3px 8px; box-sizing: border-box; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; }
.mz-dia-row .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; font-weight: bold; font-size: 14px; }
.mz-dia-row .nm small { font-size: 12px; color: ${P.sabbia}; font-weight: normal; }
.mz-dia-row .md { font-weight: bold; text-transform: uppercase; font-size: 13px; }
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

  const lot = (): LotState | null => (chi ? altrui : ctx.getLot());

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
    return {
      pesci: { fatto: PESCI.filter((p) => (l?.pesci?.visti[p.id] ?? 0) > 0).length, tot: PESCI.length },
      insetti: { fatto: INSETTI.filter((i) => (l?.insetti?.visti[i.id] ?? 0) > 0).length, tot: INSETTI.length },
      perle: { fatto: DIARIO.perle.filter((p) => (d.perle[p.id] ?? 0) > 0).length, tot: DIARIO.perle.length },
      animali: { fatto: DIARIO.animali.filter((a) => d.animali.includes(a.id)).length, tot: DIARIO.animali.length },
      medaglie: { fatto: DIARIO.minigiochi.filter((m) => d.medaglie[m.id]).length, tot: DIARIO.minigiochi.length },
      isole: { fatto: [...ISOLE_DIARIO.map((i) => i.id), ...amiciIsole].filter((id) => d.isole.includes(id)).length, tot: ISOLE_DIARIO.length + amiciIsole.length },
    };
  };

  // ---------- disegno ----------
  function head(): HTMLElement {
    const h = el('div', 'mz-head'), t = el('div', 'mz-title');
    t.append(libroIcon(), el('span', '', 'Diario'));
    const nome = chi ? ctx.owners.find((w) => w.id === chi)?.nome ?? chi : ctx.me?.nome ?? 'Ospite';
    const ct = el('div', 'chi-t'); ct.dataset['chi'] = chi ?? 'io';
    ct.append(el('span', '', chi ? `di ${nome}` : 'capitano ' + nome));
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
  function tabs(c: Record<DiarioTab, Conta>): HTMLElement {
    const r = el('div', 'mz-dia-tabs'); r.setAttribute('role', 'tablist'); r.style.setProperty('--n', String(DIARIO_TABS.length));
    const icone: Record<DiarioTab, () => HTMLElement> = {
      pesci: () => pixIcon('pesca', 20), insetti: () => insettoCanvas(INSETTI.find((i) => i.id === 'monarca') ?? INSETTI[0]!, 1.25), perle: () => pixIcon('perle', 20), animali: () => artCanvas(ZAMPA, 2.5),
      medaglie: () => artCanvas(MEDAGLIA, 2.5, { col: { m: P.giallo } }), isole: () => artCanvas(ISOLA, 2.5),
    };
    for (const t of DIARIO_TABS) {
      const b = el('button', 'mz-dia-tab'); b.type = 'button'; b.dataset['tab'] = t; b.title = TAB_NOME[t]; b.setAttribute('role', 'tab');
      b.setAttribute('aria-pressed', String(tab === t)); b.setAttribute('aria-label', `${TAB_NOME[t]} ${c[t].fatto} su ${c[t].tot}`);
      b.append(icone[t](), el('span', '', `${c[t].fatto}/${c[t].tot}`));
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
  /** Pesci (#457): come gli insetti, il disegno si sblocca pescandolo («visto»), la scheda consegnandolo al mobiliere («catturato», verde). */
  function bodyPesci(l: LotState | null): HTMLElement[] {
    const s = pesciOf(l, Date.now()), g = el('div', 'mz-dia-grid');
    for (const p of PESCI) {
      const n = s.visti[p.id] ?? 0, tuo = s.posseduti.includes(p.id);
      g.appendChild(cella(p.id, pesceCanvas(p, 3, n === 0), p.nome, n, n > 0, (c) => {
        const r = el('span', 'rar'); r.style.setProperty('--r', INS_RAR_COL[p.rarita]); c.appendChild(r);
        if (tuo) { c.classList.add('tuo'); c.appendChild(el('span', 'tuo', '✓')); }
      }));
    }
    const p = PESCI.find((x) => x.id === sel), n = p ? s.visti[p.id] ?? 0 : 0, tuo = !!p && s.posseduti.includes(p.id);
    const info = !p ? [`Ne hai visti ${PESCI.filter((x) => (s.visti[x.id] ?? 0) > 0).length}, catturati (consegnati al mobiliere) ${s.posseduti.length}. Tocca un pesce per la scheda: si pescano con la canna dalle rive di Borgo Marea e dalla barca ferma al largo.`]
      : tuo ? [b(p.nome), ' · ', k(PESCI_CFG.rarita[p.rarita]), ` · ${dovePesce(p)}. `, p.descr]
      : n > 0 ? [b(p.nome), ' · ', k(PESCI_CFG.rarita[p.rarita]), ` · pescato ${n} ${n === 1 ? 'volta' : 'volte'}, ${dovePesce(p)}. Portalo al mobiliere per leggere la sua scheda.`]
      : [b('???'), ' · ', k(PESCI_CFG.rarita[p.rarita]), ` · non ancora pescato. ${dovePesce(p)[0]!.toUpperCase()}${dovePesce(p).slice(1)}.`];
    return [g, nota(info)];
  }
  /** Insetti (#445): il disegno si sblocca prendendolo col retino («visto»), la scheda consegnandolo al mobiliere («posseduto», verde). */
  function bodyInsetti(l: LotState | null): HTMLElement[] {
    const s = insettiOf(l, Date.now()), g = el('div', 'mz-dia-grid');
    for (const i of INSETTI) {
      const n = s.visti[i.id] ?? 0, tuo = s.posseduti.includes(i.id);
      g.appendChild(cella(i.id, insettoCanvas(i, 3, n === 0), i.nome, n, n > 0, (c) => {
        const r = el('span', 'rar'); r.style.setProperty('--r', INS_RAR_COL[i.rarita]); c.appendChild(r);
        if (tuo) { c.classList.add('tuo'); c.appendChild(el('span', 'tuo', '✓')); }
      }));
    }
    const i = INSETTI.find((x) => x.id === sel), n = i ? s.visti[i.id] ?? 0 : 0, tuo = !!i && s.posseduti.includes(i.id);
    const info = !i ? [`Ne hai visti ${INSETTI.filter((x) => (s.visti[x.id] ?? 0) > 0).length}, consegnati al mobiliere ${s.posseduti.length}. Tocca un insetto per la scheda: si prendono col retino a Borgo Marea.`]
      : tuo ? [b(i.nome), ' · ', k(INSETTI_CFG.rarita[i.rarita]), ` · ${doveInsetto(i)}. `, i.descr]
      : n > 0 ? [b(i.nome), ' · ', k(INSETTI_CFG.rarita[i.rarita]), ` · preso ${n} ${n === 1 ? 'volta' : 'volte'}, ${doveInsetto(i)}. Portalo al mobiliere per leggere la sua scheda.`]
      : [b('???'), ' · ', k(INSETTI_CFG.rarita[i.rarita]), ` · non ancora preso. ${doveInsetto(i)[0]!.toUpperCase()}${doveInsetto(i).slice(1)}.`];
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
  function render(): void {
    if (!open) return;
    const active = document.activeElement as HTMLElement | null;
    const keep = active && sheet.contains(active) ? { tab: active.dataset['tab'], cella: active.dataset['cella'], chi: active.dataset['chi'] } : null;
    const l = lot(), d = l ? diarioOf(l) : diarioOf({ owner: '' } as LotState);
    const c = conti(l, d);
    sheet.dataset['tab'] = tab; sheet.dataset['chi'] = chi ?? 'io';
    const corpo = carica ? [el('div', 'mz-dia-vuoto', 'Sfoglio il diario…')]
      : tab === 'pesci' ? bodyPesci(l) : tab === 'insetti' ? bodyInsetti(l) : tab === 'perle' ? bodyPerle(d) : tab === 'animali' ? bodyAnimali(d) : tab === 'medaglie' ? bodyMedaglie(d) : bodyIsole(d);
    const parti: HTMLElement[] = [head()];
    const cr = chiRow(); if (cr) parti.push(cr);
    parti.push(tabs(c), pagina(c[tab]), ...corpo);
    sheet.replaceChildren(...parti);
    if (keep) {
      const q = keep.tab ? `[data-tab="${CSS.escape(keep.tab)}"]` : keep.cella ? `[data-cella="${CSS.escape(keep.cella)}"]` : keep.chi ? `.mz-dia-chi [data-chi="${CSS.escape(keep.chi)}"]` : null;
      (q ? sheet.querySelector<HTMLElement>(q) : null)?.focus({ preventScroll: true });
    }
  }
  function vai(t: DiarioTab): void { if (t === tab) return; tab = t; sel = null; sheet.scrollTop = 0; render(); }

  async function scegliChi(id: string | null): Promise<void> {
    if (id === chi) return;
    chi = id; altrui = null; sel = null;
    if (!id || !ctx.api) { carica = false; render(); return; }
    const g = ++gen; carica = true; render();
    try { const l = await ctx.api.lot(id); if (g === gen && chi === id) altrui = l; } catch { if (g === gen) chi = null; ctx.hud.toast('Diario non raggiungibile: riprova', 2200); }
    if (g === gen) { carica = false; render(); }
  }
  function apri(t?: DiarioTab): void {
    if (t && DIARIO_TABS.includes(t)) { tab = t; sel = null; }
    if (open) { render(); return; }
    open = true; gen++;
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
    state: () => ({ open, tab, chi, sel, carica }),
  };
}
