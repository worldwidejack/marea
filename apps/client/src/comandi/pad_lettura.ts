import { PULSANTI_ASSEGNABILI, azioneDi } from './azioni.ts';
import type { Profilo } from './azioni.ts';
import { annullaCursore, clicCursore, muoviCursore, rotellaCursore } from './cursore.ts';
import { DIREZIONI, aggiornaMenu, apriHud, comandoMenu, menuAttivo } from './menu.ts';
import { azioneDelPad, inCattura, inviaTasto, padDi, profiloAttivo, stickInvertiti } from './mappa.ts';

import { controller, padStato, delPad, notificaPad } from './pad.ts';

const MORTA = 0.22, SOGLIA = 0.5;
const RIPETI_DOPO = 330, RIPETI_OGNI = 125;
const CON_CURSORE = new Set<Profilo>(['difesa', 'koi', 'ingorgo', 'pinguini']);
type V = { x: number; y: number };
const ZERO: V = { x: 0, y: 0 };
let raf = 0, attendiNeutro = false;
let ultimoProfilo: Profilo | null = null, ultimoMenu: HTMLElement | null = null, ultimaCattura = false, ultimoDoc = document;
let giu = new Set<number>(), ripeti: { id: string; dopo: number } | null = null;
const emessi = new Map<number, { code: string; doc: Document }>();
const bloccati = new Set<number>();

const radiale = (x: number, y: number): V => {
  const m = Math.hypot(x, y);
  if (m <= MORTA) return ZERO;
  const f = Math.min(1, (m - MORTA) / (1 - MORTA)) / m;
  return { x: x * f, y: y * f };
};

function rilascia(b: number): void {
  const e = emessi.get(b);
  if (e) { emessi.delete(b); inviaTasto('keyup', e.code, false, delPad, e.doc); }
}

function lasciaTutto(): void {
  for (const b of emessi.keys()) rilascia(b);
  padStato.mov = padStato.mira = ZERO; ripeti = null; annullaCursore();
}

function premi(b: number, code: string, doc: Document): void {
  emessi.set(b, { code, doc });
  inviaTasto('keydown', code, false, delPad, doc);
}

function leggi(ora: number): void {
  const gp = controller();
  if (!gp) {
    if (padStato.nome) { lasciaTutto(); giu.clear(); bloccati.clear(); padStato.nome = ''; padStato.attivo = false; aggiornaMenu(null); notificaPad(); }
    return;
  }
  const n = gp.id.replace(/\s*\(.*$/, '').slice(0, 40) || 'Controller';
  if (n !== padStato.nome) { padStato.nome = n; notificaPad(); }

  const prima = giu;
  giu = new Set(Array.from({ length: PULSANTI_ASSEGNABILI }, (_, i) => i)
    .filter((i) => gp.buttons[i]?.pressed || (gp.buttons[i]?.value ?? 0) > 0.5));
  const nuove = [...giu].filter((i) => !prima.has(i));
  const sinistro = radiale(gp.axes[0] ?? 0, gp.axes[1] ?? 0), destro = radiale(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
  padStato.attivo ||= nuove.length > 0 || sinistro !== ZERO || destro !== ZERO;
  const p = profiloAttivo(), iframe = p === 'difesa' ? document.querySelector<HTMLIFrameElement>('#mzDifesa iframe') : null;
  const doc = iframe?.contentDocument ?? document, menu = menuAttivo(doc), cattura = inCattura();
  const m = menu && !(p === 'scacchi' && menu.id === 'mzScacchi') ? 'menu' : p;
  const [sx, dx] = stickInvertiti(m) ? [destro, sinistro] : [sinistro, destro];
  aggiornaMenu(menu, padStato.attivo);
  if (p !== ultimoProfilo || menu !== ultimoMenu || cattura !== ultimaCattura || doc !== ultimoDoc) {
    lasciaTutto();
    for (const b of prima) bloccati.add(b);
    if (ultimoProfilo !== null && sx !== ZERO) attendiNeutro = true;
    ultimoProfilo = p; ultimoMenu = menu; ultimaCattura = cattura; ultimoDoc = doc;
  }
  if (sx === ZERO) attendiNeutro = false;
  for (const b of bloccati) if (!giu.has(b)) bloccati.delete(b);
  for (const b of prima) if (!giu.has(b)) rilascia(b);
  if (cattura) {
    const b = nuove[0];
    if (b !== undefined && padStato.aspetta) { const cb = padStato.aspetta; padStato.aspetta = null; cb(b); }
    return;
  }

  const usaPuntatore = CON_CURSORE.has(p) && !menu;
  const puntaMenu = menu && dx !== ZERO;
  const stick = attendiNeutro ? ZERO : sx;
  if (usaPuntatore || puntaMenu) muoviCursore(doc, usaPuntatore && stick !== ZERO ? stick.x : dx.x, usaPuntatore && stick !== ZERO ? stick.y : dx.y, ora, usaPuntatore);
  const direzione = Math.max(Math.abs(stick.x), Math.abs(stick.y)) < SOGLIA ? undefined
    : Math.abs(stick.x) > Math.abs(stick.y) ? (stick.x > 0 ? 'destra' : 'sinistra') : (stick.y > 0 ? 'giu' : 'su');
  if (menu) {
    const d = direzione ?? DIREZIONI.find((id) => { const b = padDi(m, id); return b !== null && giu.has(b) && !bloccati.has(b); });
    if (d && (!ripeti || ripeti.id !== d || ora >= ripeti.dopo)) {
      comandoMenu(menu, d);
      ripeti = { id: d, dopo: ora + (ripeti?.id === d ? RIPETI_OGNI : RIPETI_DOPO) };
    } else if (!d) ripeti = null;
    for (const b of prima) if (!giu.has(b) && azioneDelPad(m, b) === 'puntatore') clicCursore(false);
    for (const b of nuove) {
      const id = azioneDelPad(m, b);
      if (id === 'puntatore') { muoviCursore(doc, 0, 0, ora, true); clicCursore(true); }
      else if (id === 'zoomIn' || id === 'zoomOut') { muoviCursore(doc, 0, 0, ora); rotellaCursore(id === 'zoomIn' ? -1 : 1); }
      else if (m === 'scacchi' && id && ['annulla', 'riavvia', 'prossimo'].includes(id)) {
        const code = azioneDi(m, id)?.tasti[0]; if (code) premi(b, code, doc);
      }
      else if (id && !DIREZIONI.some((x) => x === id)) comandoMenu(menu, id);
      else if (menu.id === 'mzEroe' && padDi(p, 'eroe') === b) comandoMenu(menu, 'indietro');
      else if (iframe && padDi(p, 'esci') === b) document.getElementById('mzDifesaEsci')?.click();
      if (menuAttivo(doc) !== menu) break;
    }
    return;
  }

  const inDirezione = (id: string): number => {
    const b = padDi(p, id);
    return b !== null && giu.has(b) && !bloccati.has(b) ? 0.7 : 0;
  };
  const x = inDirezione('destra') - inDirezione('sinistra'), y = inDirezione('giu') - inDirezione('su');
  padStato.mov = usaPuntatore ? ZERO : x || y ? radiale(x, y) : stick;
  padStato.mira = usaPuntatore ? ZERO : dx;
  // I giochi che leggono i tasti invece di InputFrame ricevono anche i fronti delle direzioni.
  for (const [i, id] of DIREZIONI.entries()) {
    const code = azioneDi(p, id)?.tasti[0];
    const verso = id === 'su' ? -padStato.mov.y : id === 'giu' ? padStato.mov.y : id === 'sinistra' ? -padStato.mov.x : padStato.mov.x;
    if (code && verso >= SOGLIA) { if (!emessi.has(-1 - i)) premi(-1 - i, code, doc); }
    else rilascia(-1 - i);
  }
  for (const b of prima) if (!giu.has(b) && azioneDelPad(p, b) === 'clic') clicCursore(false);
  for (const b of nuove) {
    const id = azioneDelPad(p, b);
    if (!id || DIREZIONI.some((d) => d === id)) continue;
    if (id === 'clic') clicCursore(true);
    else if (id === 'hud') {
      const ui = document.getElementById('ui');
      if (ui) apriHud(ui);
    } else if (id === 'esci' && iframe) document.getElementById('mzDifesaEsci')?.click();
    else {
      const code = azioneDi(p, id)?.tasti[0];
      if (code) premi(b, code, doc);
    }
    if (menuAttivo(doc) || profiloAttivo() !== p) break;
  }
}

function giro(ora: number): void { raf = 0; leggi(ora); if (padStato.nome) parti(); }
function parti(): void { if (!raf && !document.hidden) raf = requestAnimationFrame(giro); }
function sospendi(): void {
  lasciaTutto(); attendiNeutro = true;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}
let avviato = false;
export function avviaLettura(): void {
  if (avviato) return;
  avviato = true;
  addEventListener('gamepadconnected', parti);
  addEventListener('gamepaddisconnected', parti);
  addEventListener('blur', () => { lasciaTutto(); for (const b of giu) bloccati.add(b); attendiNeutro = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) sospendi(); else if (controller()) parti(); });
  if (controller()) parti();
}
