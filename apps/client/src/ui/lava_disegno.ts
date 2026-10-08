// Fuga dalla lava: il disegno del vulcano (192×136 a pixel, ImageData scalato «nearest»), separato dalla schermata (ui/lava.ts, stesso
// chunk). Cielo di cenere, il vulcano lontano che erutta, guglie di basalto in parallasse, il mare di lava che ribolle; colonne di basalto
// a canne (le crepate brillano e affondano), geyser che bollono e poi eruttano, ossidiana, scintille e rubini; il corridore con la Lanterna
// in testa e l'onda di lava che lo insegue a sinistra. Solo colori della palette (ART_BIBLE §2), niente gradienti lisci.
import { MINIGAMES_CFG } from '@marea/content';
import { LAVA_Y, cimaAt, createRng, geyserAvvisa, getto } from '@marea/sim';
import type { LavaState } from '@marea/sim';
import { RGBA, createTela, dith, hash, tri } from './pixel_kit.ts';
import type { Col } from './pixel_kit.ts';
import { suona } from '../audio/ponte.ts';

const CFG = MINIGAMES_CFG.lava;
export const W = 192, H = 136;
/** Il corridore sta fermo a DX sullo schermo (il mondo scorre). */
const DX = 56;

export type Fx = { x: number; y: number; t: number; testo: string; col: Col };
export type ScenaLava = {
  fx: Fx[];
  /** Fumo, polvere, gocce di lava (coordinate del mondo). */
  part: { x: number; y: number; vx: number; vy: number; t: number; c: Col; vita: number }[];
  /** Tick delle ultime scottature (l'onda alle spalle si avvicina). */
  scotte: number[];
  /** Guglie lontane (profilo dal seed). */
  guglie: number[];
};

export function scenaLava(_s: LavaState, seed: number): ScenaLava {
  const r = createRng(seed).fork('guglie'), guglie: number[] = [];
  while (guglie.length < 900) {
    const gap = r.int(6, 26), w = r.int(5, 14), h = r.int(14, 40);
    for (let i = 0; i < gap; i++) guglie.push(0);
    for (let i = 0; i < w; i++) { const u = 1 - Math.abs(2 * (i / (w - 1)) - 1); guglie.push(Math.round(h * (0.55 + 0.45 * u)) + (r.next() < 0.25 ? 2 : 0)); }
  }
  return { fx: [], part: [], scotte: [], guglie };
}

const COSA_COL: Record<string, Col> = { ossidiana: 'viola', scintilla: 'giallo', rubino: 'rosaNeon' };
export function effettiLava(s: LavaState, sc: ScenaLava): void {
  const u = s.ultimo;
  if (u.salto) { suona('salto'); for (let i = 0; i < 4; i++) sc.part.push({ x: s.x - 2 + i, y: s.y, vx: -0.4 - i * 0.1, vy: -0.3, t: 0, c: 'pietraScura', vita: 14 }); }
  if (u.atterra) for (let i = 0; i < 3; i++) sc.part.push({ x: s.x - 3 + i * 3, y: s.y, vx: (i - 1) * 0.4, vy: -0.4, t: 0, c: 'pietra', vita: 10 });
  if (u.scotta) {
    suona('sfrigola'); sc.scotte.push(s.tick);
    sc.fx.push({ x: s.x, y: s.y - 20, t: 0, testo: `-${CFG.scottatura.punti}`, col: 'rosso' });
    for (let i = 0; i < 10; i++) sc.part.push({ x: s.x - 4 + i, y: s.y - 2, vx: (i - 5) * 0.12, vy: -0.6 - (i % 3) * 0.3, t: 0, c: i % 3 ? 'pietraScura' : 'arancio', vita: 30 });
  }
  for (const k of u.presi) {
    suona(k === 'ossidiana' ? 'raccolto' : 'moneta', k === 'rubino' ? 1 : 0.5);
    sc.fx.push({ x: s.x, y: s.y - 18, t: 0, testo: `+${CFG.punti[k]}`, col: COSA_COL[k]! });
  }
  // gocce dai geyser che eruttano (vicini)
  for (const g of s.geyser) {
    if (Math.abs(g.x - s.x) > 150) continue;
    const h = getto(g, s.tick);
    if (h > g.alto * 0.8 && s.tick % 3 === 0) { const hh = hash(s.tick, g.x); sc.part.push({ x: g.x + (hh % 7) - 3, y: g.base - h, vx: ((hh >> 3) % 9 - 4) * 0.15, vy: -0.8 - ((hh >> 6) % 4) * 0.2, t: 0, c: hh % 2 ? 'giallo' : 'arancio', vita: 40 }); }
  }
  for (const p of sc.part) { p.t++; p.x += p.vx; p.y += p.vy; p.vy += p.c === 'pietraScura' ? -0.01 : 0.06; }
  sc.part = sc.part.filter((p) => p.t < p.vita && p.y < LAVA_Y + 2);
  for (const e of sc.fx) e.t++;
  sc.fx = sc.fx.filter((e) => e.t < 50);
  sc.scotte = sc.scotte.filter((t) => s.tick - t < 360);
}

// ---------- sprite ----------
const MAP: Record<string, Col> = {
  n: 'neroCaldo', r: 'roccia', q: 'pietraScura', Q: 'pietra', p: 'pietraChiara', s: 'sabbia', w: 'sabbiaChiara', c: 'legnoScuro', b: 'legno',
  R: 'rosso', O: 'arancio', Y: 'giallo', v: 'viola', k: 'rosaNeon', A: 'acqua', D: 'acquaProfonda',
};
// il corridore (9×13, guarda a destra) con la Lanterna in testa: corsa (2 fotogrammi), salto, scottato
const OMINO = {
  corsa: [
    ['...nn....', '..nRRn...', '..RYYR...', '..nRRn...', '...ss....', '..ssns...', '..ss.....', '.DAAAs...', '.sAAA....', '..AAA....', '..cc.c...', '.cc...c..', '.n....nn.'],
    ['...nn....', '..nRRn...', '..RYYR...', '..nRRn...', '...ss....', '..ssns...', '..ss.....', '..AAAD...', '..AAAs...', '..AAA....', '...cc....', '...cc....', '..nnn....'],
  ],
  salto: ['...nn....', '..nRRn...', '..RYYR...', '..nRRn...', '...ss....', '..ssns...', 's.ss..s..', '.sAAAAs..', '..AAA....', '..AAA....', '.cc.cc...', 'nc...cn..', '.........'],
  scotta: ['..Y.Y....', '..nRRn...', '..RYYR...', '..nRRn...', '...ss....', '..sOOs...', 'sOss.Os..', '.sAAAAs..', '..AAA....', '..AAA....', '.cc.cc...', 'nc...cn..', '.........'],
};
const OSSIDIANA = ['..v..', '.vnv.', 'vnpnv', 'vnnrv', '.vnv.', '..v..'];
const SCINTILLA = [['..Y..', '..Y..', 'YYOYY', '..Y..', '..Y..'], ['.....', '.Y.Y.', '..O..', '.Y.Y.', '.....']];
const RUBINO = ['.RRRR.', 'RkkRRR', 'RkRRRR', '.RRRR.', '..RR..'];

export function createPittoreLava(cv: HTMLCanvasElement): (s: LavaState, sc: ScenaLava, t: number, alpha: number, fermo: boolean) => void {
  const T = createTela(cv, W, H), buf = T.buf, px = T.px;
  const giro = (a: number[], i: number) => a[((i % a.length) + a.length) % a.length]!;

  return (s, sc, t) => {
    const cf = Math.round(s.x) - DX; // x del mondo al bordo sinistro
    // ---- cielo di cenere: nero in alto, roccia in basso (a puntini) ----
    for (let y = 0; y < LAVA_Y; y++) for (let x = 0; x < W; x++)
      buf[y * W + x] = y < 26 ? RGBA.neroCaldo : y < 46 ? (dith(x, y, (y - 26) / 20) ? RGBA.roccia : RGBA.neroCaldo) : RGBA.roccia;
    // il vulcano lontano (scorre pianissimo): cono nero, colate, cratere che brilla, eruzione
    const vx0 = 150 - Math.floor(cf * 0.04) % 400;
    for (const vx of [vx0, vx0 + 400]) {
      for (let y = 58; y < LAVA_Y; y++) {
        const half = 5 + (y - 58) * 0.85, k = y - 58;
        const c1 = vx + 2 + k * 0.35 + tri(y * 0.09) * 1.5, c2 = vx - 2 - k * 0.28 + tri(y * 0.07 + 1) * 1.5; // due colate che scendono e si allargano
        for (let x = Math.round(vx - half); x <= Math.round(vx + half); x++) {
          if (x < 0 || x >= W) continue;
          const colata = (Math.abs(x - c1) < 0.8 && k < 36) || (Math.abs(x - c2) < 0.8 && k > 4 && k < 30);
          buf[y * W + x] = colata ? (hash(x, y) % 3 ? RGBA.rosso : RGBA.arancio) : y === 58 ? RGBA.rosso : x > vx + half - 2 && dith(x, y, 0.5) ? RGBA.roccia : RGBA.neroCaldo;
        }
      }
      for (let x = -3; x <= 3; x++) px(vx + x, 57, RGBA[Math.abs(x) < 2 ? 'giallo' : 'arancio']);
      // pennacchio di fumo e lapilli
      for (let k = 0; k < 40; k++) {
        const h1 = hash(k, 5), age = ((t * 22 + (h1 % 100)) % 100) / 100;
        const sx = vx + tri(h1 * 0.01 + age) * age * 22, sy = 56 - age * 30 + age * age * 26;
        px(sx, sy, RGBA[k % 4 === 0 ? 'giallo' : k % 4 === 1 ? 'arancio' : 'rosso']);
      }
      for (let k = 0; k < 60; k++) { const h1 = hash(k, 9), age = ((t * 6 + (h1 % 100)) % 100) / 100; px(vx + ((h1 >> 4) % 13) - 6 + age * 20, 54 - age * 50, RGBA[age > 0.6 ? 'roccia' : 'pietraScura']); }
    }
    // guglie di basalto in parallasse (0,4), coi piedi accesi dalla lava
    for (let x = 0; x < W; x++) {
      const h = giro(sc.guglie, Math.floor(cf * 0.4) + x);
      if (!h) continue;
      for (let y = LAVA_Y - h; y < LAVA_Y; y++) buf[y * W + x] = y > LAVA_Y - 4 ? (dith(x, y, 0.5) ? RGBA.rosso : RGBA.neroCaldo) : RGBA.neroCaldo;
    }
    // cenere che cade
    for (let i = 0; i < 40; i++) {
      const h1 = hash(i, 31), x = ((h1 % 260) - Math.floor(t * 14) - Math.floor(cf * 0.6)) % W, y = ((h1 >> 9) % LAVA_Y + Math.floor(t * 9)) % LAVA_Y;
      px((x + W) % W, y, RGBA[i % 3 ? 'pietraScura' : 'pietra']);
    }
    // ---- l'onda di lava che insegue (più vicina dopo le scottature) ----
    const recenti = sc.scotte.filter((x) => s.tick - x < 360).length;
    const fronte = 12 + Math.min(4, recenti) * 8 + Math.round(tri(t * 0.7) * 2);
    for (let y = 40; y < LAVA_Y; y++) {
      const fx = fronte - Math.round(((LAVA_Y - y) / 80) * 10) + Math.round(tri(y * 0.08 + t) * 2);
      for (let x = 0; x <= fx; x++) buf[y * W + x] = x >= fx - 1 ? RGBA.giallo : x >= fx - 3 ? RGBA.arancio : hash(x, y + Math.floor(t * 8)) % 5 ? RGBA.arancio : RGBA.rosso;
    }
    // ---- mare di lava: ribolle, croste che scorrono ----
    for (let y = LAVA_Y; y < H; y++) {
      const d = y - LAVA_Y;
      for (let x = 0; x < W; x++) {
        const wx = x + cf, cr = hash(Math.floor((wx + t * 4) / 5), Math.floor(d / 3) + 50);
        const onda = d === 0 && (wx + Math.floor(t * 10)) % 12 < 2;
        buf[y * W + x] = onda ? RGBA.arancio : d === 0 ? RGBA.giallo : d < 3 ? (dith(wx, y, 0.6) ? RGBA.giallo : RGBA.arancio) : cr % 9 === 0 && d % 3 ? RGBA.rosso : RGBA.arancio;
      }
    }
    for (let i = 0; i < 12; i++) { const h1 = hash(i, Math.floor(t * 3)), bx = h1 % W, by = LAVA_Y - 1 - ((h1 >> 8) % 3); px(bx, by, RGBA.giallo); px(bx + 1, by - 1, RGBA.arancio); }
    // ---- colonne di basalto ----
    const lo = cf - 20, hi = cf + W + 20;
    s.colonne.forEach((c, i) => {
      if (c.x1 < lo || c.x0 > hi) return;
      const top = Math.round(cimaAt(c, s.tocchi[i]!, s.tick)), crepata = c.k === 'affonda', scende = crepata && s.tocchi[i]! >= 0;
      const wob = scende ? (Math.floor(t * 20) % 2) : 0;
      for (let wx = c.x0; wx <= c.x1; wx++) {
        const x = wx - cf + (scende ? wob : 0);
        if (x < 0 || x >= W) continue;
        const canna = ((wx - c.x0) % 7), bordo = wx === c.x0 || wx === c.x1;
        for (let y = Math.max(0, top); y < LAVA_Y; y++) {
          const k = y - top;
          let col: Col = k === 0 ? (bordo ? 'pietraScura' : 'pietra') : k === 1 ? 'pietraScura' : bordo || canna === 0 ? 'neroCaldo' : canna === 1 ? 'pietraScura' : 'roccia';
          if (LAVA_Y - y <= 3) col = dith(wx, y, (4 - (LAVA_Y - y)) / 4) ? 'rosso' : col;
          if (crepata && k > 2 && Math.abs(((wx - c.x0) * 2 + k) % 11 - 5) === 0 && hash(wx, k) % 3 !== 0) col = scende && Math.floor(t * 6) % 2 ? 'arancio' : 'rosso';
          buf[y * W + x] = RGBA[col];
        }
      }
    });
    // ---- geyser: bolle d'avviso, poi il getto ----
    for (const g of s.geyser) {
      const x = g.x - cf;
      if (x < -10 || x > W + 10) continue;
      if (g.base < LAVA_Y) { for (let k = -3; k <= 3; k++) px(x + k, g.base, RGBA[Math.abs(k) < 2 ? 'neroCaldo' : 'rosso']); } // sfiato sulla roccia
      const h = getto(g, s.tick);
      if (h > 0) {
        const top = g.base - h;
        for (let y = Math.floor(top); y < g.base; y++) for (let k = -3; k <= 3; k++) {
          const a = Math.abs(k + Math.round(tri(y * 0.2 + t * 4) * 0.6));
          px(x + k, y, RGBA[a <= 1 ? 'giallo' : a === 2 ? 'arancio' : 'rosso']);
        }
        for (let k = -4; k <= 4; k++) px(x + k, top - (Math.abs(k) < 2 ? 2 : 1) + (Math.floor(t * 12 + k) % 2), RGBA[Math.abs(k) < 3 ? 'giallo' : 'arancio']);
      } else if (geyserAvvisa(g, s.tick)) {
        for (let k = 0; k < 4; k++) { const hh = hash(k, Math.floor(t * 10) + g.x); px(x - 3 + (hh % 7), g.base - 1 - ((hh >> 4) % 6), RGBA[k % 2 ? 'giallo' : 'arancio']); }
        px(x, g.base - 1, RGBA.giallo);
      }
    }
    // ---- ossidiana, scintille, rubini ----
    const blink = Math.floor(t * 4) % 2;
    for (const it of s.items) {
      if (it.preso) continue;
      const x = it.x - cf, y = it.y + Math.round(tri(t * 0.8 + it.x * 0.05));
      if (x < -8 || x > W + 8) continue;
      if (it.k === 'ossidiana') { T.spr(OSSIDIANA, x - 2, y - 3, MAP); if (blink && it.x % 3 === 0) px(x + 1, y - 2, RGBA.pietraChiara); }
      else if (it.k === 'scintilla') T.spr(SCINTILLA[blink]!, x - 2, y - 2, MAP);
      else { T.spr(RUBINO, x - 3, y - 2, MAP); if (blink) { px(x + 3, y - 4, RGBA.giallo); px(x + 4, y - 3, RGBA.giallo); px(x + 2, y - 3, RGBA.giallo); } }
    }
    // ---- particelle (fumo, polvere, gocce) ----
    for (const p of sc.part) px(p.x - cf, p.y, RGBA[p.c]);
    // ---- il corridore (lampeggia dopo una scottatura) ----
    if (!(s.inv > 0 && Math.floor(s.inv / 4) % 2 === 0 && s.inv < 54)) {
      const fr = s.inv > 40 ? OMINO.scotta : s.terra < 0 ? OMINO.salto : OMINO.corsa[Math.floor(t * 10) % 2]!;
      T.spr(fr, DX - 4, Math.round(s.y) - 12, MAP);
      // la lanterna fa luce
      if (Math.floor(t * 5) % 4) px(DX - 1, Math.round(s.y) - 13, RGBA.giallo);
    }
    // ---- numeri che volano ----
    for (const e of sc.fx) T.testo(e.testo, e.x - cf, e.y - e.t * 0.4, RGBA[e.col]);
    T.flush();
  };
}
