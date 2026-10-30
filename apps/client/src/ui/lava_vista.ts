// Fuga dalla lava, il disegno a schermo intero (ui/lava.ts è la schermata): un canvas che riempie lo schermo a pixel grossi interi (nearest),
// camera che segue il corridore, cielo di cenere, vulcano e guglie in parallasse, basalto a canne, mare di lava, gemme, nemici, geyser e il
// muro di lava che ti insegue. Ogni fotogramma è disegnato a metà tra due tick (`alpha`). Solo colori della palette (ART_BIBLE §2).
import { MINIGAMES_CFG } from '@marea/content';
import { LAVA_TILE as T, geyserAvvisa, getto, magminoX, velocitaA } from '@marea/sim/minigames/lava.ts';
import type { LavaState } from '@marea/sim/minigames/lava.ts';
import { PAL } from './style.ts';
import { FONT, dith, hash, tri } from './pixel_kit.ts';
import type { Col } from './pixel_kit.ts';
import { creaCose, creaOmino } from './lava_sprite.ts';
import type { Sprite } from './lava_sprite.ts';

const CFG = MINIGAMES_CFG.lava;
/** Quanto deve vedersi del mondo (px del gioco) in larghezza e altezza: il pixel grosso è il più grande intero che li rispetta. */
const MIN_W = 176, MIN_H = 150;

export type Particella = { x: number; y: number; vx: number; vy: number; t: number; vita: number; c: Col; g: number };
export type Testo = { x: number; y: number; t: number; s: string; c: Col };
/** Gli effetti solo del client di una partita: particelle, numeri che volano, scosse, e la memoria del tick prima per disegnare a metà. */
export type ScenaLava = {
  part: Particella[]; fx: Testo[];
  px: number; py: number; vyPrima: number;
  scuoti: number; lampo: number; lampoC: Col;
  camY: number; camInit: boolean; tPrev: number; camX: number;
  tSalto: number; tAtterra: number; tSpin: number; tColpo: number; battito: number;
  /** Secondi (dell'animazione) in cui è finita la corsa, −1 = si gioca. */
  fineT: number;
};
export const scenaLava = (s: LavaState): ScenaLava => ({
  part: [], fx: [], px: s.c.x, py: s.c.y, vyPrima: 0, scuoti: 0, lampo: 0, lampoC: 'sabbiaChiara', camY: 0, camInit: false, tPrev: 0, camX: s.c.x,
  tSalto: -99, tAtterra: -99, tSpin: -99, tColpo: -99, battito: 0, fineT: -1,
});

const blocca = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Mattoncini di cielo e di lontananza, rifatti a ogni cambio di misura. */
type Fondali = { cielo: Sprite; alone: Sprite; vulcano: Sprite; guglie: Sprite; vignetta: Sprite };

function fondali(W: number, H: number): Fondali {
  const tela = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const colora = (c: HTMLCanvasElement, fn: (x: number, y: number) => Col | null) => {
    const g = c.getContext('2d')!;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const k = fn(x, y); if (k) { g.fillStyle = PAL[k]; g.fillRect(x, y, 1, 1); } }
    return c;
  };
  // cielo di cenere: nero in alto, roccia in basso, a puntini
  const cielo = colora(tela(W, H), (x, y) => {
    const u = y / (H * 0.8);
    return u < 0.2 ? 'neroCaldo' : u < 0.45 ? (dith(x, y, (u - 0.2) / 0.25) ? 'roccia' : 'neroCaldo') : u < 0.72 ? (dith(x, y, (u - 0.45) / 0.27) ? 'pietraScura' : 'roccia') : (dith(x, y, (u - 0.72) / 0.28) ? 'rosso' : 'pietraScura');
  });
  // bagliore della lava sul fondo delle nubi
  const alone = colora(tela(W, 44), (x, y) => (dith(x, y, (y / 44) * (y / 44)) ? (y > 36 ? 'arancio' : 'rosso') : null));
  // il vulcano lontano (400 px, si ripete): cono nero, colate, cratere
  const vulcano = colora(tela(400, 84), (x, y) => {
    const cx = 200, k = y - 8, half = 4 + k * 0.62;
    if (k < 0 || Math.abs(x - cx) > half) return null;
    if (k === 0) return Math.abs(x - cx) < 4 ? 'giallo' : 'arancio';
    const c1 = cx + 1 + k * 0.22, c2 = cx - 2 - k * 0.2;
    if ((Math.abs(x - c1) < 1 && k < 52) || (Math.abs(x - c2) < 1 && k > 5 && k < 44)) return hash(x, y) % 3 ? 'rosso' : 'arancio';
    return x > cx + half - 3 && dith(x, y, 0.5) ? 'roccia' : 'neroCaldo';
  });
  // guglie di basalto (400 px, si ripetono), coi piedi accesi dalla lava
  const profilo: number[] = [];
  for (let x = 0, i = 0; x < 400; i++) { const gap = 6 + hash(i, 1) % 18, w = 6 + hash(i, 2) % 10, h = 16 + hash(i, 3) % 24; for (let k = 0; k < gap && x < 400; k++, x++) profilo.push(0); for (let k = 0; k < w && x < 400; k++, x++) profilo.push(Math.round(h * (0.55 + 0.45 * (1 - Math.abs(2 * (k / (w - 1)) - 1))))); }
  const guglie = colora(tela(400, 48), (x, y) => { const h = profilo[x] ?? 0; return y < 48 - h ? null : y > 43 && dith(x, y, 0.5) ? 'rosso' : 'neroCaldo'; });
  // vignetta rossa sul bordo sinistro, a puntini: si accende quando il muro è vicino
  const vignetta = colora(tela(26, H), (x, y) => (dith(x, y, 1 - x / 26) ? (x < 8 ? 'arancio' : 'rosso') : null));
  return { cielo, alone, vulcano, guglie, vignetta };
}

export function createPittoreLava(cv: HTMLCanvasElement) {
  const g = cv.getContext('2d', { alpha: false })!;
  const omino = creaOmino(), cose = creaCose();
  let W = 1, H = 1, S = 1, fon: Fondali | null = null, patRoccia: CanvasPattern, patLava: CanvasPattern, patBagliore: CanvasPattern;

  /** Adatta la tela allo schermo (vw × vh px CSS): pixel grosso intero, tela un po' più grande dello schermo, centrata. */
  function ridimensiona(vw: number, vh: number): void {
    S = Math.max(1, Math.min(8, Math.floor(Math.min(vw / MIN_W, vh / MIN_H))));
    W = Math.ceil(vw / S); H = Math.ceil(vh / S);
    cv.width = W; cv.height = H; cv.style.width = `${W * S}px`; cv.style.height = `${H * S}px`;
    g.imageSmoothingEnabled = false;
    patRoccia = g.createPattern(cose.roccia, 'repeat')!; patLava = g.createPattern(cose.lava, 'repeat')!; patBagliore = g.createPattern(cose.bagliore, 'repeat')!;
    fon = fondali(W, H);
  }
  const rect = (c: Col, x: number, y: number, w: number, h: number) => { g.fillStyle = PAL[c]; g.fillRect(x, y, w, h); };
  const scrivi = (s: string, x0: number, y0: number, c: Col) => {
    x0 = Math.round(x0 - (s.length * 4 - 1) / 2); y0 = Math.round(y0);
    for (const [col, d] of [['neroCaldo', 1], [c, 0]] as const) {
      g.fillStyle = PAL[col];
      for (let i = 0; i < s.length; i++) { const gl = FONT[s[i]!]; if (gl) for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (gl[y]![x] === '1') g.fillRect(x0 + i * 4 + x + d, y0 + y + d, 1, 1); }
    }
  };
  /** Primo indice con x1 ≥ x in un array ordinato (rocce, gemme…). */
  const da = <A>(a: readonly A[], x: number, f: (e: A) => number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(a[m]!) < x) lo = m + 1; else hi = m; } return lo; };

  function disegna(s: LavaState, sc: ScenaLava, t: number, alpha: number, fermo: boolean): void {
    if (!fon) return;
    if (s.done && sc.fineT < 0) sc.fineT = t;
    const c = s.c, xi = sc.px + (c.x - sc.px) * alpha, yi = sc.py + (c.y - sc.py) * alpha, tk = s.tick + alpha;
    // ---- camera: il corridore a un terzo dello schermo; in alto segue chi sale, la lava resta sempre in basso ----
    const PX = blocca(Math.round(W * 0.3), 52, 120), dt = Math.min(0.1, Math.max(0, t - sc.tPrev)); sc.tPrev = t;
    const target = Math.min(-(H - Math.max(48, Math.round(H * 0.28))), yi - H * 0.6);
    if (!sc.camInit) { sc.camY = target; sc.camInit = true; }
    sc.camY += (target - sc.camY) * (1 - Math.exp(-dt * (target < sc.camY ? 7 : 4)));
    const camX = Math.round(xi) - PX, camY = Math.round(sc.camY), lavaSY = -camY;
    sc.camX = camX;
    // ---- fondali ----
    g.drawImage(fon.cielo, 0, 0);
    g.drawImage(fon.alone, 0, lavaSY - 44);
    for (let k = -1; k <= 1; k++) g.drawImage(fon.vulcano, Math.round(-camX * 0.05) % 400 + 400 * k + 60, lavaSY - 84);
    for (let k = -1; k <= 1; k++) { // fumo e lapilli dei crateri
      const cx = Math.round(-camX * 0.05) % 400 + 400 * k + 260;
      if (cx > -30 && cx < W + 30) for (let i = 0; i < 14; i++) {
        const h1 = hash(i, 5), a = (t * 0.5 + (h1 % 100) / 100) % 1;
        rect(h1 % 3 ? 'pietraScura' : 'rosso', cx + (h1 % 9) - 4 + Math.round(a * 14), Math.round(lavaSY - 76 - a * 38), 1, 1);
      }
    }
    for (let k = -1; k <= 1; k++) g.drawImage(fon.guglie, Math.round(-camX * 0.3) % 400 + 400 * k, lavaSY - 48);
    for (let i = 0; i < 36; i++) { // cenere che cade
      const h1 = hash(i, 31), x = (((h1 % 400) - Math.floor(t * 12) - Math.floor(camX * 0.5)) % W + W) % W, y = (((h1 >> 9) % H) + Math.floor(t * 9)) % H;
      rect(i % 3 ? 'pietraScura' : 'pietra', x, y, 1, 1);
    }
    // ---- mondo ----
    g.save();
    const sx = sc.scuoti > 0 ? Math.round(tri(t * 40) * Math.min(3, sc.scuoti / 3)) : 0, sy = sc.scuoti > 0 ? Math.round(tri(t * 53 + 1) * Math.min(2, sc.scuoti / 4)) : 0;
    g.translate(-camX + sx, -camY + sy);
    const pezzi = s.mondo.pezzi, xa = camX - 24, xb = camX + W + 24;
    for (let i = da(pezzi, xa, (p) => p.x1); i < pezzi.length && pezzi[i]!.x0 <= xb; i++) {
      const p = pezzi[i]!, top = -p.h * T, w = p.x1 - p.x0;
      g.fillStyle = patRoccia; g.fillRect(p.x0, top + 3, w, -top + 14);
      g.fillStyle = patBagliore; g.fillRect(p.x0, -6, w, 6);
      rect('pietraChiara', p.x0, top, w, 1); rect('pietra', p.x0, top + 1, w, 1); rect('pietraScura', p.x0, top + 2, w, 1);
      rect('neroCaldo', p.x0, top, 1, -top + 12); rect('neroCaldo', p.x1 - 1, top, 1, -top + 12);
    }
    // ---- il mare di lava (davanti alle basi delle rocce) ----
    const ondeX = Math.floor(t * 10);
    if (camY + H > -4) { g.fillStyle = patLava; g.save(); g.translate(Math.round(-t * 6), 0); g.fillRect(camX + Math.round(t * 6) - 4, 0, W + 8, camY + H + 8); g.restore(); }
    for (let x = camX; x < camX + W + 2; x += 2) { // pelo della lava: onde e bolle
      const o = Math.round(tri((x + ondeX) * 0.05) * 1.2);
      rect('giallo', x, o - 1, 2, 2); rect('arancio', x, o + 1, 2, 1);
      if (hash(x, Math.floor(t * 3)) % 23 === 0) rect('giallo', x, -3 + o, 1, 2);
    }
    // ---- mensole ----
    for (const m of s.mondo.mensole) {
      if (m.x1 < xa || m.x0 > xb) continue;
      const top = -m.h * T;
      g.fillStyle = patRoccia; g.fillRect(m.x0, top + 3, m.x1 - m.x0, 5);
      rect('pietraChiara', m.x0, top, m.x1 - m.x0, 1); rect('pietra', m.x0, top + 1, m.x1 - m.x0, 2); rect('neroCaldo', m.x0, top + 8, m.x1 - m.x0, 1);
      rect('neroCaldo', m.x0, top + 1, 1, 7); rect('neroCaldo', m.x1 - 1, top + 1, 1, 7);
    }
    // ---- spuntoni, sfiati, magmini ----
    for (const p of s.mondo.spuntoni) if (p.x > xa && p.x < xb) g.drawImage(cose.spuntone, p.x - 4, -p.h * T - 9);
    for (const v of s.mondo.geyser) {
      if (v.x < xa || v.x > xb) continue;
      const base = -v.h * T, h = getto(v, s.tick), x = v.x;
      g.drawImage(cose.sfiato, x - 5, base - 4);
      if (h > 0) {
        for (let y = Math.floor(base - h); y < base - 3; y++) {
          const a = Math.round(tri(y * 0.2 + t * 4) * 0.7);
          rect('rosso', x - 3 + a, y, 7, 1); rect('arancio', x - 2 + a, y, 5, 1); rect('giallo', x - 1 + a, y, 3, 1);
        }
        rect('giallo', x - 4, Math.floor(base - h) - 1 + (Math.floor(t * 12) % 2), 9, 1);
      } else if (geyserAvvisa(v, s.tick)) {
        for (let k = 0; k < 4; k++) { const hh = hash(k, Math.floor(t * 10) + v.x); rect(k % 2 ? 'giallo' : 'arancio', x - 3 + (hh % 7), base - 5 - ((hh >> 4) % 7), 1, 1); }
      }
    }
    const mg = s.mondo.magmini;
    for (let i = 0; i < mg.length; i++) {
      const m = mg[i]!;
      if (s.morti[i] || m.x + m.amp < xa || m.x - m.amp > xb) continue;
      g.drawImage(cose.magmino[Math.floor(t * 6 + i) % 2]!, Math.round(magminoX(m, tk)) - 5, -m.h * T - 9);
    }
    // ---- gemme ----
    const gem = s.gemme;
    for (let i = da(gem, xa, (q) => q.x); i < gem.length && gem[i]!.x < xb; i++) {
      const q = gem[i]!;
      if (q.preso) continue;
      const sp = q.k === 'ossidiana' ? cose.ossidiana : q.k === 'rubino' ? cose.rubino : cose.scintilla[Math.floor(t * 4) % 2]!;
      g.drawImage(sp, Math.round(q.x - sp.width / 2), Math.round(q.y - sp.height / 2 + tri(t * 0.8 + q.x * 0.05)));
    }
    // ---- il corridore ----
    if (!(s.done && s.fine === 'bruciato' && sc.fineT >= 0 && t - sc.fineT > 0.35)) {
      const aria = !c.terra, ferito = s.tick - sc.tColpo < 24, gira = aria && s.tick - sc.tSpin < 14;
      let sp: Sprite = ferito || (s.done && s.fine === 'bruciato') ? omino.scotta : c.scav > 0 && c.vy < 0 ? omino.scavalca : aria ? (c.vy < 0 ? omino.salto : omino.cade) : omino.corsa[Math.floor(xi / 9) & 3]!;
      let w = sp.width, h = sp.height;
      if (s.tick - sc.tSalto < 5 && aria) { w -= 1; h += 2; } else if (s.tick - sc.tAtterra < 5 && c.terra) { w += 2; h -= 2; }
      const dx = Math.round(xi) - Math.floor(w / 2), dy = Math.round(yi) - h;
      if (c.inv > 0 && !ferito && Math.floor(c.inv / 3) % 2) g.globalAlpha = 0.45;
      if (gira) { g.save(); g.translate(dx + w / 2, dy + h / 2); g.rotate((Math.floor((s.tick - sc.tSpin) / 3) % 4) * Math.PI / 2); g.drawImage(sp, -w / 2, -h / 2, w, h); g.restore(); } else g.drawImage(sp, dx, dy, w, h);
      g.globalAlpha = 1;
      if (Math.floor(t * 5) % 4) rect('giallo', Math.round(xi) - 1, dy + 1, 1, 1); // la lanterna fa luce
    }
    // ---- particelle e numeri ----
    for (const p of sc.part) rect(p.c, Math.round(p.x), Math.round(p.y), 1, 1);
    for (const e of sc.fx) scrivi(e.s, e.x, e.y - e.t * 0.4, e.c);
    // ---- il muro di lava che ti insegue: tutto a sinistra del suo bordo ----
    const extra = s.done && s.fine === 'bruciato' && sc.fineT >= 0 ? Math.min(W + 40, (t - sc.fineT) * 260) : 0;
    const bordo = Math.round(c.x - c.margine + 8 + extra);
    if (bordo > camX - 4) {
      for (let y = camY; y < camY + H + 2; y += 2) {
        const f = hash(y >> 1, Math.floor(t * 8)), lingua = f % 7 === 0 ? 6 + (f >> 4) % 6 : 0, e = bordo + Math.round(tri(y * 0.05 + t * 2) * 4) + lingua;
        g.fillStyle = patLava; g.fillRect(camX - 2, y, e - camX + 2, 2);
        rect('arancio', e - 4, y, 2, 2); rect('giallo', e - 2, y, 2, 2);
      }
    }
    g.restore();
    // ---- pericolo: bordo rosso quando il muro è vicino; velocità; lampo ----
    const pericolo = blocca((CFG.muro.margine * 0.6 - c.margine) / (CFG.muro.margine * 0.6), 0, 1);
    if (pericolo > 0 && !s.done) { g.globalAlpha = pericolo; g.drawImage(fon.vignetta, 0, 0); g.globalAlpha = 1; }
    if (velocitaA(c.x) > CFG.corsa.velocitaMax * 0.8 && !fermo) { // righe di velocità: corte, vicino al suolo
      g.globalAlpha = 0.55;
      for (let i = 0; i < 5; i++) { const h1 = hash(i, Math.floor(t * 6)); rect('pietra', (W - ((t * 380 + h1) % (W + 20))) | 0, Math.max(0, lavaSY - 14 - (h1 % 80)), 8 + (h1 % 5), 1); }
      g.globalAlpha = 1;
    }
    if (sc.lampo > 0) { g.globalAlpha = Math.min(0.5, sc.lampo / 8); rect(sc.lampoC, 0, 0, W, H); g.globalAlpha = 1; }
  }
  return { ridimensiona, disegna, ora: () => ({ W, H, S }) };
}
