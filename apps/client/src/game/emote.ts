// Emote (F3-emote-feed, CONTRACTS §13): 1-4 (o la riga del bottone #mzEmoteBtn sul telefono) → fumetto a pixel sopra la propria testa e
// messaggio `emote` in rete; chi lo riceve disegna il fumetto sopra il peer `from`. Il fumetto è DOM (niente clip in chr_base: vedi
// tests/out/richieste/f3-emote.md), proiettato ogni frame con la camera come le etichette del lotto; fuori schermo o dietro la camera sparisce.
// Pausa 1,5 s nel client (la Zone tiene 800 ms per socket); niente emote in gara o con un pannello aperto (world.frozen).
import * as THREE from 'three';
import type { Camera } from 'three';
import type { EmoteId } from '@marea/protocol';
import type { GameWorld } from './world.ts';
import { PAL, el } from '../ui/style.ts';
import { topButton } from '../ui/topbar.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type Emotes = { play(id: EmoteId): boolean; update(dt: number): void; dispose(): void };
export const EMOTE_COOLDOWN_S = 1.5;
export const EMOTE_SHOW_S = 2.5;
const FADE_S = 0.3, TAIL_PX = 8;

export const EMOTE_WORDS: Record<EmoteId, string> = { saluto: 'Ciao!', esulta: 'Evvai!', ride: 'Ah ah!', no: 'No no' };
const EMOTE_ORDER: EmoteId[] = ['saluto', 'esulta', 'ride', 'no'];
const isEmote = (v: unknown): v is EmoteId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(EMOTE_WORDS, v);

// ---- icone 16×16 a pixel: riempimenti in colori PAL; il contorno (nero caldo) lo aggiunge outline() attorno a ciò che è pieno ----
const COL: Record<string, string> = { y: PAL.giallo, r: PAL.rosso, h: PAL.sabbia, m: PAL.ombraCalda, o: PAL.neroCaldo, w: PAL.acquaBassa };
type Px = (string | null)[][];
const grid = (): Px => Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));
const fromRows = (rows: string[]): Px => rows.map((r) => [...r.padEnd(16, '.')].slice(0, 16).map((c) => (c === '.' ? null : c)));
function outline(g: Px): Px {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (g[y]![x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = g[y + dy]?.[x + dx];
      if (c && c !== 'w' && c !== 'o') { out[y]![x] = 'o'; break; }
    }
  }
  return out;
}
const ICONS: Record<EmoteId, () => Px> = {
  saluto: () => { // mano aperta che saluta, con due segni di movimento
    const g = grid(), fill = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y]![x] = 'h'; };
    fill(5, 8, 11, 12); fill(6, 13, 10, 14);
    fill(5, 4, 5, 7); fill(7, 2, 7, 7); fill(9, 2, 9, 7); fill(11, 4, 11, 7); fill(3, 9, 4, 10);
    for (const [x, y] of [[13, 3], [14, 2], [13, 6], [14, 6], [14, 9]] as const) g[y]![x] = 'w';
    return g;
  },
  esulta: () => fromRows([ // stella
    '................', '.......y........', '......yyy.......', '......yyy.......', '.....yyyyy......', '.yyyyyyyyyyyyy..',
    '..yyyyyyyyyyy...', '...yyyyyyyyy....', '....yyyyyyy.....', '....yyyyyyy.....', '...yyyy.yyyy....', '...yyy...yyy....',
    '..yyy.....yyy...', '..y.........y...', '................', '................',
  ]),
  ride: () => fromRows([ // faccina che ride a occhi chiusi
    '................', '.....oooooo.....', '...ooyyyyyyoo...', '..oyyyyyyyyyyo..', '.oyyyyyyyyyyyyo.', '.oyyyoyyyyoyyyo.',
    'oyyyoyoyyoyoyyyo', 'oyyyyyyyyyyyyyyo', 'oyyooooooooooyyo', '.oyyommmmmmoyyo.', '.oyyyomrrmoyyyo.', '..oyyyooooyyyo..',
    '...ooyyyyyyoo...', '.....oooooo.....', '................', '................',
  ]),
  no: () => { // croce rossa
    const g = grid();
    for (let i = 3; i <= 12; i++) for (const d of [0, 1]) { g[i]![Math.min(12, i + d)] = 'r'; g[i]![Math.max(3, 15 - i - d)] = 'r'; }
    return g;
  },
};
const iconCache = new Map<EmoteId, Px>();
/** Icona 16×16 in un <canvas> (niente immagini): `size` px CSS, pixel netti. */
export function emoteIcon(id: EmoteId, size = 32): HTMLCanvasElement {
  let px = iconCache.get(id);
  if (!px) { px = outline(ICONS[id]()); iconCache.set(id, px); }
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.className = 'mz-ico';
  c.style.width = c.style.height = size + 'px'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (g) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = px[y]![x]; if (k) { g.fillStyle = COL[k] ?? PAL.neroCaldo; g.fillRect(x, y, 1, 1); } }
  return c;
}

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
.mz-emote-pick { width: 52px; height: 52px; flex: none; padding: 0; display: flex; align-items: center; justify-content: center; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; cursor: pointer; }
.mz-emote-pick:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-emote-pick:disabled { border-color: ${P.pietraScura}; cursor: default; }
.mz-emote-pick:disabled .mz-ico { opacity: .5; }
`;
let styled = false;
function injectStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style'); s.id = 'mz-emote-style'; s.textContent = CSS; document.head.appendChild(s);
}

type Bubble = { who: string; id: EmoteId; el: HTMLElement; born: number; x: number; y: number; on: boolean };

export function createEmotes(o: { world: GameWorld; camera: Camera; canvas: HTMLCanvasElement; root: HTMLElement }): Emotes {
  injectStyle();
  let readyAt = 0, last: { id: EmoteId; at: number } | null = null; // pausa a orologio (non a dt: una scheda dietro non ha frame)
  const cooldownS = () => Math.max(0, (readyAt - performance.now()) / 1000);
  const layer = el('div'); layer.id = 'mzEmotes'; o.root.appendChild(layer);
  const bubbles = new Map<string, Bubble>();
  const v = new THREE.Vector3();

  /** Proietta l'ancora di `who` (sopra la testa) in px relativi a root; null se non c'è (peer non disegnato). */
  const project = (who: string): { x: number; y: number; on: boolean } | null => {
    const a = o.world.anchorOf(who); if (!a) return null;
    v.set(a.x, a.y, a.z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    const x = r.left - rr.left + ((v.x + 1) / 2) * r.width, y = r.top - rr.top + ((1 - v.y) / 2) * r.height;
    return { x, y, on: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
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
  const show = (who: string, id: EmoteId) => {
    const old = bubbles.get(who); if (old) drop(old);
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
    if (!isEmote(id) || cooldownS() > 0 || o.world.race.on || o.world.frozen) return false;
    readyAt = performance.now() + EMOTE_COOLDOWN_S * 1000; last = { id, at: performance.now() };
    if (o.world.net.status === 'on') o.world.net.sendEmote(id);
    show('me', id);
    return true;
  };

  // ---- telefono: bottone nella barra in alto che apre/chiude una riga coi 4 emote ----
  let row: HTMLElement | null = null, btn: ReturnType<typeof topButton> | null = null;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const closeRow = () => { row?.classList.remove('on'); btn?.setOn(false); };
  const openRow = () => {
    if (!row || !btn) return;
    const r = btn.el.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    if (innerWidth >= 700) { row.style.left = 'auto'; row.style.right = Math.round(rr.right - r.right) + 'px'; row.style.top = Math.round(r.bottom - rr.top + 8) + 'px'; }
    else { row.style.right = 'auto'; row.style.left = Math.round(r.right - rr.left + 8) + 'px'; row.style.top = Math.round(r.top - rr.top - 8) + 'px'; }
    row.classList.add('on'); btn.setOn(true);
  };
  if (coarse) {
    row = el('div', 'mz'); row.id = 'mzEmoteRow'; row.setAttribute('role', 'toolbar'); row.setAttribute('aria-label', 'Emote');
    for (const id of EMOTE_ORDER) {
      const b = el('button', 'mz mz-emote-pick'); b.type = 'button'; b.dataset['emote'] = id; b.title = EMOTE_WORDS[id]; b.setAttribute('aria-label', EMOTE_WORDS[id]);
      b.appendChild(emoteIcon(id, 32));
      b.addEventListener('click', (e) => { e.preventDefault(); b.blur(); if (play(id)) closeRow(); });
      row.appendChild(b);
    }
    o.root.appendChild(row);
    btn = topButton({ root: o.root, id: 'mzEmoteBtn', order: 3, label: '', title: 'Emote', onClick: () => { if (row?.classList.contains('on')) closeRow(); else openRow(); } });
    btn.el.insertBefore(emoteIcon('ride', 28), btn.el.firstChild);
  }

  registerStateProvider('emotes', () => ({
    cooldown: cooldownS(), last, coarse, row: !!row?.classList.contains('on'),
    shown: [...bubbles.values()].map((b) => ({ who: b.who, id: b.id, x: b.x, y: b.y, on: b.on, age: (performance.now() - b.born) / 1000 })),
  }));
  return {
    play,
    update() {
      const now = performance.now();
      for (const b of [...bubbles.values()]) { if ((now - b.born) / 1000 >= EMOTE_SHOW_S) drop(b); else place(b); }
      if (row) {
        if (row.classList.contains('on') && (o.world.race.on || o.world.frozen)) closeRow();
        for (const b of row.children) (b as HTMLButtonElement).disabled = cooldownS() > 0; // spenti durante la pausa
      }
    },
    dispose() { unsub(); for (const b of [...bubbles.values()]) drop(b); layer.remove(); row?.remove(); btn?.el.remove(); },
  };
}
