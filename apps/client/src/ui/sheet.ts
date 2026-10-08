// Pezzi DOM generici della vista isola: pannello a scomparsa dal basso (un pollice), etichette ancorate al mondo, risorse che volano.
import { el } from './style.ts';
import { resIcon } from './icons.ts';
import type { ResId } from './icons.ts';
import { suona } from '../audio/ponte.ts';

/** Conto alla rovescia «1:32» / «1:04:09». */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}
/** Durata leggibile: «30 s», «2 min», «1 h 20 min». */
export function fmtDur(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Span con un conto alla rovescia che si aggiorna da solo (tick del foglio) senza ridisegnare il pannello. */
export function timerSpan(endsMs: number, prefix = ''): HTMLSpanElement {
  const s = el('span');
  s.dataset['ends'] = String(endsMs);
  s.dataset['prefix'] = prefix;
  return s;
}
export function tickTimers(root: ParentNode, now: number): void {
  for (const s of root.querySelectorAll<HTMLElement>('[data-ends]')) {
    const t = (s.dataset['prefix'] ?? '') + fmtClock(Number(s.dataset['ends']) - now);
    if (s.textContent !== t) s.textContent = t;
  }
}

export type Sheet = { el: HTMLElement; key(): string | null; open(key: string, body: HTMLElement, sig?: string): void; close(): void; tick(now: number): void };
/** Pannello dal basso. open() con la stessa chiave e la stessa firma non ridisegna (un tocco a metà non si perde). */
export function createSheet(root: HTMLElement, onClose?: () => void): Sheet {
  const sheet = el('div', 'mz mz-sheet'); sheet.id = 'mzSheet';
  root.appendChild(sheet);
  let cur: string | null = null, curSig = '';
  // i tocchi sul pannello non arrivano al canvas né al joystick
  for (const ev of ['pointerdown', 'touchstart']) sheet.addEventListener(ev, (e) => e.stopPropagation());
  return {
    el: sheet,
    key: () => cur,
    open(key, body, sig = '') {
      if (cur === key && sig && sig === curSig) return;
      cur = key; curSig = sig;
      sheet.replaceChildren(body);
      sheet.classList.add('on');
    },
    close() {
      if (!cur) return;
      cur = null; curSig = '';
      sheet.classList.remove('on');
      sheet.replaceChildren();
      onClose?.();
    },
    tick(now) { if (cur) tickTimers(sheet, now); },
  };
}

/** Entro quanti metri un cartello delle attività torna pieno (#129): oltre è piccolo e in trasparenza (classe `far`). */
export const LABEL_NEAR_M = 12;
/** `vicino` = false: cartello discreto (piccolo, in trasparenza); di serie pieno. */
export type Label = { el: HTMLElement; set(kind: 'bubble' | 'timer' | 'full' | 'info', content: Node[], sig: string): void; place(x: number, y: number, on: boolean, vicino?: boolean): void; remove(): void };
export type LabelLayer = { add(onTap?: () => void): Label; el: HTMLElement };
/** Strato di etichette sopra il canvas; la posizione la calcola chi proietta dal mondo (x, y in px CSS). */
export function createLabelLayer(root: HTMLElement): LabelLayer {
  const layer = el('div', 'mz mz-labels');
  root.prepend(layer); // sotto a barra, pannello e controlli
  return {
    el: layer,
    add(onTap) {
      const e = el('div', 'mz-lbl');
      if (onTap) e.addEventListener('click', (ev) => { ev.stopPropagation(); onTap(); });
      e.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      layer.appendChild(e);
      let sig = '', shown = false, lx = NaN, ly = NaN, far = false;
      return {
        el: e,
        set(kind, content, s) {
          if (s === sig) return;
          sig = s;
          e.className = 'mz-lbl ' + (kind === 'full' ? 'bubble full' : kind);
          e.classList.toggle('far', far);
          e.replaceChildren(...content);
        },
        place(x, y, on, vicino = true) {
          if (!on) { if (shown) { e.style.transform = 'translate(-9999px,0)'; shown = false; } return; }
          if (far === vicino) { far = !vicino; e.classList.toggle('far', far); }
          const rx = Math.round(x), ry = Math.round(y);
          if (shown && rx === lx && ry === ly) return;
          shown = true; lx = rx; ly = ry;
          e.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%)`;
        },
        remove() { e.remove(); },
      };
    },
  };
}

/** Icone che volano dal punto (x, y) alla voce della barra; `done` quando arriva l'ultima. */
export function flyResources(root: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number } | null, id: ResId, amount: number, done: () => void): void {
  if (!to || amount <= 0 || typeof HTMLElement.prototype.animate !== 'function') { done(); return; }
  const n = Math.max(1, Math.min(8, Math.ceil(amount / 5)));
  let left = n;
  for (let i = 0; i < n; i++) {
    const f = el('div', 'mz-fly');
    f.appendChild(resIcon(id, 24));
    root.appendChild(f);
    const jx = ((i * 37) % 41) - 20, jy = ((i * 53) % 31) - 15; // sparpaglio fisso, niente Math.random
    const k = [
      { transform: `translate(${from.x - 12}px, ${from.y - 12}px) scale(1)` },
      { transform: `translate(${from.x - 12 + jx}px, ${from.y - 40 + jy}px) scale(1.25)`, offset: 0.25 },
      { transform: `translate(${to.x - 12}px, ${to.y - 12}px) scale(.8)` },
    ];
    const a = f.animate(k, { duration: 620, delay: i * 60, easing: 'ease-in', fill: 'both' });
    a.onfinish = a.oncancel = () => { f.remove(); suona('moneta', (n - left) / 7); if (--left === 0) done(); };
  }
}
