// Il pannello delle botteghe del Borgo (#414): Fabbro, Alchimista, Cantiere navale. Copia fedele della proposta «V1 tondo» scelta da Jack
// (`assets/concept/botteghe/pannello3_V1_tondo.png`, 19 ott 2026: stile da gioco di ruolo ma meno serio): carta coi bordi d'oro e gli
// angoli tondi, titolo grassoccio, ritratto del bottegaio con la sua battuta, tre schede (gialla quella aperta), righe con l'icona nel
// riquadro del colore della rarità, prezzo con la moneta e il bottone «Compra» d'oro, in fondo quando cambia la merce. Tinta «notte» (Jack l'ha
// scelta fra notte, mare e crema) e un carattere per bottega (sotto, CARATTERE).
// Schede: Oggi (vetrina del giorno + la roba di sempre) per tutte; Forgia e Livello dal Fabbro; Pozioni dall'Alchimista; Barca al Cantiere.
// Merce: POST /api/rpg (`vetrina`, `compra`, `forgia`, `alchimia`), vernici POST /api/barca/colore, livelli POST /api/lot/bottega/migliora.
// Chunk scaricato alla prima apertura (game/botteghe.ts).
import { AVATAR } from '@marea/content';
import { BOTTEGHE } from '@marea/content/botteghe.ts';
import type { BottegaId } from '@marea/content/botteghe.ts';
import { MATERIALS, RECIPES } from '@marea/content/rpg.ts';
import type { LotState } from '@marea/sim';
import { prezzoInMonete } from '@marea/sim';
import { finoAMezzanotte } from '@marea/sim/economy/giorno.ts';
import { livelloBottega, prossimoLivello, vetrinaBottega } from '@marea/sim/economy/botteghe.ts';
import { possiedeColore } from '@marea/sim/economy/barca.ts';
import { prezzoVetrina, sempreInVendita, vetrinaOggetti } from '@marea/sim/rpg/botteghe.ts';
import { available } from '@marea/sim/rpg/bag.ts';
import { modsOf } from '@marea/sim/rpg/derived.ts';
import { heroOf } from '@marea/sim/rpg/hero.ts';
import { ITEMS, hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ItemDef, RpgAction } from '@marea/sim/rpg/types.ts';
import { iconOf } from './items_ui.ts';
import { ApiError } from '../net/api.ts';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el } from '../ui/style.ts';
import { canvasInsegna } from '../render/botteghe_forme.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type BottegaUi = { apri(id: BottegaId): void; isOpen(): boolean; close(): void; readonly kind: BottegaId | null; state(): unknown };
export type BottegaUiOpts = { api: Api | null; me: Me | null; hud: Hud; root: HTMLElement; getLot(): LotState | null; setLot(l: LotState): void; onClose(): void };

type Tab = 'oggi' | 'forgia' | 'livello' | 'pozioni' | 'barca';
const TABS: Record<BottegaId, { id: Tab; nome: string }[]> = {
  fabbro: [{ id: 'oggi', nome: 'Oggi' }, { id: 'forgia', nome: 'Forgia' }, { id: 'livello', nome: 'Livello' }],
  alchimista: [{ id: 'oggi', nome: 'Oggi' }, { id: 'pozioni', nome: 'Pozioni' }],
  cantiere: [{ id: 'oggi', nome: 'Oggi' }, { id: 'barca', nome: 'Barca' }],
};
/** La tinta «notte»: fondo, righe, schede, testo, contorno del testo, nuvoletta, piede (variabili CSS --bt-*). */
const TINTA: Record<string, string> = { bg: '#1A3A73', riga: '#15305F', rigaB: '#26508F', tab: '#1E4F9E', tabT: '#FFFFFF', t: '#FFFFFF', t2: '#BFD8FF', ct: '#0E1E40', bolla: '#15305F', piede: '#15305F' };
/** Un carattere per bottega (Jack, 19 ott 2026: Cinzel al Fabbro, Almendra all'Alchimista; Titan, Fredoka e Nunito mai più) per titolo, schede e
 *  bottoni (Lobster al Cantiere, dopo due giri); i testi in Alegreya Sans. File woff2 (latin, OFL, da Google Fonts) in public/assets/fonts. */
const TESTO = "'MzAlegreyaSans', 'Alegreya Sans', 'Trebuchet MS', sans-serif";
const CARATTERE: Record<BottegaId, { f: string; w: number }> = {
  fabbro: { f: "'MzCinzel', 'Cinzel', Georgia, serif", w: 900 },
  alchimista: { f: "'MzAlmendra', 'Almendra', Georgia, serif", w: 700 },
  cantiere: { f: "'MzLobster', 'Lobster', 'Brush Script MT', cursive", w: 400 },
};
const ORO = '#F6C21C', ORO_SCURO = '#D39A00', ORO_OMBRA = '#9C6F00', NOTTE = '#1B2340', ROSSO = '#EE3640', ROSSO_SCURO = '#B81F2B';
/** Bordo del riquadro dell'icona per rarità (il materiale, o il tipo per pozioni e ingredienti). */
const RARITA = { comune: '#C9CED8', raro: '#3DF5FF', epico: '#A64DFF', leggendario: '#F6C21C' } as const;
function rarita(it: ItemDef): string {
  const m = it.materiale;
  if (m === 'argento' || m === 'vetro') return RARITA.raro;
  if (m === 'oro') return RARITA.leggendario;
  if (m === 'ossa' || m === 'meteorite' || it.unico) return RARITA.epico;
  if (it.kind === 'ingrediente') return ['essenza_vuoto', 'polvere_ossa', 'fungo_luminoso'].includes(it.id) ? RARITA.raro : RARITA.comune;
  if (it.kind === 'pozione') return /grande|forza/.test(it.id) ? RARITA.epico : /minore/.test(it.id) ? RARITA.comune : RARITA.raro;
  return RARITA.comune;
}

const CT = 'var(--bt-ct)';
const contorno = `0 2px 0 ${CT}, 2px 0 0 ${CT}, -2px 0 0 ${CT}, 0 -2px 0 ${CT}, 1.5px 1.5px 0 ${CT}, -1.5px 1.5px 0 ${CT}, 1.5px -1.5px 0 ${CT}, -1.5px -1.5px 0 ${CT}`;
const CSS = `
@font-face { font-family: 'MzCinzel'; src: url('/assets/fonts/cinzel-900-latin.woff2') format('woff2'); font-weight: 900; font-display: swap; }
@font-face { font-family: 'MzAlmendra'; src: url('/assets/fonts/almendra-700-latin.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'MzLobster'; src: url('/assets/fonts/lobster-400-latin.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'MzAlegreyaSans'; src: url('/assets/fonts/alegreya-sans-800-latin.woff2') format('woff2'); font-weight: 800; font-display: swap; }
#mzBottega { position: absolute; inset: 0; z-index: 40; display: none; background: rgba(14, 22, 48, .28); }
#mzBottega.on { display: block; }
#mzBottega .bt-carta { position: absolute; left: 50%; transform: translateX(-50%); width: min(calc(100% - 28px), 460px); top: max(calc(env(safe-area-inset-top) + 96px), 16%); bottom: max(calc(env(safe-area-inset-bottom) + 70px), 8%);
  display: flex; flex-direction: column; box-sizing: border-box; padding: 10px 12px 10px; background: var(--bt-bg); color: var(--bt-t); font-family: var(--bt-fb); font-weight: 800;
  border: 5px solid ${ORO}; border-radius: 26px; box-shadow: 0 0 0 3px ${NOTTE}, 0 8px 0 3px ${NOTTE}; }
#mzBottega .bt-testa { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; gap: 6px; min-height: 50px; margin: 0 0 6px; }
#mzBottega .bt-nomebox { display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 0; overflow: hidden; }
#mzBottega .bt-testa canvas { width: 32px; height: 32px; image-rendering: pixelated; border-radius: 4px; flex: 0 0 auto; }
#mzBottega .bt-titolo { font: var(--bt-tw) 34px var(--bt-ft); white-space: nowrap; line-height: 1.15; color: ${'#FFF6E0'}; text-shadow: 0 2px 0 ${NOTTE}, 2px 0 0 ${NOTTE}, -2px 0 0 ${NOTTE}, 0 -2px 0 ${NOTTE}, 2px 2px 0 ${NOTTE}, -2px 2px 0 ${NOTTE}, 2px -2px 0 ${NOTTE}, -2px -2px 0 ${NOTTE}, 0 4px 0 ${NOTTE}; letter-spacing: .5px; }
#mzBottega .bt-x { grid-column: 3; width: 44px; height: 44px; border-radius: 12px; border: 3px solid ${NOTTE}; background: ${ROSSO}; box-shadow: 0 4px 0 ${ROSSO_SCURO}, 0 4px 0 3px ${NOTTE}; color: #fff; font: 900 24px ui-rounded, system-ui, sans-serif; line-height: 1; cursor: pointer; padding: 0; text-shadow: 0 2px 0 ${NOTTE}; }
#mzBottega .bt-x:active { transform: translateY(3px); box-shadow: 0 1px 0 ${ROSSO_SCURO}, 0 1px 0 3px ${NOTTE}; }
#mzBottega .bt-chi { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
#mzBottega .bt-ritratto { flex: 0 0 auto; width: 104px; height: 104px; border-radius: 16px; border: 4px solid ${ORO}; box-shadow: 0 0 0 2px ${NOTTE}; background: ${NOTTE} center / cover no-repeat; image-rendering: pixelated; display: grid; place-items: center; overflow: hidden; }
#mzBottega .bt-bolla { position: relative; flex: 1; min-height: 70px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 8px 12px; border-radius: 18px; border: 3px solid ${ORO}; background: var(--bt-bolla); font-size: 17px; line-height: 1.15; text-shadow: ${contorno}; }
#mzBottega .bt-bolla::before { content: ''; position: absolute; left: -13px; top: 50%; margin-top: -9px; border: 9px solid transparent; border-right: 11px solid ${ORO}; border-left: 0; }
#mzBottega .bt-bolla::after { content: ''; position: absolute; left: -8px; top: 50%; margin-top: -6px; border: 6px solid transparent; border-right: 8px solid var(--bt-bolla); border-left: 0; }
#mzBottega .bt-tabs { display: flex; gap: 4px; border-bottom: 4px solid ${ORO}; margin: 0 -2px; }
#mzBottega .bt-tab { flex: 1; min-height: 42px; border: 3px solid ${NOTTE}; border-bottom: 0; border-radius: 14px 14px 0 0; background: var(--bt-tab); color: var(--bt-tabT); font: var(--bt-tw) 18px var(--bt-ft); cursor: pointer; text-shadow: 0 2px 0 ${NOTTE}; }
#mzBottega .bt-tab.on { background: ${ORO}; color: ${NOTTE}; text-shadow: none; }
#mzBottega .bt-corpo { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0 4px; -webkit-overflow-scrolling: touch; }
#mzBottega .bt-sez { margin: 10px 4px 4px; font-size: 14px; color: var(--bt-t2); }
#mzBottega .bt-riga { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; padding: 8px; border-radius: 16px; background: var(--bt-riga); border: 2px solid var(--bt-rigaB); }
#mzBottega .bt-ico { flex: 0 0 auto; width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${RARITA.comune}; background: ${NOTTE}; display: grid; place-items: center; box-sizing: border-box; }
#mzBottega .bt-ico canvas { width: 40px; height: 40px; image-rendering: pixelated; }
#mzBottega .bt-ico i { width: 36px; height: 36px; border-radius: 8px; border: 3px solid ${NOTTE}; }
#mzBottega .bt-dati { flex: 1; min-width: 0; }
#mzBottega .bt-nome { font-size: 17px; line-height: 1.1; text-shadow: ${contorno}; }
#mzBottega .bt-sotto { margin-top: 3px; font-size: 13px; line-height: 1.15; color: var(--bt-t2); font-family: var(--bt-fb); font-weight: 800; }
#mzBottega .bt-prezzo { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 19px; text-shadow: ${contorno}; }
#mzBottega .bt-moneta { width: 20px; height: 20px; border-radius: 50%; background: ${ORO}; box-shadow: inset 0 0 0 3px ${ORO_SCURO}, 0 0 0 2px ${NOTTE}; flex: 0 0 auto; }
#mzBottega .bt-compra { flex: 0 0 auto; min-width: 104px; min-height: 48px; padding: 0 10px; border-radius: 14px; border: 3px solid ${NOTTE}; background: ${ORO}; color: ${NOTTE}; font: var(--bt-tw) 19px var(--bt-ft); cursor: pointer; box-shadow: 0 5px 0 ${ORO_OMBRA}, 0 5px 0 3px ${NOTTE}; margin-bottom: 5px; }
#mzBottega .bt-compra:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 1px 0 ${ORO_OMBRA}, 0 1px 0 3px ${NOTTE}; }
#mzBottega .bt-compra:disabled { background: #8C93A3; box-shadow: 0 5px 0 #5E6576, 0 5px 0 3px ${NOTTE}; cursor: default; font-size: 15px; }
#mzBottega .bt-compra small { display: block; font-size: 11px; font-family: var(--bt-fb); font-weight: 800; }
#mzBottega .bt-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 2px 8px; }
#mzBottega .bt-chip { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 3px solid ${NOTTE}; background: var(--bt-tab); color: var(--bt-tabT); font: var(--bt-tw) 15px var(--bt-ft); cursor: pointer; text-shadow: 0 1px 0 ${NOTTE}; }
#mzBottega .bt-chip.on { background: ${ORO}; color: ${NOTTE}; text-shadow: none; }
#mzBottega .bt-chip:disabled { opacity: .5; }
#mzBottega .bt-piede { margin-top: 6px; padding: 7px 10px; border-radius: 999px; background: var(--bt-piede); text-align: center; font-size: 15px; text-shadow: ${contorno}; }
#mzBottega .bt-nota { margin: 6px 4px; font-size: 14px; line-height: 1.25; color: var(--bt-t2); font-family: var(--bt-fb); font-weight: 800; }
@media (min-width: 700px) { #mzBottega .bt-carta { top: 12%; bottom: 8%; } }
`;

function fraTempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000)), h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

export function createBottegaUi(o: BottegaUiOpts): BottegaUi {
  if (!document.getElementById('mz-bottega-ui-style')) { const st = document.createElement('style'); st.id = 'mz-bottega-ui-style'; st.textContent = CSS; document.head.appendChild(st); }
  const box = el('div', 'mz'); box.id = 'mzBottega'; box.setAttribute('role', 'dialog');
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  box.addEventListener('click', (e) => { if (e.target === box) close(); }); // tocco fuori dalla carta = chiudi
  o.root.appendChild(box);
  let kind: BottegaId | null = null, tab: Tab = 'oggi', busy = false, battuta = '', mat = 'bronzo', cat = 'leggere', scroll = 0;
  const adesso = (): number => o.api?.serverNow() ?? Date.now();
  const lot = (): LotState | null => o.getLot();

  function onKey(e: KeyboardEvent): void {
    if (!kind) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
  }
  window.addEventListener('keydown', onKey, true);

  function errore(e: unknown): string { return e instanceof ApiError || e instanceof Error ? e.message || 'Non riuscito: riprova' : 'Non riuscito: riprova'; }
  function fai(p: () => Promise<LotState>, ok: (l: LotState) => string): void {
    if (busy) return;
    if (!o.api) { o.hud.toast('Le botteghe vendono solo a chi ha un\'isola: apri MAREA col tuo link personale', 3000); return; }
    busy = true; render();
    p().then((l) => { o.setLot(l); busy = false; render(); o.hud.toast(ok(l), 2400); }, (e: unknown) => { busy = false; render(); o.hud.toast(errore(e), 3000); });
  }
  const rpg = (a: RpgAction, ok: (l: LotState) => string) => fai(() => o.api!.rpg(a), ok);
  const dove = (prima: LotState, dopo: LotState, id: string) => ((dopo.hero?.inv[id] ?? 0) > (prima.hero?.inv[id] ?? 0) ? 'nello zaino' : 'nel Forziere');

  // ---- pezzi ----
  function riga(ico: HTMLElement, nome: string, sotto: (string | HTMLElement)[], btn: HTMLElement | null, key: string): HTMLElement {
    const r = el('div', 'bt-riga'); r.dataset['k'] = key;
    const d = el('div', 'bt-dati'); d.appendChild(el('div', 'bt-nome', nome));
    for (const s of sotto) d.appendChild(typeof s === 'string' ? el('div', 'bt-sotto', s) : s);
    r.append(ico, d);
    if (btn) r.appendChild(btn);
    return r;
  }
  function icona(it: ItemDef): HTMLElement { const b = el('div', 'bt-ico'); b.style.borderColor = rarita(it); b.appendChild(iconOf(it, 40)); return b; }
  function prezzo(n: number): HTMLElement { const p = el('div', 'bt-prezzo'); p.append(el('span', 'bt-moneta'), String(n)); return p; }
  function bottone(testo: string, sotto: string, off: boolean, fn: () => void, key: string): HTMLButtonElement {
    const b = el('button', 'bt-compra', testo); b.type = 'button'; b.disabled = off || busy; b.dataset['act'] = key;
    if (sotto) b.appendChild(el('small', '', sotto));
    b.addEventListener('click', fn);
    return b;
  }
  const manca = (l: LotState, n: number): string => (l.monete < n ? `ti mancano ${n - l.monete}` : '');

  // ---- schede ----
  function oggi(out: HTMLElement, l: LotState): void {
    const b = kind!;
    if (b === 'cantiere') {
      for (const id of vetrinaBottega('cantiere', adesso())) {
        const k = AVATAR.barca.colori.find((x) => x.id === id);
        if (!k) continue;
        const ico = el('div', 'bt-ico'), sw = el('i'); sw.style.background = k.hex; ico.appendChild(sw); ico.style.borderColor = RARITA.raro;
        const tua = possiedeColore(l, id);
        const btn = tua ? bottone('Già tua', '', true, () => {}, 'vernice-tua') : bottone('Compra', manca(l, k.monete), l.monete < k.monete,
          () => fai(() => o.api!.buyColore(id), () => `Vernice comprata: ${k.nome}. Mettila sulla barca da AVATAR → BARCA`), 'vernice');
        out.appendChild(riga(ico, k.nome, [prezzo(k.monete), 'vernice per scafo e vela'], btn, 'vernice:' + id));
      }
      out.appendChild(el('div', 'bt-nota', 'Le vernici comprate sono tue per sempre: le metti sulla barca da AVATAR → BARCA.'));
      return;
    }
    const h = heroOf(l);
    for (const id of vetrinaOggetti(b, adesso())) {
      const it = itemDef(id), n = prezzoVetrina(b, id);
      const btn = bottone('Compra', manca(l, n), l.monete < n, () => rpg({ t: 'vetrina', bottega: b, item: id, n: 1 }, (x) => `Comprato: ${it.nome} (${dove(l, x, id)})`), 'vetrina');
      out.appendChild(riga(icona(it), it.nome, [prezzo(n)], btn, 'vetrina:' + id));
    }
    out.appendChild(el('div', 'bt-sez', b === 'fabbro' ? 'Sempre in bottega: i lingotti per forgiare' : 'Sempre in bottega: le erbe di base'));
    for (const { id, monete } of sempreInVendita(b)) {
      const it = itemDef(id), hai = available(l, h, id);
      const btn = bottone('Compra', manca(l, monete), l.monete < monete, () => rpg({ t: 'compra', item: id, n: 1 }, (x) => `Comprato: ${it.nome} (${dove(l, x, id)})`), 'compra');
      out.appendChild(riga(icona(it), it.nome, [prezzo(monete), `ne hai ${hai}`], btn, 'compra:' + id));
    }
  }

  const CATS: readonly { id: string; nome: string; ok(it: ItemDef): boolean }[] = [
    { id: 'leggere', nome: 'Leggere', ok: (it) => it.kind === 'arma' && it.classe === 'leggera' },
    { id: 'pesanti', nome: 'Pesanti', ok: (it) => it.kind === 'arma' && it.classe === 'pesante' },
    { id: 'archi', nome: 'Archi', ok: (it) => it.kind === 'arco' || it.kind === 'frecce' },
    { id: 'armature', nome: 'Armature', ok: (it) => it.kind === 'armatura' },
  ];
  function chip(testo: string, on: boolean, off: boolean, fn: () => void, key: string): HTMLButtonElement {
    const c = el('button', 'bt-chip' + (on ? ' on' : ''), testo); c.type = 'button'; c.disabled = off; c.dataset['k'] = key; c.addEventListener('click', fn); return c;
  }
  function forgia(out: HTMLElement, l: LotState): void {
    const h = heroOf(l), liv = livelloBottega(l, 'fabbro');
    const cm = el('div', 'bt-chips');
    for (const m of MATERIALS) cm.appendChild(chip(m.banco > liv ? `${m.nome} · L${m.banco}` : m.nome, mat === m.id, false, () => { mat = m.id; render(); }, 'mat:' + m.id));
    const cc = el('div', 'bt-chips');
    for (const c of CATS) cc.appendChild(chip(c.nome, cat === c.id, false, () => { cat = c.id; render(); }, 'cat:' + c.id));
    out.append(cm, cc);
    const m = MATERIALS.find((x) => x.id === mat) ?? MATERIALS[0]!, chiuso = m.banco > liv;
    if (chiuso) out.appendChild(el('div', 'bt-nota', `${m.nome}: serve il Fabbro al livello ${m.banco}. Lo migliori nella scheda Livello.`));
    const sconto = Math.max(-0.9, modsOf(h).materialiForgia ?? 0), c = CATS.find((x) => x.id === cat) ?? CATS[0]!;
    for (const it of ITEMS.filter((x) => x.forgia && x.materiale === m.id && c.ok(x))) {
      const costo = Object.entries(it.forgia!.costo).map(([id, qn]) => {
        const need = Math.max(1, Math.ceil(qn * (1 + sconto)));
        return id === 'risorsa:legno' ? { nome: 'monete', need: prezzoInMonete({ legno: need }), have: l.monete } : { nome: hasItem(id) ? itemDef(id).nome : id, need, have: available(l, h, id) };
      });
      const ok = costo.every((x) => x.have >= x.need), n = it.forgia!.n ?? 1;
      const btn = bottone('Forgia', chiuso ? `Fabbro L${m.banco}` : ok ? (n > 1 ? `×${n}` : '') : 'ti manca roba', chiuso || !ok,
        () => rpg({ t: 'forgia', item: it.id }, (x) => `Forgiato: ${it.nome}${n > 1 ? ` ×${n}` : ''} (${dove(l, x, it.id)})`), 'forgia');
      out.appendChild(riga(icona(it), it.nome, costo.map((x) => `${x.need} ${x.nome} · hai ${x.have}`), btn, 'forgia:' + it.id));
    }
  }
  function pozioni(out: HTMLElement, l: LotState): void {
    const h = heroOf(l), lv = h.skill.alchimia?.lv ?? 0;
    out.appendChild(el('div', 'bt-nota', `La tua Alchimia: ${lv}. Più sale, più ricette e pozioni più forti.`));
    for (const r of [...RECIPES].sort((a, b) => a.livello - b.livello)) {
      if (!hasItem(r.risultato)) continue;
      const it = itemDef(r.risultato), chiusa = lv < r.livello;
      const ing = Object.entries(r.ingredienti).map(([id, qn]) => ({ nome: hasItem(id) ? itemDef(id).nome : id, need: qn, have: available(l, h, id) }));
      const ok = ing.every((x) => x.have >= x.need);
      const btn = bottone('Prepara', chiusa ? `Alchimia ${r.livello}` : ok ? '' : 'ti mancano erbe', chiusa || !ok,
        () => rpg({ t: 'alchimia', ricetta: r.id }, (x) => `Pronta: ${it.nome} (${dove(l, x, it.id)})`), 'alchimia');
      out.appendChild(riga(icona(it), r.nome, ing.map((x) => `${x.need} ${x.nome} · hai ${x.have}`), btn, 'ricetta:' + r.id));
    }
  }
  function livelli(out: HTMLElement, l: LotState, b: 'fabbro' | 'cantiere'): void {
    const liv = livelloBottega(l, b), next = prossimoLivello(l, b), def = BOTTEGHE[b].livelli ?? [];
    if (b === 'cantiere') out.appendChild(el('div', 'bt-nota', liv >= 2 ? 'La tua barca regge la Tempesta.' : 'Al livello 2 la barca regge la Tempesta: si apre l\'isola.'));
    def.forEach((d, i) => {
      const n = i + 1, ico = el('div', 'bt-ico'), num = el('div', 'bt-nome', String(n)); num.style.fontSize = '26px'; ico.appendChild(num);
      ico.style.borderColor = n <= liv ? ORO : RARITA.comune;
      let btn: HTMLElement | null = null;
      if (n <= liv) btn = bottone(n === liv ? 'Ce l\'hai' : 'Fatto', '', true, () => {}, 'livello-fatto');
      else if (next && n === next.livello) btn = bottone('Migliora', manca(l, next.monete), l.monete < next.monete, () => fai(() => o.api!.bottega('migliora', { bottega: b, da: liv }), () => `${BOTTEGHE[b].nome}: livello ${n}!`), 'migliora');
      out.appendChild(riga(ico, `Livello ${n}`, [d.desc, ...(n > liv ? [prezzo(d.monete)] : [])], btn, `livello:${n}`));
    });
  }

  function render(): void {
    if (!kind) return;
    const l = lot(), b = BOTTEGHE[kind], corpoVecchio = box.querySelector('.bt-corpo');
    if (corpoVecchio) scroll = corpoVecchio.scrollTop;
    const carta = el('div', 'bt-carta');
    for (const [k, v] of Object.entries(TINTA)) carta.style.setProperty('--bt-' + k, v);
    carta.style.setProperty('--bt-fb', TESTO); carta.style.setProperty('--bt-ft', CARATTERE[kind].f); carta.style.setProperty('--bt-tw', String(CARATTERE[kind].w));
    const testa = el('div', 'bt-testa'), ic = canvasInsegna(kind), nomebox = el('div', 'bt-nomebox'), titolo = el('div', 'bt-titolo', b.nome);
    const x = el('button', 'bt-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi'; x.addEventListener('click', () => close());
    nomebox.append(ic, titolo); nomebox.style.gridColumn = '2'; testa.append(nomebox, x);
    const chi = el('div', 'bt-chi'), rit = el('div', 'bt-ritratto');
    rit.style.backgroundImage = `url('/assets/botteghe/${kind}.webp')`;
    chi.append(rit, el('div', 'bt-bolla', battuta));
    const tabs = el('div', 'bt-tabs');
    for (const t of TABS[kind]) { const tb = el('button', 'bt-tab' + (t.id === tab ? ' on' : ''), t.nome); tb.type = 'button'; tb.dataset['tab'] = t.id; tb.addEventListener('click', () => { tab = t.id; scroll = 0; render(); }); tabs.appendChild(tb); }
    const corpo = el('div', 'bt-corpo');
    if (!l) corpo.appendChild(el('div', 'bt-nota', 'Le botteghe vendono solo a chi ha un\'isola: apri MAREA col tuo link personale.'));
    else if (tab === 'oggi') oggi(corpo, l);
    else if (tab === 'forgia') forgia(corpo, l);
    else if (tab === 'pozioni') pozioni(corpo, l);
    else if (tab === 'livello') livelli(corpo, l, 'fabbro');
    else if (tab === 'barca') livelli(corpo, l, 'cantiere');
    carta.append(testa, chi, tabs, corpo);
    if (tab === 'oggi') carta.appendChild(el('div', 'bt-piede', `Nuova merce tra ${fraTempo(finoAMezzanotte(adesso()))}`));
    box.replaceChildren(carta);
    corpo.scrollTop = scroll;
    // il titolo sta su una riga in mezzo, fra il posto vuoto a sinistra e la X: se è lungo si rimpicciolisce (anche a carattere arrivato)
    const adatta = () => { let sz = 34; titolo.style.fontSize = sz + 'px'; while (sz > 18 && titolo.scrollWidth > nomebox.clientWidth - ic.offsetWidth - 16) titolo.style.fontSize = --sz + 'px'; };
    adatta(); void document.fonts?.ready.then(adatta);
  }

  function close(): void {
    if (!kind) return;
    kind = null; box.classList.remove('on'); box.replaceChildren(); o.onClose();
  }
  registerStateProvider('bottegaUi', () => ({
    aperta: kind, tab, busy,
    righe: [...box.querySelectorAll<HTMLElement>('.bt-riga')].map((r) => ({ k: r.dataset['k'], off: !!r.querySelector<HTMLButtonElement>('.bt-compra')?.disabled })),
  }));
  return {
    get kind() { return kind; },
    apri(id) {
      kind = id; tab = 'oggi'; scroll = 0;
      const fr = BOTTEGHE[id].battute ?? [];
      battuta = fr[Math.floor(Math.random() * fr.length)] ?? '';
      box.classList.add('on'); render();
    },
    isOpen: () => kind !== null,
    close,
    state: () => ({ aperta: kind, tab }),
  };
}
