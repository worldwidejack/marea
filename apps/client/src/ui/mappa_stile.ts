// Stile della minimappa e della mappa grande (#360). Scelto da Jack il 17 ott 2026 fra due varianti (foglio in assets/concept/mappa/):
// icone delle mete col contorno nero, 3 scatti di zoom, bottoni + e − accanto al cerchio e in basso a destra nella mappa (l'altra aveva
// cartellini colorati per tipo, 5 scatti e i bottoni sul cerchio). Tutto in palette (ART_BIBLE §2); le icone si disegnano una volta in una
// tela piccola e poi si copiano.
import { pixCelle } from './icons.ts';
import type { PixId } from './icons.ts';
import { PAL } from './style.ts';

const P = PAL;
/** Minimappa: metri dal centro al bordo del cerchio, uno per scatto (dal più vicino al più lontano); di serie 100. */
export const RAGGI: readonly number[] = [50, 100, 200];
/** Mappa grande: scatti dall'arcipelago intero al più vicino (DENSITA_MAX), in mezzo a passi uguali (ogni scatto moltiplica uguale). */
export const SCATTI = 3;
/** Mappa grande allo scatto più vicino: px CSS per cella (2 m), uguale su telefono e PC (lì le mete del Porto non si coprono più). */
export const DENSITA_MAX = 8;
/** Scatto più vicino a un raggio salvato. */
export const scattoVicino = (scatti: readonly number[], v: number): number => {
  let best = 0;
  for (let i = 1; i < scatti.length; i++) if (Math.abs(Math.log(scatti[i]! / v)) < Math.abs(Math.log(scatti[best]! / v))) best = i;
  return best;
};

/** Tipo di meta: decide chi vince quando due icone si coprono. */
export type Tipo = 'porto' | 'isola' | 'dungeon' | 'gioco' | 'servizio';
/** Vince il Porto, poi le isole, il dungeon, i giochi e per ultimi i servizi del Porto (si vedono avvicinando lo zoom). */
export const TIPO_ORDINE: Record<Tipo, number> = { porto: 0, isola: 1, dungeon: 2, gioco: 3, servizio: 4 };
const SERVIZI = new Set(['casa', 'mercante', 'bacheca', 'contrabbando', 'record', 'faro']);
const ISOLE = new Set(['templari', 'funivia', 'relitto_templare', 'arena']);
export function tipoDi(t: { id: string; group?: string }): Tipo {
  if (t.id === 'porto') return 'porto';
  if (t.group === 'dungeon') return 'dungeon';
  if (t.id.startsWith('tema:') || ISOLE.has(t.id)) return 'isola';
  return SERVIZI.has(t.id) ? 'servizio' : 'gioco';
}

/** Icona pronta: tela e punto della tela che va sopra la meta (il centro). */
export type Sprite = { c: HTMLCanvasElement; ax: number; ay: number };
const cache = new Map<string, Sprite>();
const tela = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** Icona 8×8 col contorno di 1 cella (anche in diagonale) in (ox, oy) = angolo della cella di contorno, celle da `s` pixel. */
function conContorno(g: CanvasRenderingContext2D, id: PixId, ox: number, oy: number, s: number, bordo: string): void {
  const m = pixCelle(id), pieno = (x: number, y: number) => x >= 0 && y >= 0 && x < 8 && y < 8 && !!m[y]![x];
  g.fillStyle = bordo;
  for (let y = -1; y <= 8; y++) for (let x = -1; x <= 8; x++) {
    if (pieno(x, y)) continue;
    let vicino = false;
    for (let dy = -1; dy <= 1 && !vicino; dy++) for (let dx = -1; dx <= 1 && !vicino; dx++) vicino = pieno(x + dx, y + dy);
    if (vicino) g.fillRect(ox + (x + 1) * s, oy + (y + 1) * s, s, s);
  }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = m[y]![x]; if (c) { g.fillStyle = c; g.fillRect(ox + (x + 1) * s, oy + (y + 1) * s, s, s); } }
}

/** Sprite di una meta: l'icona col contorno nero, 10×10 celle da `s` pixel della tela, centrata sulla meta. */
export function spriteMeta(id: PixId, s: number): Sprite {
  const key = `${id}|${s}`;
  let sp = cache.get(key);
  if (!sp) { const c = tela(10 * s, 10 * s); conContorno(c.getContext('2d')!, id, 0, 0, s, P.neroCaldo); sp = { c, ax: 5 * s, ay: 5 * s }; cache.set(key, sp); }
  return sp;
}

/** Freccia a pixel (te): triangolo con contorno, punta verso `a` (radianti, 0 = nord, in su). */
export function freccia(g: CanvasRenderingContext2D, cx: number, cy: number, a: number, s: number): void {
  g.save(); g.translate(cx, cy); g.rotate(a);
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.8, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.8, s * 0.8); g.closePath();
  g.fillStyle = P.giallo; g.fill(); g.lineWidth = Math.max(1, s / 4); g.lineJoin = 'round'; g.strokeStyle = P.neroCaldo; g.stroke(); g.restore();
}
/** Quadratino con bordo nero (amici, scia del segnalino). */
export function punto(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, col: string): void {
  const b = Math.max(1, Math.round(s / 4));
  g.fillStyle = P.neroCaldo; g.fillRect(Math.round(cx - s / 2) - b, Math.round(cy - s / 2) - b, s + 2 * b, s + 2 * b);
  g.fillStyle = col; g.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
}
/** Nomi (delle isole) in ordine di importanza: quelli che si coprono o restano fuori dalla tela si saltano. */
export function scritte(g: CanvasRenderingContext2D, nomi: readonly { t: string; x: number; y: number }[], size: number, cw: number, ch: number): void {
  const fatte: [number, number, number, number][] = [];
  g.font = `bold ${size}px ui-monospace, Menlo, monospace`;
  for (const n of nomi) {
    const w = g.measureText(n.t).width / 2 + size * 0.3, b: [number, number, number, number] = [n.x - w, n.y - size * 0.7, n.x + w, n.y + size * 0.7];
    if (b[2] < 0 || b[0] > cw || b[3] < 0 || b[1] > ch || fatte.some((f) => b[0] < f[2] && f[0] < b[2] && b[1] < f[3] && f[1] < b[3])) continue;
    fatte.push(b); scritta(g, n.t, n.x, n.y, size);
  }
}
/** Scritta chiara col bordo scuro, centrata in (cx, cy). */
export function scritta(g: CanvasRenderingContext2D, t: string, cx: number, cy: number, size: number, col: string = P.sabbiaChiara): void {
  g.font = `bold ${size}px ui-monospace, Menlo, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(2, size / 4); g.strokeStyle = P.neroCaldo; g.strokeText(t, cx, cy); g.fillStyle = col; g.fillText(t, cx, cy);
}

/** + e − a pixel (8×8 celle) dei bottoni dello zoom. */
export const GLIFO: Record<'+' | '-', string> = {
  '+': '<svg viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><path d="M3 0h2v3h3v2H5v3H3V5H0V3h3z" fill="currentColor"/></svg>',
  '-': '<svg viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 3h8v2H0z" fill="currentColor"/></svg>',
};
/** + = più vicino, − = più lontano (anche col tastierino); 0 = altro tasto. Si guarda `key`: sulla tastiera italiana + e − non stanno dove sono su quella americana. */
export const zoomTasto = (e: KeyboardEvent): number => (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' ? 1 : e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' ? -1 : 0);
/** Rotella: uno scatto ogni ~40 px di scorrimento (un clic della rotella, un pizzico sul trackpad), poi una pausa che si mangia l'inerzia. */
export function rotella(): (e: WheelEvent) => number {
  let acc = 0, fermo = 0;
  return (e) => {
    e.preventDefault();
    const now = performance.now(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    if (now < fermo) { acc = 0; return 0; }
    acc += e.ctrlKey ? dy * 4 : dy;
    if (Math.abs(acc) < 40) return 0;
    const passo = acc < 0 ? 1 : -1;
    acc = 0; fermo = now + 160;
    return passo;
  };
}
/** Un'icona da disegnare: la meta, il suo tipo, lo sprite e la scatola in pixel della tela. */
export type Disegnata<T> = { t: T; tipo: Tipo; sp: Sprite; x0: number; y0: number; x1: number; y1: number };
/** Le icone che si coprono: vince la più importante (TIPO_ORDINE), le altre aspettano uno zoom più vicino. `m` = margine in pixel. */
export function sfoltisci<T>(cand: Disegnata<T>[], m: number): Disegnata<T>[] {
  const ok: Disegnata<T>[] = [];
  for (const c of [...cand].sort((a, b) => TIPO_ORDINE[a.tipo] - TIPO_ORDINE[b.tipo])) {
    if (!ok.some((d) => c.x0 < d.x1 + m && d.x0 < c.x1 + m && c.y0 < d.y1 + m && d.y0 < c.y1 + m)) ok.push(c);
  }
  return ok;
}

const BTN = `background: rgba(46,30,20,.95); border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara}; box-shadow: 0 3px 0 ${P.neroCaldo}; cursor: pointer;`;
/** Cerchio, bottoni dello zoom (accanto al cerchio, verso il centro dello schermo) e mappa grande (bottoni in basso a destra). */
export const MAPPA_CSS = `
#mzMini { position: absolute; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 136px); /* sopra il bottone A (84 px a 36 px dal fondo) */ width: 148px; height: 148px; z-index: 13; cursor: pointer; padding: 0; border: none; background: none; }
#mzMini canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; border-radius: 50%; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; box-sizing: border-box; background: ${P.abisso}; }
#mzMini .n { position: absolute; left: 50%; top: 0; transform: translate(-50%, -50%); font: bold 11px ui-monospace, Menlo, monospace; color: ${P.giallo}; text-shadow: 0 1px 0 ${P.neroCaldo}, 1px 0 0 ${P.neroCaldo}, -1px 0 0 ${P.neroCaldo}; pointer-events: none; }
#mzMini:focus { outline: none; } #mzMini:focus-visible canvas { border-color: ${P.giallo}; }
#mzMini.qui canvas { animation: mzMiniQui 1s steps(2, jump-none) infinite; }
@keyframes mzMiniQui { from { border-color: ${P.giallo}; } to { border-color: ${P.legnoChiaro}; } }
#mzMiniZoom { position: absolute; right: 168px; bottom: calc(env(safe-area-inset-bottom, 0px) + 171px); z-index: 13; display: flex; flex-direction: column; gap: 6px; }
#mzMiniZoom button { width: 36px; height: 36px; padding: 0; display: grid; place-items: center; border-radius: 50%; ${BTN} }
#mzMiniZoom button:disabled { opacity: .4; cursor: default; }
#mzMiniZoom button:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
@media (max-width: 699px) {
  #mzMini { width: 92px; height: 92px; bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 58px); }
  #mzMiniZoom { right: 110px; bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 65px); }
}
#mzMappa { position: absolute; inset: 0; z-index: 30; display: none; flex-direction: column; align-items: stretch; gap: 8px; background: rgba(22,63,115,.9); padding: max(10px, env(safe-area-inset-top)) 12px max(10px, env(safe-area-inset-bottom)); box-sizing: border-box; }
#mzMappa.on { display: flex; }
#mzMappa .fr { position: relative; flex: 1 1 0; min-height: 0; background: ${P.abisso}; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 4px 0 ${P.neroCaldo}; overflow: hidden; }
#mzMappa canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; cursor: crosshair; touch-action: none; }
#mzMappa canvas.drag { cursor: grabbing; }
#mzMappa .pie { flex: none; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; max-width: 100%; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; text-align: center; }
#mzMappa .pie button { min-height: 44px; padding: 0 12px; ${BTN} font: bold 13px ui-monospace, Menlo, monospace; box-shadow: none; }
#mzMappa .pie button:active { transform: translateY(2px); }
#mzMappa .hd { flex: none; display: flex; align-items: center; justify-content: center; gap: 10px; color: ${P.sabbiaChiara}; font: bold 16px ui-monospace, Menlo, monospace; }
#mzMappa .hd > button, #mzMappa .zoom button { min-width: 44px; min-height: 44px; padding: 0; display: grid; place-items: center; ${BTN} box-shadow: none; font: bold 18px ui-monospace, Menlo, monospace; }
#mzMappa .zoom { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
#mzMappa .zoom button:disabled { opacity: .4; cursor: default; }
#mzMappa .zoom button { box-shadow: 0 3px 0 ${P.neroCaldo}; }
#mzMappa .q { font-size: 12px; font-weight: normal; color: ${P.pietraChiara}; }
@media (max-width: 699px) { #mzMappa .q { display: none; } }
#ui.mz-racing #mzMini, body.mz-sotto #mzMini, body.mz-casa #mzMini, #ui.mz-racing #mzMiniZoom, body.mz-sotto #mzMiniZoom, body.mz-casa #mzMiniZoom { visibility: hidden; } /* mz-casa: in casa e in giardino (#265) */
`;
