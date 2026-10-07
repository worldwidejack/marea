// Bussola dell'HUD («METE»): una riga per luogo (Casa, Porto, Regata…) con casella, icona, distanza e freccia. La freccia ha l'asta (un
// triangolo quasi equilatero non dice da che parte punta) e gira nello spazio dello schermo. L'intestazione comprime il menù (sul telefono
// parte chiuso, sul PC aperto); toccando una riga la meta si accende o si spegne, TUTTE/NESSUNA in un colpo. Con **una sola** meta accesa
// compare anche una freccia sullo schermo: sopra la meta se si vede, sul bordo verso di lei se no (`pointer.ts`, come la guida).
// Aperto/chiuso e mete spente restano su questo dispositivo (localStorage). `focus(id)` evidenzia la meta della guida «Primi passi».
import type * as THREE from 'three';
import { pixIcon } from './icons.ts';
import type { PixId } from './icons.ts';
import { pointerPose } from './pointer.ts';
import { PAL } from './style.ts';
import { registerStateProvider } from '../test/testapi.ts';

/** `show`: letto a ogni frame, false = la meta non c'è (es. i dungeon diversi dal prossimo da fare).
 *  `group`: chiave della casella condivisa da più mete che non si vedono mai insieme (i dungeon: spegnerne uno li spegne tutti). */
export type CompassTarget = { id: string; label: string; x: number; z: number; icon?: PixId; show?(): boolean; group?: string };
export type Compass = { update(me: { x: number; z: number }, cameraYaw: number, t?: number): void; focus(id: string | null): void; dispose(): void };

const NEAR_M = 30; // entro questa distanza la meta si vede già: niente freccia nella riga
const ARRIVO_M = 6; // freccia sullo schermo: arrivato, sparisce
const STORE = 'marea:mete';
/** Freccia a pixel con asta, punta in su a 0 rad (stesso disegno dell'HUD di gara). */
export const ARROW_SVG = '<svg viewBox="0 0 14 18" width="16" height="20" shape-rendering="crispEdges" style="display:block"><path d="M7 0L14 8H9.5V18H4.5V8H0Z" fill="currentColor" stroke="#23201F" stroke-width="1"/></svg>';

const P = PAL;
const BOX = `background:rgba(46,30,20,.88);border:2px solid ${P.legnoChiaro};box-shadow:0 3px 0 ${P.neroCaldo};color:${P.sabbiaChiara};font:bold 13px ui-monospace,monospace;`;
// sul telefono la bussola scende sotto chip del cantiere e toast, e perde i nomi (restano le icone); righe e bottoni alti 44 px per il pollice
const CSS = `
#compass { position: absolute; right: 8px; top: calc(max(6px, env(safe-area-inset-top)) + 56px); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: none; z-index: 13; }
#compass > * { pointer-events: auto; cursor: pointer; }
.mz-mete-head { display: flex; gap: 4px; }
.mz-mete-head button { ${BOX} display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 8px; margin: 0; }
.mz-mete-head button:focus { outline: none; } .mz-mete-head button:focus-visible { outline: 3px solid ${P.giallo}; outline-offset: 2px; }
.mz-mete-head button:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-mete-head .tutte { display: none; font-size: 12px; }
#compass.open .mz-mete-head .tutte { display: flex; }
#compass.open .mz-mete-sum, #compass:not(.open) .mz-mete-sum:empty { display: none; }
.mz-mete-sum { display: flex; align-items: center; gap: 6px; }
.mz-mete-chev { color: ${P.giallo}; }
.mz-mete-row { align-items: center; gap: 6px; min-height: 32px; padding: 2px 8px 2px 6px; ${BOX} }
.mz-mete-row.off { opacity: .55; }
.mz-mete-row.off .mz-mete-arr { visibility: hidden; }
.mz-mete-box { width: 12px; height: 12px; box-sizing: border-box; border: 2px solid ${P.sabbiaChiara}; flex: none; }
.mz-mete-row:not(.off) .mz-mete-box { background: ${P.giallo}; border-color: ${P.giallo}; box-shadow: inset 0 0 0 2px ${P.ombraCalda}; }
.mz-mete-arr { display: inline-block; color: ${P.giallo}; width: 16px; height: 20px; }
@media (max-width: 699px) {
  #compass { top: calc(max(6px, env(safe-area-inset-top)) + 168px); }
  #compass .nome, #compass .mz-mete-lbl { display: none; }
  .mz-mete-head button { min-height: 44px; min-width: 44px; justify-content: center; }
  .mz-mete-row { min-height: 40px; }
}
#mzMetePtr { position: absolute; left: 0; top: 0; display: none; z-index: 12; pointer-events: none !important; }
#mzMetePtr.on { display: block; }
#mzMetePtr .mz-mete-parr { position: absolute; left: -16px; top: -20px; width: 32px; height: 40px; color: ${P.sabbiaChiara}; filter: drop-shadow(0 3px 0 ${P.neroCaldo}); }
#mzMetePtr .mz-mete-parr svg { width: 32px; height: 40px; }
#mzMetePtr .mz-mete-tag { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 4px; padding: 1px 6px; white-space: nowrap; ${BOX} border-color: ${P.sabbiaChiara}; font-size: 12px; }
#ui.mz-racing #mzMetePtr, body.mz-sotto #mzMetePtr { visibility: hidden; }
`;

type Saved = { open?: boolean; off?: string[] };
const load = (): Saved => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const save = (s: Saved) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage bloccato: si riparte coi valori di base */ } };
const div = (cls: string, text?: string) => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; return e; };
const span = (cls: string, text?: string) => { const e = document.createElement('span'); e.className = cls; if (text) e.textContent = text; return e; };
const arrowEl = (cls: string) => { const a = span(cls); a.innerHTML = ARROW_SVG; return a; }; // SVG statico
/** Niente click «fantasma» sul mondo sotto (joystick, tocco sul lotto). */
const guard = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };

export function createCompass(o: {
  root: HTMLElement; targets: CompassTarget[];
  /** Per la freccia sullo schermo (una sola meta accesa). Senza camera/tela la freccia non c'è. */
  camera?: THREE.Camera; canvas?: HTMLCanvasElement; groundY?(x: number, z: number): number;
  /** Pannelli aperti, gara, dungeon: la freccia sullo schermo si toglie. */
  hidden?(): boolean;
}): Compass {
  if (!document.getElementById('mz-compass-style')) { const st = document.createElement('style'); st.id = 'mz-compass-style'; st.textContent = CSS; document.head.appendChild(st); }
  const saved = load();
  let open = saved.open ?? !matchMedia('(max-width: 699px)').matches; // telefono: chiuso, PC: aperto
  const off = new Set(saved.off ?? []);
  const keyOf = (t: CompassTarget) => t.group ?? t.id;

  const box = div('mz');
  box.id = 'compass';
  guard(box);
  // intestazione: METE (apre/chiude, chiusa riassume) · TUTTE · NESSUNA
  const head = div('mz-mete-head');
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'mzMete'; toggle.className = 'mz';
  const sum = span('mz-mete-sum'), chev = span('mz-mete-chev');
  toggle.append(pixIcon('mete', 16), span('mz-mete-lbl', 'METE'), sum, chev);
  const allBtn = (act: 'tutte' | 'nessuna', text: string) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mz tutte'; b.dataset['act'] = act; b.textContent = text;
    b.addEventListener('click', (e) => { e.preventDefault(); b.blur(); if (act === 'tutte') off.clear(); else for (const r of rows) off.add(keyOf(r.t)); store(); });
    return b;
  };
  toggle.addEventListener('click', (e) => { e.preventDefault(); toggle.blur(); open = !open; store(); });
  head.append(toggle, allBtn('tutte', 'TUTTE'), allBtn('nessuna', 'NESSUNA'));
  box.appendChild(head);

  const rows = o.targets.map((t) => {
    const row = div('mz-mete-row');
    row.dataset['id'] = t.id;
    row.setAttribute('role', 'checkbox');
    row.style.display = 'none';
    const arrow = arrowEl('mz-mete-arr');
    const text = span('');
    row.append(span('mz-mete-box'), ...(t.icon ? [pixIcon(t.icon, 16)] : []), span('nome', t.label), text, arrow);
    row.addEventListener('click', () => { const k = keyOf(t); if (off.has(k)) off.delete(k); else off.add(k); store(); });
    box.appendChild(row);
    return { t, row, arrow, text, shown: '', ang: 0, d: 0 };
  });
  o.root.appendChild(box);

  // freccia sullo schermo (una sola meta accesa): freccia + cartellino con icona e distanza
  const ptr = div(''); ptr.id = 'mzMetePtr';
  const parr = arrowEl('mz-mete-parr'), tag = span('mz-mete-tag'), tagText = span('');
  ptr.append(parr, tag);
  o.root.appendChild(ptr);
  let ptrFor = '', ptrMode: 'off' | 'vista' | 'bordo' = 'off';

  let focused: string | null = null, sumFor = '';
  const store = () => { save({ open, off: [...off] }); paint(); };
  /** Classi che cambiano solo con i clic (aperto, caselle). */
  const paint = () => {
    box.classList.toggle('open', open);
    chev.textContent = open ? '▾' : '▸';
    toggle.setAttribute('aria-expanded', String(open));
    for (const r of rows) { const on = !off.has(keyOf(r.t)); r.row.classList.toggle('off', !on); r.row.setAttribute('aria-checked', String(on)); }
  };
  paint();

  const place = (r: (typeof rows)[number], t: number) => {
    const cam = o.camera, canvas = o.canvas;
    if (!cam || !canvas || r.d < ARRIVO_M || o.hidden?.() || (focused === r.t.id && document.querySelector('#mzGuidaPtr.on'))) { ptr.classList.remove('on'); ptrMode = 'off'; return; } // la guida punta già lì
    if (ptrFor !== r.t.id) { ptrFor = r.t.id; tag.replaceChildren(...(r.t.icon ? [pixIcon(r.t.icon, 16)] : []), tagText); }
    tagText.textContent = `${Math.round(r.d)} m`;
    const cr = canvas.getBoundingClientRect();
    const phone = cr.width < 700, M = 44, TOP = 118;
    // in basso: sopra joystick e A/B (telefono) e sopra la scheda della guida quando sta in basso
    let BOT = cr.height - (phone ? 200 : M);
    const g = document.querySelector('#mzGuida.on')?.getBoundingClientRect();
    if (g && g.top - cr.top > cr.height / 2) BOT = Math.min(BOT, g.top - cr.top - 12);
    const y = (o.groundY?.(r.t.x, r.t.z) ?? 0) + 2.5;
    const p = pointerPose({ camera: cam, canvas, root: o.root, target: { x: r.t.x, y, z: r.t.z }, top: TOP, bottom: BOT, m: M });
    let x = p.x, yy = p.y, ang = p.ang, tx: number, ty: number;
    if (p.inView) { yy = p.y - 32 - Math.abs(Math.sin(t * 4)) * 10; tx = 0; ty = -40; } // sopra la meta, punta giù e rimbalza; cartellino sopra
    else { // sul bordo; cartellino dalla parte del centro, staccato dalla freccia (larghezza stimata: icona + cifre)
      yy = Math.min(p.y, BOT - 20);
      const tw = 40 + tagText.textContent.length * 7.5;
      tx = -Math.sin(ang) * (24 + tw / 2); ty = Math.cos(ang) * 36;
    }
    if (!p.inView) x = Math.max(M, Math.min(cr.width - M, x));
    ptr.style.transform = `translate(${Math.round(p.ox + x)}px, ${Math.round(p.oy + yy)}px)`;
    parr.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    tag.style.transform = `translate(calc(${Math.round(tx)}px - 50%), calc(${Math.round(ty)}px - 50%))`;
    ptr.classList.add('on'); ptrMode = p.inView ? 'vista' : 'bordo';
  };

  registerStateProvider('compass', () => {
    const vis = rows.filter((r) => r.t.show?.() ?? true), on = vis.filter((r) => !off.has(keyOf(r.t)));
    return { open, shown: vis.map((r) => r.t.id), on: on.map((r) => r.t.id), single: on.length === 1 ? on[0]!.t.id : null, pointer: ptrMode };
  });

  return {
    update(me, yaw, t = 0) {
      // stessa convenzione di input.ts: su schermo «su» = (−sin yaw, −cos yaw), «destra» = (cos yaw, −sin yaw) in assi mondo
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const on: (typeof rows)[number][] = [];
      for (const r of rows) {
        const there = r.t.show?.() ?? true;
        const dx = r.t.x - me.x, dz = r.t.z - me.z;
        r.d = Math.hypot(dx, dz);
        r.ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        if (there && !off.has(keyOf(r.t))) on.push(r);
        // aperto: tutte le mete (le spente sbiadite, per riaccenderle); chiuso: nessuna riga (l'intestazione riassume)
        const show = there && open ? 'flex' : 'none';
        if (show !== r.shown) { r.row.style.display = show; r.shown = show; }
        if (show === 'none') continue;
        const near = r.d <= NEAR_M;
        r.arrow.style.visibility = near ? 'hidden' : '';
        r.arrow.style.transform = `rotate(${r.ang.toFixed(3)}rad)`;
        r.text.textContent = near ? 'qui' : `${Math.round(r.d)} m`;
      }
      // chiuso: una meta accesa = la sua icona, distanza e freccia nell'intestazione; più mete = quante sono
      const one = on.length === 1 ? on[0]! : null;
      const key = open ? 'open' : one ? 'one:' + one.t.id : 'n:' + on.length;
      if (key !== sumFor) {
        sumFor = key;
        if (open || on.length === 0) sum.replaceChildren();
        else if (one) sum.replaceChildren(...(one.t.icon ? [pixIcon(one.t.icon, 16)] : []), span('mz-mete-d'), arrowEl('mz-mete-arr'));
        else sum.replaceChildren(span('', `· ${on.length}`));
      }
      if (one && !open) {
        const d = sum.querySelector<HTMLElement>('.mz-mete-d'), a = sum.querySelector<HTMLElement>('.mz-mete-arr');
        if (d) d.textContent = one.d <= NEAR_M ? 'qui' : `${Math.round(one.d)} m`;
        if (a) { a.style.transform = `rotate(${one.ang.toFixed(3)}rad)`; a.style.visibility = one.d <= NEAR_M ? 'hidden' : ''; }
      }
      if (one) place(one, t); else if (ptrMode !== 'off') { ptr.classList.remove('on'); ptrMode = 'off'; }
    },
    focus(id) {
      if (id === focused) return;
      focused = id;
      for (const r of rows) r.row.style.borderColor = r.t.id === id ? P.giallo : P.legnoChiaro;
    },
    dispose() { box.remove(); ptr.remove(); },
  };
}
