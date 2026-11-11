import { LIBRO as L } from '../ui/libro_colori.ts';
import { apriTastiera } from './tastiera.ts';
import { inviaTasto } from './mappa.ts';

import { cercaMenu, visibile } from './pannelli.ts';

const CONTROLLI = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="menuitem"], [tabindex="0"]';
const INDIETRO = '[data-pad-back], .mz-x, .mk-x, [data-act="riprendi"], [data-act="resta"]';
const focusabile = (e: HTMLElement) => !e.matches(':disabled, [aria-disabled="true"]') && !e.closest('[inert], [aria-hidden="true"]') && visibile(e);
let hud: HTMLElement | null = null;
let ultimo: HTMLElement | null = null, fuoco: HTMLElement | null = null, indice = 0;

export function menuAttivo(doc = document): HTMLElement | null {
  const aperto = cercaMenu(doc);
  if (aperto) hud = null;
  return aperto ?? hud;
}

export function apriHud(root: HTMLElement): void { hud = root; }

const elementi = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(CONTROLLI)].filter(focusabile);
function seleziona(e: HTMLElement | undefined): void {
  fuoco?.removeAttribute('data-pad-focus');
  fuoco = e ?? null;
  if (!e) return;
  e.dataset['padFocus'] = '';
  if (!e.ownerDocument.getElementById('mz-pad-focus')) {
    const style = e.ownerDocument.createElement('style'); style.id = 'mz-pad-focus';
    style.textContent = `[data-pad-focus] { outline: 3px solid ${L.acqua} !important; outline-offset: 2px; box-shadow: 0 0 0 5px ${L.cartaChiara} !important; }`;
    e.ownerDocument.head.append(style);
  }
  e.focus({ preventScroll: true }); e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

const chiave = (e: HTMLElement): string | undefined => {
  if (e.id) return '#' + e.id;
  for (const k of ['cmd', 'set', 'sq', 'item', 'tab', 'act']) {
    const v = e.dataset[k];
    if (v) return k + ':' + v;
  }
  return undefined;
};

export function aggiornaMenu(menu: HTMLElement | null, selezionaSubito = false): void {
  const cambia = menu !== ultimo;
  if (!cambia && (!fuoco || fuoco.isConnected)) return;
  const k = !cambia && fuoco ? chiave(fuoco) : undefined;
  ultimo = menu; indice = 0;
  if (fuoco && fuoco === fuoco.ownerDocument.activeElement) fuoco.blur();
  seleziona(undefined);
  if (!menu || !selezionaSubito) return;
  const voci = elementi(menu);
  const primo = (k ? voci.find((e) => chiave(e) === k) : undefined)
    ?? voci.find((e) => e.matches('[data-pad-inizio]'))
    ?? voci.find((e) => !e.matches(INDIETRO)) ?? voci[0];
  if (primo) { indice = voci.indexOf(primo); seleziona(primo); }
}

export const DIREZIONI = ['su', 'giu', 'sinistra', 'destra'] as const;
type Direzione = typeof DIREZIONI[number];
const vettore = (d: Direzione) => d === 'su' ? [0, -1] : d === 'giu' ? [0, 1] : d === 'sinistra' ? [-1, 0] : [1, 0];
const centro = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
function vicino(d: Direzione, da: HTMLElement, voci: HTMLElement[]): HTMLElement | undefined {
  const [x = 0, y = 0] = centro(da), [vx = 0, vy = 0] = vettore(d);
  let best: HTMLElement | undefined, costo = Infinity;
  for (const e of voci) {
    const [ex = 0, ey = 0] = centro(e), dx = ex - x, dy = ey - y;
    const avanti = dx * vx + dy * vy, traverso = Math.abs(dx * vy - dy * vx);
    const c = avanti + traverso * 3;
    if (avanti > 3 && c < costo) { best = e; costo = c; }
  }
  return best;
}

function cambiaValore(e: HTMLElement, passo: number): boolean {
  if (e.matches('select')) {
    const select = e as HTMLSelectElement, opzioni = [...select.options].filter((o) => !o.disabled);
    const i = opzioni.findIndex((o) => o.selected);
    const n = opzioni[(i + passo + opzioni.length) % opzioni.length];
    if (n) n.selected = true;
  } else if (e.matches('input[type="range"], input[type="number"]')) {
    const input = e as HTMLInputElement;
    if (passo > 0) input.stepUp(); else input.stepDown();
  } else return false;
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function comandoMenu(menu: HTMLElement, id: string): void {
  if (id === 'indietro' || id === 'chiudi') {
    if (menu === hud) { hud = null; aggiornaMenu(null); return; }
    const back = [...menu.querySelectorAll<HTMLElement>('[data-pad-back]')].find(focusabile)
      ?? [...menu.querySelectorAll<HTMLElement>(INDIETRO)].find(focusabile);
    if (back) back.click();
    else {
      inviaTasto('keydown', 'Escape', false, undefined, menu.ownerDocument);
      inviaTasto('keyup', 'Escape', false, undefined, menu.ownerDocument);
    }
    return;
  }
  const voci = elementi(menu);
  if (!voci.length) return;
  const corrente = fuoco && voci.includes(fuoco) ? fuoco : voci[Math.min(indice, voci.length - 1)]!;
  let prossimo = corrente;
  if (id === 'conferma') {
    seleziona(corrente);
    if (!cambiaValore(corrente, 1) && !apriTastiera(corrente)) corrente.click();
    if (menu === hud) hud = null;
  } else if (id === 'rimuovi') {
    if (corrente.matches('[data-cmd]')) corrente.dispatchEvent(new Event('pad-rimuovi'));
  } else if (id === 'avanti' || id === 'precedente') {
    const delta = id === 'avanti' ? 1 : -1;
    prossimo = voci[(voci.indexOf(corrente) + delta + voci.length) % voci.length]!;
  } else if (DIREZIONI.some((d) => d === id)) {
    const d = id as Direzione;
    if (fuoco && (d === 'sinistra' || d === 'destra') && cambiaValore(corrente, d === 'sinistra' ? -1 : 1)) return;
    prossimo = fuoco ? vicino(d, corrente, voci) ?? corrente : corrente;
  } else return;
  indice = voci.indexOf(prossimo);
  if (id !== 'conferma') seleziona(prossimo);
}
