// Emote (F3-emote-feed, CONTRACTS §13; 8 emote e ruota dal #90): 1-8 (o la riga del bottone #mzEmoteBtn sul telefono) → fumetto a pixel
// sopra la propria testa e messaggio `emote` in rete; chi lo riceve disegna il fumetto sopra il peer `from`. Il fumetto è DOM (niente clip in
// chr_base: vedi tests/out/richieste/f3-emote.md), proiettato ogni frame con la camera come le etichette del lotto; fuori schermo o dietro la
// camera sparisce. Le 4 emote nuove fanno anche un gesto del corpo (saltello/giro, niente clip nuove). Ruota rapida a 8 spicchi: tocco lungo
// su #mzEmoteBtn (trascina e rilascia) o il bottone «altre» della riga; sul PC il tasto G (tenuto: rilascia sullo spicchio; premuto: clic o 1-8).
// Pausa 1,5 s nel client (la Zone tiene 800 ms per socket); niente emote in gara o con un pannello aperto (world.frozen).
import * as THREE from 'three';
import type { Camera } from 'three';
import { EMOTE_IDS, type EmoteId } from '@marea/protocol';
import type { GameWorld } from './world.ts';
import { PAL, el } from '../ui/style.ts';
import { topButton } from '../ui/topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { emoteIcon } from './emote_icone.ts';
export { emoteIcon }; // la usano anche feed e libro degli ospiti
import { suona } from '../audio/ponte.ts';

export type Emotes = {
  play(id: EmoteId): boolean; update(dt: number): void; dispose(): void;
  /** Ruota rapida (#90): aperta attorno al cursore (PC) o al pollice; `toggleWheel` è il tasto G. false se non si può (gara, pannello aperto). */
  openWheel(x?: number, y?: number, via?: WheelVia): boolean; closeWheel(): void; toggleWheel(): boolean; readonly wheelOpen: boolean;
};
type WheelVia = 'tasto' | 'tocco' | 'test';
export const EMOTE_COOLDOWN_S = 1.5;
export const EMOTE_SHOW_S = 2.5;
const FADE_S = 0.3, TAIL_PX = 8;
const TILE = 56, RING = 84, WHEEL_R = 120; // ruota: spicchio 56 px (pollice), centri a 84 px dal mezzo, ottagono di sfondo largo 240
const DEAD = 30, MOVED = 12, HOLD_MS = 350, AVATAR_GAP = 8; // px zona morta al centro, px di trascinamento, tocco lungo, aria attorno all'avatar

export const EMOTE_WORDS: Record<EmoteId, string> = {
  saluto: 'Ciao!', esulta: 'Evvai!', ride: 'Ah ah!', no: 'No no', applauso: 'Bravo!', cuore: 'Grazie!', sorpresa: 'Oh!', balla: 'Si balla!',
};
/** Ordine dei tasti 1-8 e degli spicchi della ruota (da mezzogiorno in senso orario): lo stesso di avatar.json `emote`. */
const EMOTE_ORDER: readonly EmoteId[] = EMOTE_IDS;
/** La riga del telefono resta quella di sempre (le prime 4) + il bottone «altre» che apre la ruota. */
const ROW_IDS: readonly EmoteId[] = EMOTE_ORDER.slice(0, 4);
/** Gesto del corpo delle emote nuove: `hops` saltelli alti `h` m in `dur` s, giro `spin` rad, dondolio `wob` rad. A scatti (15 fps, PS1). */
const GESTI: Partial<Record<EmoteId, { dur: number; hops: number; h: number; spin: number; wob: number }>> = {
  applauso: { dur: 0.6, hops: 2, h: 0.1, spin: 0, wob: 0 },
  cuore: { dur: 0.7, hops: 1, h: 0.08, spin: 0, wob: 0.3 },
  sorpresa: { dur: 0.4, hops: 1, h: 0.26, spin: 0, wob: 0 },
  balla: { dur: 1.0, hops: 4, h: 0.07, spin: Math.PI * 2, wob: 0 },
};
const isEmote = (v: unknown): v is EmoteId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(EMOTE_WORDS, v);

const P = PAL;
const CSS = `
#mzEmotes { position: absolute; inset: 0; overflow: hidden; z-index: 6; pointer-events: none !important; }
.mz-emote { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; }
.mz-emote .mz-emote-b { position: relative; display: flex; align-items: center; gap: 6px; padding: 3px 9px 3px 5px; background: rgba(46,30,20,.94); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; white-space: nowrap; transform-origin: 50% 100%; animation: mzEmPop .3s steps(5) both, mzEmBob .5s steps(2) .3s 4 alternate; }
.mz-emote[data-who="me"] .mz-emote-b { border-color: ${P.giallo}; }
.mz-emote .mz-emote-b::before, .mz-emote .mz-emote-b::after { content: ''; position: absolute; left: 50%; background: ${P.neroCaldo}; }
.mz-emote .mz-emote-b::before { bottom: -6px; width: 10px; height: 4px; margin-left: -5px; }
.mz-emote .mz-emote-b::after { bottom: -${TAIL_PX + 2}px; width: 4px; height: 4px; margin-left: -2px; }
@keyframes mzEmPop { 0% { transform: scale(.3); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes mzEmBob { from { transform: translateY(0); } to { transform: translateY(-3px); } }
#mzEmoteRow { position: absolute; z-index: 15; display: none; gap: 6px; padding: 6px; background: rgba(46,30,20,.94); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
#mzEmoteRow.on { display: flex; }
.mz-emote-pick, .mz-emote-more { width: 52px; height: 52px; flex: none; padding: 0; display: flex; align-items: center; justify-content: center; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; cursor: pointer; }
.mz-emote-pick:active:not(:disabled), .mz-emote-more:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-emote-pick:disabled { border-color: ${P.pietraScura}; cursor: default; }
.mz-emote-pick:disabled .mz-ico { opacity: .5; }
#mzEmoteBtn { touch-action: none; -webkit-touch-callout: none; }
#mzEmoteWheel { position: absolute; inset: 0; z-index: 16; display: none; touch-action: none; cursor: default; }
#mzEmoteWheel.on { display: block; }
.mz-wheel { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.mz-wheel-bg { position: absolute; left: -${WHEEL_R}px; top: -${WHEEL_R}px; width: ${WHEEL_R * 2}px; height: ${WHEEL_R * 2}px; background: rgba(46,30,20,.62); clip-path: polygon(29% 0, 71% 0, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0 71%, 0 29%); pointer-events: none; }
.mz-wheel-t { position: absolute; width: ${TILE}px; height: ${TILE}px; margin: -${TILE / 2}px 0 0 -${TILE / 2}px; display: flex; align-items: center; justify-content: center; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; box-sizing: border-box; pointer-events: none; }
.mz-wheel-t.sel { background: ${P.legno}; border-color: ${P.giallo}; transform: scale(1.14); z-index: 1; }
.mz-wheel-t.off { border-color: ${P.pietraScura}; } .mz-wheel-t.off .mz-ico { opacity: .5; }
.mz-wheel-t i { position: absolute; left: 2px; top: 0; font: bold 11px ui-monospace, Menlo, monospace; font-style: normal; color: ${P.sabbia}; }
.mz-wheel-c { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); padding: 2px 6px; background: rgba(46,30,20,.94); border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; white-space: nowrap; pointer-events: none; }
.mz-wheel-c:empty { display: none; }
`;
let styled = false;
function injectStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style'); s.id = 'mz-emote-style'; s.textContent = CSS; document.head.appendChild(s);
}

type Bubble = { who: string; id: EmoteId; el: HTMLElement; born: number; x: number; y: number; on: boolean };
type Gesto = { id: EmoteId; born: number };
type Wheel = { open: boolean; x: number; y: number; sel: number | null; via: WheelVia; at: number; moved: boolean; from: { x: number; y: number } };

export function createEmotes(o: { world: GameWorld; camera: Camera; canvas: HTMLCanvasElement; root: HTMLElement }): Emotes {
  injectStyle();
  let readyAt = 0, last: { id: EmoteId; at: number } | null = null; // pausa a orologio (non a dt: una scheda dietro non ha frame)
  const cooldownS = () => Math.max(0, (readyAt - performance.now()) / 1000);
  const blocked = () => o.world.race.on || o.world.frozen;
  const layer = el('div'); layer.id = 'mzEmotes'; o.root.appendChild(layer);
  const bubbles = new Map<string, Bubble>();
  const gesti = new Map<string, Gesto>();
  const v = new THREE.Vector3();

  /** Punto del mondo → px relativi a root (on = davanti alla camera e dentro lo schermo). */
  const toScreen = (x: number, y: number, z: number): { x: number; y: number; on: boolean } => {
    v.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };
  /** Proietta l'ancora di `who` (sopra la testa) in px relativi a root; null se non c'è (peer non disegnato). */
  const project = (who: string): { x: number; y: number; on: boolean } | null => {
    const a = o.world.anchorOf(who); if (!a) return null;
    return toScreen(a.x, a.y, a.z);
  };
  const drop = (b: Bubble) => { b.el.remove(); if (bubbles.get(b.who) === b) bubbles.delete(b.who); };
  /** La punta della coda sta sull'ancora; l'opacità scende negli ultimi 0,3 s. */
  const place = (b: Bubble): void => {
    const p = project(b.who);
    if (!p) { drop(b); return; }
    b.x = Math.round(p.x); b.y = Math.round(p.y); b.on = p.on;
    b.el.style.visibility = p.on ? 'visible' : 'hidden';
    b.el.style.transform = `translate(${b.x}px, ${b.y - TAIL_PX - 2}px) translate(-50%, -100%)`;
    const age = (performance.now() - b.born) / 1000;
    b.el.style.opacity = age > EMOTE_SHOW_S - FADE_S ? String(Math.max(0, (EMOTE_SHOW_S - age) / FADE_S)) : '1';
  };
  /** Gesto del corpo (solo le emote che ce l'hanno): saltelli e giro a scatti; a fine gesto il corpo torna fermo. */
  const gestoAt = (g: Gesto, now: number): { hop: number; spin: number } | null => {
    const d = GESTI[g.id]; if (!d) return null;
    const age = Math.floor(((now - g.born) / 1000) * 15) / 15, k = age / d.dur;
    if (k >= 1) return null;
    return { hop: d.h * Math.abs(Math.sin(Math.PI * d.hops * k)), spin: d.spin * k + d.wob * Math.sin(Math.PI * 2 * k) };
  };
  const stopGesto = (who: string) => { if (gesti.delete(who)) o.world.gesto(who, 0, 0); };
  const show = (who: string, id: EmoteId) => {
    const old = bubbles.get(who); if (old) drop(old);
    stopGesto(who);
    if (GESTI[id]) gesti.set(who, { id, born: performance.now() });
    suona('emote');
    const e = el('div', 'mz mz-emote'); e.dataset['who'] = who; e.dataset['emote'] = id; e.setAttribute('role', 'status');
    const inner = el('div', 'mz-emote-b'); inner.append(emoteIcon(id, 24), el('span', '', EMOTE_WORDS[id]));
    e.appendChild(inner); layer.appendChild(e);
    const b: Bubble = { who, id, el: e, born: performance.now(), x: 0, y: 0, on: false };
    bubbles.set(who, b);
    place(b); // subito, senza aspettare il frame (una scheda in secondo piano non ha requestAnimationFrame)
  };

  const unsub = o.world.net.on('emote', (m) => {
    if (!isEmote(m.id) || !m.from || m.from === o.world.net.me?.id) return;
    if (!o.world.anchorOf(m.from)) return; // il peer non è disegnato (sta ancora caricando): niente fumetto
    show(m.from, m.id);
  });

  const play = (id: EmoteId): boolean => {
    if (!isEmote(id) || cooldownS() > 0 || blocked()) return false;
    readyAt = performance.now() + EMOTE_COOLDOWN_S * 1000; last = { id, at: performance.now() };
    if (o.world.net.status === 'on') o.world.net.sendEmote(id);
    show('me', id);
    closeWheel(); closeRow();
    return true;
  };

  // ---- ruota rapida (#90): 8 spicchi attorno al pollice/cursore, spostata quanto basta per non coprire l'avatar ----
  const wheel: Wheel = { open: false, x: 0, y: 0, sel: null, via: 'tasto', at: 0, moved: false, from: { x: 0, y: 0 } };
  const wheelEl = el('div', 'mz'); wheelEl.id = 'mzEmoteWheel'; wheelEl.setAttribute('role', 'menu'); wheelEl.setAttribute('aria-label', 'Emote');
  const hub = el('div', 'mz-wheel'), wheelBg = el('div', 'mz-wheel-bg'), label = el('div', 'mz-wheel-c');
  hub.appendChild(wheelBg);
  const tiles = EMOTE_ORDER.map((id, i) => {
    const t = el('div', 'mz-wheel-t'); t.dataset['emote'] = id; t.setAttribute('role', 'menuitem'); t.setAttribute('aria-label', `${i + 1} ${EMOTE_WORDS[id]}`);
    const a = -Math.PI / 2 + (i * Math.PI * 2) / EMOTE_ORDER.length;
    t.style.left = Math.round(RING * Math.cos(a)) + 'px'; t.style.top = Math.round(RING * Math.sin(a)) + 'px';
    t.appendChild(emoteIcon(id, 32));
    hub.appendChild(t);
    return t;
  });
  hub.appendChild(label); wheelEl.appendChild(hub); o.root.appendChild(wheelEl);
  const rootRect = () => o.root.getBoundingClientRect();
  /** Rettangolo dell'avatar sullo schermo (dalla testa, fumetto compreso, ai piedi), px relativi a root. */
  const avatarBox = (): { l: number; r: number; t: number; b: number } | null => {
    const a = o.world.anchorOf('me'); if (!a) return null;
    const head = toScreen(a.x, a.y, a.z), feet = toScreen(a.x, a.y - 1.9, a.z);
    if (!head.on) return null;
    const h = Math.max(20, feet.y - head.y), hw = Math.max(24, h * 0.32);
    return { l: head.x - hw, r: head.x + hw, t: head.y - 40, b: feet.y };
  };
  const hits = (cx: number, cy: number, bx: { l: number; r: number; t: number; b: number }) => {
    const nx = Math.max(bx.l, Math.min(cx, bx.r)), ny = Math.max(bx.t, Math.min(cy, bx.b));
    return Math.hypot(cx - nx, cy - ny) < WHEEL_R + AVATAR_GAP;
  };
  /** Centro della ruota: il punto chiesto, dentro lo schermo; se copre l'avatar, il posto libero più vicino (sinistra, destra, sopra, sotto). */
  const center = (x: number, y: number): { x: number; y: number } => {
    const rr = rootRect(), m = WHEEL_R + 4;
    const fit = (px: number, py: number) => ({ x: Math.min(Math.max(px, m), Math.max(m, rr.width - m)), y: Math.min(Math.max(py, m), Math.max(m, rr.height - m)) });
    const c = fit(x, y), bx = avatarBox();
    if (!bx || !hits(c.x, c.y, bx)) return c;
    const g = WHEEL_R + AVATAR_GAP + 1;
    const opts = [fit(bx.l - g, c.y), fit(bx.r + g, c.y), fit(c.x, bx.t - g), fit(c.x, bx.b + g)].filter((p) => !hits(p.x, p.y, bx));
    opts.sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
    return opts[0] ?? c;
  };
  /** Spicchio sotto (x, y) (px relativi a root): angolo dal centro, 0 a mezzogiorno in senso orario; null nella zona morta o (con `max`) fuori. */
  const pickAt = (x: number, y: number, max = Infinity): number | null => {
    const dx = x - wheel.x, dy = y - wheel.y, d = Math.hypot(dx, dy);
    if (d < DEAD || d > max) return null;
    const n = EMOTE_ORDER.length, a = Math.atan2(dy, dx) + Math.PI / 2;
    return ((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n;
  };
  const paintWheel = () => {
    const off = cooldownS() > 0;
    tiles.forEach((t, i) => { t.classList.toggle('sel', wheel.sel === i); t.classList.toggle('off', off); });
    const txt = wheel.sel === null ? '' : EMOTE_WORDS[EMOTE_ORDER[wheel.sel]!];
    if (label.textContent !== txt) label.textContent = txt;
  };
  const setSel = (i: number | null) => { if (i !== wheel.sel) { wheel.sel = i; paintWheel(); } };
  function closeWheel(): void {
    if (!wheel.open) return;
    wheel.open = false; wheel.sel = null; held = null; wheelEl.classList.remove('on'); paintWheel();
  }
  const openWheel = (x?: number, y?: number, via: WheelVia = 'test'): boolean => {
    if (blocked()) return false;
    closeRow();
    const rr = rootRect(), want = { x: x ?? mouse?.x ?? rr.width / 2, y: y ?? mouse?.y ?? rr.height / 2 };
    const c = center(want.x, want.y);
    Object.assign(wheel, { open: true, x: Math.round(c.x), y: Math.round(c.y), sel: null, via, at: performance.now(), moved: false, from: want });
    hub.style.transform = `translate(${wheel.x}px, ${wheel.y}px)`;
    tiles.forEach((t, i) => { const k = t.querySelector('i'); if (!coarse && !k) t.appendChild(el('i', '', String(i + 1))); });
    wheelEl.classList.add('on'); paintWheel();
    return true;
  };
  /** Scelta di uno spicchio: manda l'emote (e la ruota si chiude); durante la pausa resta aperta. */
  const choose = (i: number) => { const id = EMOTE_ORDER[i]; if (id) play(id); };
  const rel = (e: PointerEvent) => { const rr = rootRect(); return { x: e.clientX - rr.left, y: e.clientY - rr.top }; };
  const track = (p: { x: number; y: number }) => { if (Math.hypot(p.x - wheel.from.x, p.y - wheel.from.y) > MOVED) wheel.moved = true; };
  // mouse o tocco sulla ruota aperta: passa sopra → evidenzia, clic/tocco su uno spicchio → manda, fuori → chiude
  let downIn = false;
  wheelEl.addEventListener('pointermove', (e) => { if (!wheel.open || held) return; const p = rel(e); track(p); setSel(pickAt(p.x, p.y, WHEEL_R + 30)); });
  wheelEl.addEventListener('pointerdown', (e) => { e.preventDefault(); downIn = true; const p = rel(e); setSel(pickAt(p.x, p.y, WHEEL_R + 30)); });
  wheelEl.addEventListener('pointerup', (e) => {
    if (!downIn || held) return; downIn = false;
    const p = rel(e), i = pickAt(p.x, p.y, WHEEL_R + 30);
    if (i === null) closeWheel(); else choose(i);
  });
  wheelEl.addEventListener('contextmenu', (e) => e.preventDefault());
  // ultimo punto del mouse (la ruota del tasto G si apre lì)
  let mouse: { x: number; y: number } | null = null;
  const onMouse = (e: PointerEvent) => { if (e.pointerType === 'mouse') mouse = rel(e); };
  addEventListener('pointermove', onMouse, { passive: true });
  // tocco lungo su #mzEmoteBtn: la ruota si apre col dito ancora giù; trascina e rilascia sullo spicchio (il dito resta «catturato» dal bottone)
  let held: { id: number } | null = null, lpTimer = 0, skipClick = false;
  const onMove = (e: PointerEvent) => {
    if (!held || e.pointerId !== held.id || !wheel.open) return;
    const p = rel(e); track(p); setSel(pickAt(p.x, p.y));
  };
  const onUp = (e: PointerEvent) => {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = 0; }
    if (!held || e.pointerId !== held.id) return;
    held = null;
    if (!wheel.open || !wheel.moved) return; // rilasciato senza trascinare: la ruota resta aperta per un tocco
    const p = rel(e), i = e.type === 'pointerup' ? pickAt(p.x, p.y) : null;
    if (i === null) closeWheel(); else choose(i);
  };
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  // tasto G tenuto: rilasciandolo con uno spicchio sotto il mouse, parte quello (premuto e lasciato subito: la ruota resta aperta)
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'KeyG' || !wheel.open || wheel.via !== 'tasto') return;
    if (performance.now() - wheel.at > HOLD_MS && wheel.moved && wheel.sel !== null) choose(wheel.sel);
  };
  const onEsc = (e: KeyboardEvent) => { if (wheel.open && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeWheel(); } };
  addEventListener('keyup', onKeyUp); addEventListener('keydown', onEsc, true);

  // ---- telefono: bottone nella barra in alto; tocco breve → riga con le 4 emote di sempre + «altre» (ruota); tocco lungo → ruota ----
  let row: HTMLElement | null = null, btn: ReturnType<typeof topButton> | null = null;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  function closeRow(): void { row?.classList.remove('on'); btn?.setOn(false); }
  const openRow = () => {
    if (!row || !btn) return;
    const r = btn.el.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    if (innerWidth >= 700) { row.style.left = 'auto'; row.style.right = Math.round(rr.right - r.right) + 'px'; row.style.top = Math.round(r.bottom - rr.top + 8) + 'px'; }
    else { row.style.right = 'auto'; row.style.left = Math.round(r.right - rr.left + 8) + 'px'; row.style.top = Math.round(r.top - rr.top - 8) + 'px'; }
    row.classList.add('on'); btn.setOn(true);
  };
  const centerOf = (e: Element) => { const r = e.getBoundingClientRect(), rr = rootRect(); return { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 }; };
  if (coarse) {
    row = el('div', 'mz'); row.id = 'mzEmoteRow'; row.setAttribute('role', 'toolbar'); row.setAttribute('aria-label', 'Emote');
    for (const id of ROW_IDS) {
      const b = el('button', 'mz mz-emote-pick'); b.type = 'button'; b.dataset['emote'] = id; b.title = EMOTE_WORDS[id]; b.setAttribute('aria-label', EMOTE_WORDS[id]);
      b.appendChild(emoteIcon(id, 32));
      b.addEventListener('click', (e) => { e.preventDefault(); b.blur(); play(id); });
      row.appendChild(b);
    }
    const more = el('button', 'mz mz-emote-more'); more.type = 'button'; more.title = 'Altre emote'; more.setAttribute('aria-label', 'Altre emote');
    more.appendChild(emoteIcon('ruota', 32));
    more.addEventListener('click', (e) => { e.preventDefault(); more.blur(); const c = centerOf(more); openWheel(c.x, c.y, 'tocco'); });
    row.appendChild(more);
    o.root.appendChild(row);
    btn = topButton({ root: o.root, id: 'mzEmoteBtn', order: 3, label: '', title: 'Emote (tieni premuto: ruota)', onClick: () => {
      if (skipClick) { skipClick = false; return; } // il «click» che segue un tocco lungo
      if (wheel.open) closeWheel();
      else if (row?.classList.contains('on')) closeRow(); else openRow();
    } });
    btn.el.insertBefore(emoteIcon('ride', 28), btn.el.firstChild);
    const b = btn.el;
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e) => {
      skipClick = false;
      if (lpTimer) clearTimeout(lpTimer);
      const id = e.pointerId;
      lpTimer = window.setTimeout(() => {
        lpTimer = 0;
        const c = centerOf(b);
        if (openWheel(c.x, c.y, 'tocco')) { held = { id }; skipClick = true; }
      }, HOLD_MS);
    });
  }

  registerStateProvider('emotes', () => ({
    cooldown: cooldownS(), last, coarse, row: !!row?.classList.contains('on'), blocked: blocked(),
    shown: [...bubbles.values()].map((b) => ({ who: b.who, id: b.id, x: b.x, y: b.y, on: b.on, age: (performance.now() - b.born) / 1000 })),
    ids: EMOTE_ORDER.length, gesti: [...gesti.entries()].map(([who, g]) => ({ who, id: g.id, ...(gestoAt(g, performance.now()) ?? { hop: 0, spin: 0 }) })),
    wheel: { open: wheel.open, x: wheel.x, y: wheel.y, sel: wheel.sel, via: wheel.via, held: !!held, avatar: wheel.open ? avatarBox() : null },
  }));
  registerTestHook('emoteWheel', (x, y) => openWheel(typeof x === 'number' ? x : undefined, typeof y === 'number' ? y : undefined, 'test'));
  return {
    play, openWheel, closeWheel,
    toggleWheel() { if (wheel.open) { closeWheel(); return true; } return openWheel(undefined, undefined, 'tasto'); },
    get wheelOpen() { return wheel.open; },
    update() {
      const now = performance.now();
      for (const b of [...bubbles.values()]) { if ((now - b.born) / 1000 >= EMOTE_SHOW_S) drop(b); else place(b); }
      for (const [who, g] of [...gesti]) { const k = gestoAt(g, now); if (k) o.world.gesto(who, k.hop, k.spin); else stopGesto(who); }
      if (wheel.open) { if (blocked()) closeWheel(); else paintWheel(); }
      if (row) {
        if (row.classList.contains('on') && blocked()) closeRow();
        for (const b of row.children) if (!(b as HTMLElement).classList.contains('mz-emote-more')) (b as HTMLButtonElement).disabled = cooldownS() > 0; // spenti durante la pausa
      }
    },
    dispose() {
      unsub(); for (const b of [...bubbles.values()]) drop(b); for (const who of [...gesti.keys()]) stopGesto(who);
      removeEventListener('pointermove', onMouse); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
      removeEventListener('keyup', onKeyUp); removeEventListener('keydown', onEsc, true);
      layer.remove(); wheelEl.remove(); row?.remove(); btn?.el.remove();
    },
  };
}
