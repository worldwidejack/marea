// Bussola dell'HUD («METE»): una riga per luogo (Casa, Porto, Regata…) con casella, icona, distanza e freccia. La freccia ha l'asta (un
// triangolo quasi equilatero non dice da che parte punta) e gira nello spazio dello schermo. L'intestazione comprime il menù (sul telefono
// parte chiuso, sul PC aperto); toccando una riga la meta si accende o si spegne, TUTTE/NESSUNA in un colpo. Con **una sola** meta accesa
// compare anche una freccia sullo schermo: sopra la meta se si vede, sul bordo verso di lei se no (`pointer.ts`, come la guida).
// Le mete con la stessa `sezione` (Porto: Mercante, Bacheca, Scacchi, Consegne, Ingorgo; Isole a tema) stanno in **una riga sola** che si
// apre con ▸ (una sezione aperta alla volta); la casella della sezione accende o spegne tutte le sue mete, distanza e freccia sono della meta
// che dà il nome alla sezione (il Porto) o della più vicina accesa. Una sezione con una meta sola si vede come una riga normale. L'elenco ha un'altezza massima (sopra minimappa e bottoni sul
// PC, sopra il bottone GIOCA al centro sul telefono) e oltre quella scorre: non copre mai il resto dell'interfaccia (test m3_interfaccia).
// Aperto/chiuso, sezione aperta e mete spente restano su questo dispositivo (localStorage). `focus(id)` evidenzia la meta della guida.
import type * as THREE from 'three';
import { pixIcon } from './icons.ts';
import type { PixId } from './icons.ts';
import { pointerPose } from './pointer.ts';
import { PAL } from './style.ts';
import { registerStateProvider } from '../test/testapi.ts';

/** `show`: letto a ogni frame, false = la meta non c'è (es. i dungeon diversi dal prossimo da fare).
 *  `group`: chiave della casella condivisa da più mete che non si vedono mai insieme (i dungeon: spegnerne uno li spegne tutti).
 *  `sezione`: id di una `CompassSezione`: la meta sta nella riga richiudibile di quella sezione. */
export type CompassTarget = { id: string; label: string; x: number; z: number; icon?: PixId; show?(): boolean; group?: string; sezione?: string };
export type CompassSezione = { id: string; nome: string; icon: PixId };
export type Compass = { update(me: { x: number; z: number }, cameraYaw: number, t?: number): void; focus(id: string | null): void; dispose(): void };

const NEAR_M = 30; // entro questa distanza la meta si vede già: niente freccia nella riga
const ARRIVO_M = 6; // freccia sullo schermo: arrivato, sparisce
const STORE = 'marea:mete';
/** Freccia a pixel con asta, punta in su a 0 rad (stesso disegno dell'HUD di gara). */
export const ARROW_SVG = '<svg viewBox="0 0 14 18" width="16" height="20" shape-rendering="crispEdges" style="display:block"><path d="M7 0L14 8H9.5V18H4.5V8H0Z" fill="currentColor" stroke="#23201F" stroke-width="1"/></svg>';

const P = PAL;
const BOX = `background:rgba(46,30,20,.88);border:2px solid ${P.legnoChiaro};box-shadow:0 3px 0 ${P.neroCaldo};color:${P.sabbiaChiara};font:bold 13px ui-monospace,monospace;`;
// #compass ha alto e basso fissati: l'elenco (flex, min-height 0) si stringe e scorre invece di scendere sopra minimappa, A/B e GIOCA.
// PC: sotto la barra in alto, sopra la minimappa (in basso a destra, 148 px a 136 px dal fondo). Telefono: sotto la minimappa (in alto a
// destra, 92 px a 58 px dall'alto), fino al 60 % dell'altezza dove stanno i bottoni GIOCA / PESCA / Porto; perde i nomi (restano le icone).
const CSS = `
#compass { position: absolute; right: 8px; top: calc(max(6px, env(safe-area-inset-top)) + 56px); bottom: calc(env(safe-area-inset-bottom, 0px) + 294px); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: none; z-index: 13; }
#compass > * { pointer-events: auto; cursor: pointer; }
.mz-mete-head { display: flex; gap: 4px; flex: none; }
.mz-mete-head button { ${BOX} display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 8px; margin: 0; }
.mz-mete-head button:focus { outline: none; } .mz-mete-head button:focus-visible { outline: 3px solid ${P.giallo}; outline-offset: 2px; }
.mz-mete-head button:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-mete-head .tutte { display: none; font-size: 12px; }
#compass.open .mz-mete-head .tutte { display: flex; }
#compass.open .mz-mete-sum, #compass:not(.open) .mz-mete-sum:empty { display: none; }
.mz-mete-sum { display: flex; align-items: center; gap: 6px; }
.mz-mete-chev { color: ${P.giallo}; }
.mz-mete-list { display: none; flex-direction: column; align-items: stretch; gap: 4px; min-height: 0; max-width: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; touch-action: pan-y; padding: 0 0 3px; scrollbar-width: thin; scrollbar-color: ${P.giallo} ${P.ombraCalda}; }
#compass.open .mz-mete-list { display: flex; }
.mz-mete-row { display: flex; align-items: center; gap: 6px; min-height: 32px; box-sizing: border-box; flex: none; padding: 2px 8px 2px 6px; ${BOX} }
.mz-mete-row .nome { flex: 1; white-space: nowrap; }
.mz-mete-row .mz-mete-dist { white-space: nowrap; }
.mz-mete-row.figlio { margin-left: 14px; border-color: ${P.legno}; }
.mz-mete-row.off { opacity: .55; }
.mz-mete-row.off .mz-mete-arr { visibility: hidden; }
.mz-mete-box { width: 12px; height: 12px; box-sizing: border-box; border: 2px solid ${P.sabbiaChiara}; flex: none; }
.mz-mete-row:not(.off) .mz-mete-box { background: ${P.giallo}; border-color: ${P.giallo}; box-shadow: inset 0 0 0 2px ${P.ombraCalda}; }
.mz-mete-row.part .mz-mete-box { position: relative; border-color: ${P.giallo}; }
.mz-mete-row.part .mz-mete-box::after { content: ''; position: absolute; left: 1px; right: 1px; top: 3px; height: 2px; background: ${P.giallo}; }
.mz-mete-row.sez .mz-mete-apri { flex: none; display: flex; align-items: center; justify-content: center; align-self: stretch; min-width: 30px; margin: -2px -8px -2px 2px; border-left: 2px solid ${P.legno}; color: ${P.giallo}; font-size: 12px; }
.mz-mete-row.sez.aperta { border-color: ${P.sabbia}; }
.mz-mete-arr { display: inline-block; color: ${P.giallo}; width: 16px; height: 20px; flex: none; }
@media (max-width: 699px) {
  #compass { top: calc(max(8px, env(safe-area-inset-top)) + 158px); bottom: calc(40% + 16px); }
  #compass .nome, #compass .mz-mete-lbl { display: none; }
  .mz-mete-head button { min-height: 44px; min-width: 44px; justify-content: center; }
  .mz-mete-row { min-height: 40px; }
  .mz-mete-row.sez .mz-mete-apri { min-width: 36px; }
  .mz-mete-row.figlio { margin-left: 10px; }
}
#mzMetePtr { position: absolute; left: 0; top: 0; display: none; z-index: 12; pointer-events: none !important; }
#mzMetePtr.on { display: block; }
#mzMetePtr .mz-mete-parr { position: absolute; left: -16px; top: -20px; width: 32px; height: 40px; color: ${P.sabbiaChiara}; filter: drop-shadow(0 3px 0 ${P.neroCaldo}); }
#mzMetePtr .mz-mete-parr svg { width: 32px; height: 40px; }
#mzMetePtr .mz-mete-tag { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 4px; padding: 1px 6px; white-space: nowrap; ${BOX} border-color: ${P.sabbiaChiara}; font-size: 12px; }
#ui.mz-racing #mzMetePtr, body.mz-sotto #mzMetePtr { visibility: hidden; }
`;

type Saved = { open?: boolean; off?: string[]; sez?: string | null };
const load = (): Saved => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const save = (s: Saved) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage bloccato: si riparte coi valori di base */ } };
const div = (cls: string, text?: string) => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; return e; };
const span = (cls: string, text?: string) => { const e = document.createElement('span'); e.className = cls; if (text) e.textContent = text; return e; };
const arrowEl = (cls: string) => { const a = span(cls); a.innerHTML = ARROW_SVG; return a; }; // SVG statico
/** Niente click «fantasma» sul mondo sotto (joystick, tocco sul lotto). */
const guard = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };
const distText = (d: number) => (d <= NEAR_M ? 'qui' : `${Math.round(d)} m`);

type Row = { t: CompassTarget; row: HTMLElement; arrow: HTMLElement; text: HTMLElement; shown: string; ang: number; d: number; sez: Sez | null };
type Sez = { s: CompassSezione; row: HTMLElement; arrow: HTMLElement; text: HTMLElement; chev: HTMLElement; members: Row[]; shown: string; mode: string; sig: string };

export function createCompass(o: {
  root: HTMLElement; targets: CompassTarget[];
  /** Sezioni richiudibili (in ordine di comparsa: la riga sta dove compare la prima delle sue mete). */
  sezioni?: CompassSezione[];
  /** Per la freccia sullo schermo (una sola meta accesa). Senza camera/tela la freccia non c'è. */
  camera?: THREE.Camera; canvas?: HTMLCanvasElement; groundY?(x: number, z: number): number;
  /** Pannelli aperti, gara, dungeon: la freccia sullo schermo si toglie. */
  hidden?(): boolean;
}): Compass {
  if (!document.getElementById('mz-compass-style')) { const st = document.createElement('style'); st.id = 'mz-compass-style'; st.textContent = CSS; document.head.appendChild(st); }
  const saved = load();
  let open = saved.open ?? !matchMedia('(max-width: 699px)').matches; // telefono: chiuso, PC: aperto
  let aperta: string | null = typeof saved.sez === 'string' ? saved.sez : null; // sezione aperta (una alla volta)
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
  const list = div('mz-mete-list');
  box.append(head, list);

  // righe: una per meta; le mete di una sezione subito dopo la riga della sezione (dove compare la prima), rientrate
  const sezDef = new Map((o.sezioni ?? []).map((s) => [s.id, s]));
  const sezs = new Map<string, Sez>();
  const rows: Row[] = [];
  const mkRow = (t: CompassTarget, sez: Sez | null): Row => {
    const row = div('mz-mete-row' + (sez ? ' figlio' : ''));
    row.dataset['id'] = t.id;
    row.setAttribute('role', 'checkbox');
    row.style.display = 'none';
    const arrow = arrowEl('mz-mete-arr'), text = span('mz-mete-dist');
    row.append(span('mz-mete-box'), ...(t.icon ? [pixIcon(t.icon, 16)] : []), span('nome', t.label), text, arrow);
    row.addEventListener('click', () => { const k = keyOf(t); if (off.has(k)) off.delete(k); else off.add(k); store(); });
    return { t, row, arrow, text, shown: '', ang: 0, d: 0, sez };
  };
  const mkSez = (s: CompassSezione): Sez => {
    const row = div('mz-mete-row sez');
    row.dataset['sez'] = s.id;
    row.setAttribute('role', 'checkbox');
    row.style.display = 'none';
    const arrow = arrowEl('mz-mete-arr'), text = span('mz-mete-dist'), chevS = span('mz-mete-apri');
    chevS.setAttribute('role', 'button'); chevS.dataset['act'] = 'apri'; chevS.title = 'Apri la sezione';
    row.append(span('mz-mete-box'), pixIcon(s.icon, 16), span('nome', s.nome), text, arrow, chevS);
    const z: Sez = { s, row, arrow, text, chev: chevS, members: [], shown: '', mode: '', sig: '' };
    // la casella (tutta la riga tranne ▸): accese tutte → spente tutte, altrimenti accese tutte
    row.addEventListener('click', () => {
      const vis = z.members.filter((r) => r.t.show?.() ?? true), tutte = vis.every((r) => !off.has(keyOf(r.t)));
      for (const r of vis) { if (tutte) off.add(keyOf(r.t)); else off.delete(keyOf(r.t)); }
      store();
    });
    chevS.addEventListener('click', (e) => { e.stopPropagation(); aperta = aperta === s.id ? null : s.id; store(); });
    return z;
  };
  for (const t of o.targets) {
    const def = t.sezione ? sezDef.get(t.sezione) : undefined;
    let z: Sez | null = null;
    if (def) {
      z = sezs.get(def.id) ?? null;
      if (!z) { z = mkSez(def); sezs.set(def.id, z); list.appendChild(z.row); }
    }
    const r = mkRow(t, z);
    if (z) {
      // dopo l'ultima meta già nella sezione (o subito dopo la sua riga)
      const after = z.members[z.members.length - 1]?.row ?? z.row;
      after.after(r.row);
      z.members.push(r);
    } else list.appendChild(r.row);
    rows.push(r);
  }
  o.root.appendChild(box);

  // freccia sullo schermo (una sola meta accesa): freccia + cartellino con icona e distanza
  const ptr = div(''); ptr.id = 'mzMetePtr';
  const parr = arrowEl('mz-mete-parr'), tag = span('mz-mete-tag'), tagText = span('');
  ptr.append(parr, tag);
  o.root.appendChild(ptr);
  let ptrFor = '', ptrMode: 'off' | 'vista' | 'bordo' = 'off';

  let focused: string | null = null, sumFor = '';
  const store = () => { save({ open, off: [...off], sez: aperta }); paint(); };
  /** Classi che cambiano solo con i clic (aperto, caselle, sezione aperta). */
  const paint = () => {
    box.classList.toggle('open', open);
    chev.textContent = open ? '▾' : '▸';
    toggle.setAttribute('aria-expanded', String(open));
    for (const r of rows) { const on = !off.has(keyOf(r.t)); r.row.classList.toggle('off', !on); r.row.setAttribute('aria-checked', String(on)); }
    for (const z of sezs.values()) {
      const a = aperta === z.s.id;
      z.row.classList.toggle('aperta', a); z.chev.textContent = a ? '▾' : '▸'; z.chev.setAttribute('aria-expanded', String(a));
      z.sig = ''; // casella della sezione: si rifà al prossimo update
    }
    paintFocus();
  };
  /** Bordo giallo sulla meta della guida; se sta in una sezione chiusa, sulla riga della sezione. */
  const paintFocus = () => {
    const r = rows.find((x) => x.t.id === focused);
    const onSez = r?.sez && aperta !== r.sez.s.id && r.sez.mode === 'sez' ? r.sez : null;
    for (const x of rows) x.row.style.borderColor = x === r && !onSez ? P.giallo : '';
    for (const z of sezs.values()) z.row.style.borderColor = z === onSez ? P.giallo : '';
  };
  paint();

  const place = (r: Row, t: number) => {
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

  const showRow = (el: { row: HTMLElement; shown: string }, show: boolean) => {
    const v = show ? 'flex' : 'none';
    if (v !== el.shown) { el.row.style.display = v; el.shown = v; }
  };
  const arrowTo = (el: { arrow: HTMLElement; text: HTMLElement }, d: number, ang: number) => {
    const near = d <= NEAR_M;
    el.arrow.style.visibility = near ? 'hidden' : '';
    el.arrow.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    el.text.textContent = distText(d);
  };

  registerStateProvider('compass', () => {
    const vis = rows.filter((r) => r.t.show?.() ?? true), on = vis.filter((r) => !off.has(keyOf(r.t)));
    return {
      open, shown: vis.map((r) => r.t.id), on: on.map((r) => r.t.id), single: on.length === 1 ? on[0]!.t.id : null, pointer: ptrMode, aperta,
      sezioni: [...sezs.values()].map((z) => ({ id: z.s.id, mode: z.mode, mete: z.members.filter((r) => r.t.show?.() ?? true).map((r) => r.t.id) })),
    };
  });

  return {
    update(me, yaw, t = 0) {
      // stessa convenzione di input.ts: su schermo «su» = (−sin yaw, −cos yaw), «destra» = (cos yaw, −sin yaw) in assi mondo
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const on: Row[] = [];
      for (const r of rows) {
        const dx = r.t.x - me.x, dz = r.t.z - me.z;
        r.d = Math.hypot(dx, dz);
        r.ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        if ((r.t.show?.() ?? true) && !off.has(keyOf(r.t))) on.push(r);
      }
      // sezioni: nessuna meta = niente; una = riga normale (non rientrata); più = riga della sezione, mete sotto solo se aperta
      let focusDirty = false;
      for (const z of sezs.values()) {
        const vis = z.members.filter((r) => r.t.show?.() ?? true);
        const mode = vis.length === 0 ? 'nulla' : vis.length === 1 ? 'una' : 'sez';
        if (mode !== z.mode) {
          z.mode = mode; focusDirty = true;
          for (const r of z.members) r.row.classList.toggle('figlio', mode === 'sez');
        }
        const n = vis.filter((r) => !off.has(keyOf(r.t))).length, sig = `${n}/${vis.length}`;
        if (sig !== z.sig) { // casella: piena (tutte accese), a metà (alcune), vuota (nessuna)
          z.sig = sig;
          z.row.classList.toggle('off', n === 0); z.row.classList.toggle('part', n > 0 && n < vis.length);
          z.row.setAttribute('aria-checked', n === 0 ? 'false' : n === vis.length ? 'true' : 'mixed');
        }
        showRow(z, open && mode === 'sez');
        if (!open || mode !== 'sez') continue;
        // distanza e freccia: la meta che dà il nome alla sezione (il Porto) se è accesa, se no la più vicina tra le accese (se non ce n'è,
        // la più vicina e basta, senza freccia)
        const acc = vis.filter((r) => !off.has(keyOf(r.t))), pool = acc.length ? acc : vis;
        const best = acc.find((r) => r.t.id === z.s.id) ?? pool.reduce((a, b) => (b.d < a.d ? b : a));
        arrowTo(z, best.d, best.ang);
      }
      if (focusDirty) paintFocus();
      for (const r of rows) {
        const there = r.t.show?.() ?? true;
        // aperto: tutte le mete (le spente sbiadite, per riaccenderle) tranne quelle di una sezione chiusa; chiuso: nessuna riga
        const show = there && open && (!r.sez || r.sez.mode !== 'sez' || aperta === r.sez.s.id);
        showRow(r, show);
        if (show) arrowTo(r, r.d, r.ang);
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
        if (d) d.textContent = distText(one.d);
        if (a) { a.style.transform = `rotate(${one.ang.toFixed(3)}rad)`; a.style.visibility = one.d <= NEAR_M ? 'hidden' : ''; }
      }
      if (one) place(one, t); else if (ptrMode !== 'off') { ptr.classList.remove('on'); ptrMode = 'off'; }
    },
    focus(id) {
      if (id === focused) return;
      focused = id;
      paintFocus();
    },
    dispose() { box.remove(); ptr.remove(); },
  };
}
