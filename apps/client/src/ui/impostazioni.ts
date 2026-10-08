// Impostazioni (#53): ingranaggio #mzSetBtn nella barra in alto, pannello #mzSet con camera (5 viste), ciclo giorno/notte,
// meteo (#85), stampa giapponese e contorni, volume di Musica ed Effetti (audio/ponte.ts: 4 livelli, NO … ALTA). Di serie (#59) ciclo, camera 22° e contorni; le scelte restano su questo dispositivo (localStorage).
// Coi test automatici (?test=1) si parte tutto spento, così gli screenshot non dipendono dall'ora vera; ?serie=1 usa i valori di serie.
// Il pannello non sa niente di three: chiama onChange e render/aspetto.ts fa il resto.
import { PAL, el, injectUiStyle } from './style.ts';
import { topButton } from './topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { CICLO_MIN, DI_SERIE, SPENTO, VISTE, VOLUMI } from '../render/viste.ts';
import { setVolumi } from '../audio/ponte.ts';
import { FLAGS } from '../flags.ts';
import type { Impostazioni } from '../render/viste.ts';

const KEY = 'marea:impostazioni:2'; // :2 dal #59: con i nuovi valori di serie tutti ripartono da lì
const P = PAL;
const CSS = `
#mzSet .mz-set-sec { margin: 4px 0 12px; }
#mzSet .mz-set-lbl { font-size: 14px; font-weight: bold; color: ${P.sabbia}; margin-bottom: 6px; }
#mzSet .mz-set-cams { display: flex; gap: 6px; flex-wrap: wrap; }
#mzSet .mz-set-cam { min-width: 52px; min-height: 44px; padding: 0 8px; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzSet .mz-set-cam.on { background: ${P.giallo}; border-color: ${P.giallo}; color: ${P.neroCaldo}; }
#mzSet .mz-set-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 52px; margin-top: 6px; padding: 6px 10px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; text-align: left; cursor: pointer; }
#mzSet .mz-set-row .q { display: block; font-size: 12px; font-weight: normal; color: ${P.pietra}; margin-top: 2px; }
#mzSet .mz-set-row .sw { flex: none; min-width: 52px; padding: 4px 0; text-align: center; background: ${P.roccia}; border: 2px solid ${P.pietraScura}; color: ${P.pietra}; }
#mzSet .mz-set-row.on { border-color: ${P.giallo}; }
#mzSet .mz-set-row.on .sw { background: ${P.erba}; border-color: ${P.erbaScura}; color: ${P.neroCaldo}; }
#mzSet .mz-set-vol { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; }
#mzSet .mz-set-vol .mz-set-lbl { flex: 1; margin: 0; }
#mzSet .mz-set-vol .mz-set-cam { min-width: 48px; }
#mzSetBtn .mz-ico { width: 28px; height: 28px; }
`;
let styled = false;
function injectStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style'); s.id = 'mz-set-style'; s.textContent = CSS; document.head.appendChild(s);
}

const GEAR = [
  '................', '......gggg......', '......gddg......', '..gg.gggggg.gg..', '..gggggggggggg..', '...gggg..gggg...', '..gggg....gggg..', '.gggg......gggg.',
  '.gggg......gggg.', '..gggg....gggg..', '...gggg..gggg...', '..gggggggggggg..', '..gg.gggggg.gg..', '......gddg......', '......gggg......', '................',
];
/** Ingranaggio 16×16 in <canvas>: pietra chiara con contorno nero caldo. */
function gearIcon(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.className = 'mz-ico'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d'); if (!g) return c;
  const at = (x: number, y: number) => GEAR[y]?.[x] ?? '.';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = at(x, y);
    const col = k === 'g' ? P.pietraChiara : k === 'd' ? P.pietra : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) !== '.') ? P.neroCaldo : null;
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

/** Le impostazioni salvate (o quelle di serie se non ci sono o il browser non lascia leggere). */
export function loadImpostazioni(): Impostazioni {
  const base = FLAGS.test && !FLAGS.serie ? SPENTO : DI_SERIE;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Impostazioni> | null;
    if (!raw) return { ...base };
    const vol = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 3 ? Math.round(v) : d); // salvate prima dell'audio: di serie
    return { cam: Number(raw.cam) || 0, ciclo: raw.ciclo === true, stampa: raw.stampa === true, contorni: raw.contorni === true, meteo: typeof raw.meteo === 'boolean' ? raw.meteo : base.meteo, musica: vol(raw.musica, base.musica), effetti: vol(raw.effetti, base.effetti) };
  } catch { return { ...base }; }
}

export type ImpostazioniPanel = { open(): void; close(): void; isOpen(): boolean; readonly value: Impostazioni };

/** `guida`: la riga «Guida Primi passi» (SÌ/NO) per riaccendere la guida chiusa con ×; non è un'impostazione salvata qui (sta nella guida). */
export function createImpostazioni(o: { root: HTMLElement; onChange(s: Impostazioni): void; guida?: { on(): boolean; set(on: boolean): void } }): ImpostazioniPanel {
  injectUiStyle(); injectStyle();
  let cur = loadImpostazioni(), open = false;
  const sheet = el('div', 'mz mz-sheet mz-side'); sheet.id = 'mzSet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Impostazioni');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', 'Impostazioni'));
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; head.appendChild(x);
  const body = el('div'); sheet.append(head, body); o.root.appendChild(sheet);

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* navigazione privata: vale fino a fine sessione */ } };
  const change = (p: Partial<Impostazioni>) => { cur = { ...cur, ...p }; save(); o.onChange(cur); setVolumi(cur.musica, cur.effetti); render(); };
  const toggleRow = (key: 'ciclo' | 'stampa' | 'contorni' | 'meteo', title: string, sub: string) => {
    const b = el('button', 'mz-set-row' + (cur[key] ? ' on' : '')); b.type = 'button'; b.dataset['set'] = key;
    const txt = el('span'); txt.append(el('span', '', title), el('span', 'q', sub));
    b.append(txt, el('span', 'sw', cur[key] ? 'SÌ' : 'NO'));
    b.addEventListener('click', () => change({ [key]: !cur[key] }));
    return b;
  };
  /** Volume a 4 livelli su una riga (NO, 1, 2, 3), bottoni grandi come quelli della camera: un pollice basta. In cima: è la cosa che si cambia più spesso. */
  const volRow = (key: 'musica' | 'effetti', title: string) => {
    const row = el('div', 'mz-set-vol'); row.append(el('div', 'mz-set-lbl', title));
    VOLUMI.forEach((nome, i) => {
      const b = el('button', 'mz-set-cam' + (cur[key] === i ? ' on' : ''), nome); b.type = 'button'; b.dataset[key] = String(i);
      b.title = i === 0 ? 'Spento' : ['', 'Bassa', 'Media', 'Alta'][i] ?? '';
      b.addEventListener('click', () => change({ [key]: i }));
      row.appendChild(b);
    });
    return row;
  };
  function render(): void {
    body.replaceChildren();
    const cam = el('div', 'mz-set-sec'); cam.append(el('div', 'mz-set-lbl', 'Camera'));
    const row = el('div', 'mz-set-cams');
    VISTE.forEach((v, i) => {
      const b = el('button', 'mz-set-cam' + (cur.cam === i ? ' on' : ''), v.nome); b.type = 'button'; b.dataset['cam'] = String(i);
      b.title = i === 0 ? 'Dall\'alto, come sempre' : 'Più bassa: si vede l\'orizzonte';
      b.addEventListener('click', () => change({ cam: i }));
      row.appendChild(b);
    });
    cam.appendChild(row);
    body.append(volRow('musica', 'Musica'), volRow('effetti', 'Effetti'), cam,
      toggleRow('ciclo', 'Ciclo giorno e notte', `giorno, tramonto, notte, alba: un giro ogni ${CICLO_MIN} minuti`),
      toggleRow('meteo', 'Meteo', 'sole, nuvole, pioggia, nebbia, vento: lo stesso per tutti'),
      toggleRow('stampa', 'Stampa giapponese', 'colori da stampa antica, onde, carta'),
      toggleRow('contorni', 'Contorni', 'una riga scura attorno a cose e persone'));
    const g = o.guida;
    if (g) {
      const on = g.on(), b = el('button', 'mz-set-row' + (on ? ' on' : '')); b.type = 'button'; b.dataset['set'] = 'guida';
      const txt = el('span'); txt.append(el('span', '', 'Guida «Primi passi»'), el('span', 'q', 'la scheda gialla coi consigli per chi arriva'));
      b.append(txt, el('span', 'sw', on ? 'SÌ' : 'NO'));
      b.addEventListener('click', () => { g.set(!g.on()); render(); });
      body.appendChild(b);
    }
  }
  const btn = topButton({ root: o.root, id: 'mzSetBtn', order: 5, label: '', title: 'Impostazioni', onClick: () => (open ? close() : show()) });
  btn.el.insertBefore(gearIcon(), btn.el.firstChild);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    e.stopPropagation(); // col pannello aperto i tasti non arrivano al gioco
  };
  function show(): void { if (open) return; open = true; render(); sheet.classList.add('on'); btn.setOn(true); addEventListener('keydown', onKey, true); }
  function close(): void { if (!open) return; open = false; sheet.classList.remove('on'); btn.setOn(false); removeEventListener('keydown', onKey, true); }
  x.addEventListener('click', close);
  render();
  o.onChange(cur); setVolumi(cur.musica, cur.effetti);
  registerStateProvider('impostazioni', () => ({ ...cur, open }));
  registerTestHook('impostazioni', (p) => change((p ?? {}) as Partial<Impostazioni>));
  return { open: show, close, isOpen: () => open, get value() { return cur; } };
}
