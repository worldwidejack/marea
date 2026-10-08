// Perle: il disegno del fondale (192×136 a pixel, in un ImageData scalato «nearest»), separato dalla logica della schermata (ui/perle.ts,
// che lo importa: finisce nello stesso chunk scaricato alla prima partita). Cielo con isole lontane, acqua a fasce della famiglia Acqua
// con passaggi a puntini (Bayer), raggi di luce, scogli lontani in parallasse, alghe/coralli/rocce del seed, sabbia a granelli, perle,
// ostriche, meduse, granchi, il sub, bollicine e punti che volano. Solo colori della palette (ART_BIBLE §2), niente gradienti lisci.
import { MINIGAMES_CFG } from '@marea/content';
import { PERLE_X0, fondoAt, pericoloAt } from '@marea/sim';
import type { PerleItem, PerleState } from '@marea/sim';
import { PAL } from './style.ts';

const CFG = MINIGAMES_CFG.perle;
/** Scena 192×136: pelo dell'acqua a SURF, sub fermo a DX sullo schermo (il fondale scorre). */
export const W = 192, H = 136, SURF = 22, DX = 56;
const OST_PER = Math.round(CFG.ostrica.periodoSecondi * 60), OST_OPEN = Math.round(CFG.ostrica.apertaSecondi * 60);

type Col = keyof typeof PAL;
export type Fx = { x: number; y: number; t: number; testo: string; col: Col };
export type Bollicina = { x: number; y: number; vy: number };
/** Tutto quello che serve per disegnare: lo stato della sim più gli effetti solo del client (dal seed o dagli eventi). */
export type Scena = {
  s: PerleState; prevY: number; intro: boolean; end: number;
  preso: Set<PerleItem>; colpi: number; fx: Fx[]; bolle: Bollicina[]; shake: number;
  /** Profilo delle isole all'orizzonte e degli scogli lontani (solo estetica, dal seed). */
  isole: number[]; scogli: number[];
};

// ---------- colori a 32 bit (ImageData little endian: ABGR) ----------
const RGBA = {} as Record<Col, number>;
for (const k of Object.keys(PAL) as Col[]) {
  const h = PAL[k], r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  RGBA[k] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
/** Bayer 4×4: per sfumare a puntini tra due colori vicini della stessa famiglia. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number, t: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16 < t;
/** Onda triangolare in [−1, 1]. */
const tri = (u: number) => Math.abs(((u % 2) + 2) % 2 - 1) * 2 - 1;
const hash = (a: number, b: number) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// ---------- sprite: carattere → colore ----------
const MAP: Record<string, Col> = {
  n: 'neroCaldo', r: 'roccia', q: 'pietraScura', Q: 'pietra', p: 'pietraChiara', w: 'sabbiaChiara', s: 'sabbia', a: 'legnoChiaro', b: 'legno', c: 'legnoScuro',
  R: 'rosso', O: 'arancio', Y: 'giallo', v: 'viola', k: 'rosaNeon', L: 'acquaBassa', B: 'bosco', G: 'erbaScura',
};
// il sub (22×6, guarda a destra): pinne Y, gambe e braccia s, muta R con la fascia O, bombola Q/q, capelli n, maschera L con riflesso w
const SUB = [
  ['...........QQQQ..nnn..', 'Y.........qQQQQqnnnnn.', 'YY..sssRRRRRRRRRssnLLn', '.YYsssRRROORRRRRsssLwn', 'YY..sss.RRRRRRR.sssss.', 'Y..........ss...ss....'],
  ['...........QQQQ..nnn..', '..........qQQQQqnnnnn.', '....sssRRRRRRRRRssnLLn', 'YYYsssRRROORRRRRsssLwn', '.YY.sss.RRRRRRR.sssss.', 'YY.........ss...ss....'],
];
const PERLA: Record<'bianca' | 'nera' | 'rosa', string[]> = {
  bianca: ['.ppp.', 'pwwpQ', 'pwppQ', 'ppQQQ', '.QQQ.'],
  nera: ['.rrr.', 'rvvrn', 'rvrrn', 'rrnnn', '.nnn.'],
  rosa: ['.kkk.', 'kwwkR', 'kwkkR', 'kkRRR', '.RRR.'],
};
const CONCH = ['...O...', '.OOwOO.', 'OsOsOsO', 'OsOsOsO', '.OsOsO.', '..aaa..'];
const BOLLA = ['..LLL..', '.Lp..L.', 'Lp....L', 'L.....L', 'L....LL', '.L..LL.', '..LLL..'];
const MEDUSA = [['...vvv...', '.vvkkkvv.', 'vkkwkkwkv', 'vkkkkkkkv', 'vvvvvvvvv'], ['...vvv...', '.vvkkkvv.', 'vkkwkkwkv', 'vvvvvvvvv']];
const GRANCHIO = [
  ['RR.......RR', 'ROR.n.n.ROR', '.R.RRRRR.R.', '..RROOORR..', '.RRRRRRRRR.', '.n.n...n.n.'],
  ['RR.......RR', 'ROR.n.n.ROR', '.R.RRRRR.R.', '..RROOORR..', '.RRRRRRRRR.', 'n.n.....n.n'],
];
const BARCA = ['...aaaaaaaaaaaaaaaaaa...', '..bbbbbbbbbbbbbbbbbbbbb.', '...cbbbbbbbbbbbbbbbbbc..', '....cccccccccccccccc....'];
// cifre 3×5 per i punti che volano
const FONT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '!': ['010', '010', '010', '000', '010'],
};
const KIND_COL: Record<string, Col> = { bianca: 'pietraChiara', conchiglia: 'arancio', rosa: 'rosaNeon', nera: 'giallo', bolla: 'acquaBassa' };
const ACQUA: Col[] = ['acquaBassa', 'acqua', 'acquaProfonda', 'abisso'];

/** Effetti di un tick (dopo lo step della sim): numeri che volano per le prese, bollicine, scossa ai colpi. */
export function effetti(sc: Scena): void {
  const s = sc.s;
  for (const it of s.items) {
    if (!it.preso || sc.preso.has(it)) continue;
    sc.preso.add(it);
    const v = it.k === 'bolla' ? 0 : CFG.punti[it.k];
    sc.fx.push({ x: it.x, y: it.y - 7, t: 0, testo: v ? `+${v}` : '', col: KIND_COL[it.k]! });
    if (it.k === 'bolla') for (let i = 0; i < 7; i++) sc.bolle.push({ x: it.x - 3 + (i % 3) * 3, y: it.y - (i >> 1) * 2, vy: -0.5 - i * 0.08 });
  }
  if (s.colpi > sc.colpi) { sc.colpi = s.colpi; sc.shake = 12; sc.fx.push({ x: s.x, y: s.y - 9, t: 0, testo: '!', col: 'rosso' }); }
  if (s.y > 2 && s.tick % (s.hold ? 14 : 24) === 0) sc.bolle.push({ x: s.x + 10, y: s.y - 2, vy: -0.45 });
  for (const b of sc.bolle) { b.y += b.vy; b.vy = Math.max(-1, b.vy - 0.01); }
  sc.bolle = sc.bolle.filter((b) => b.y > 1 && b.x > s.x - DX - 10);
  for (const e of sc.fx) e.t++;
  sc.fx = sc.fx.filter((e) => e.t < 50);
  if (sc.shake > 0) sc.shake--;
}

export function createPittore(cv: HTMLCanvasElement): (sc: Scena, t: number, alpha: number) => void {
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
  const px = (xx: number, yy: number, c: number) => { xx = Math.round(xx); yy = Math.round(yy); if (xx >= 0 && yy >= 0 && xx < W && yy < H) buf[yy * W + xx] = c; };
  const rect = (x0: number, y0: number, w: number, h: number, c: number) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(x0 + xx, y0 + yy, c); };
  const spr = (rows: readonly string[], x0: number, y0: number, flip = false) => {
    x0 = Math.round(x0); y0 = Math.round(y0);
    for (let yy = 0; yy < rows.length; yy++) { const r = rows[yy]!; for (let xx = 0; xx < r.length; xx++) { const c = MAP[r[flip ? r.length - 1 - xx : xx]!]; if (c) px(x0 + xx, y0 + yy, RGBA[c]); } }
  };
  const testo = (s: string, x0: number, y0: number, c: number) => {
    x0 = Math.round(x0 - (s.length * 4 - 1) / 2); y0 = Math.round(y0);
    for (const pass of [0, 1]) for (let i = 0; i < s.length; i++) {
      const gl = FONT[s[i]!]; if (!gl) continue;
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (gl[yy]![xx] === '1') {
        if (pass === 0) { px(x0 + i * 4 + xx + 1, y0 + yy + 1, RGBA.neroCaldo); px(x0 + i * 4 + xx, y0 + yy + 1, RGBA.neroCaldo); }
        else px(x0 + i * 4 + xx, y0 + yy, c);
      }
    }
  };
  /** Colore dell'acqua: fasce della famiglia Acqua, a puntini nei passaggi; `luce` = un gradino più chiaro (raggi). */
  const acquaAt = (xx: number, yy: number, luce: boolean): number => {
    const d = yy - SURF;
    let i: number;
    if (d < 3) i = 0; else if (d < 9) i = dith(xx, yy, (d - 3) / 6) ? 1 : 0;
    else if (d < 26) i = 1; else if (d < 36) i = dith(xx, yy, (d - 26) / 10) ? 2 : 1;
    else if (d < 62) i = 2; else if (d < 76) i = dith(xx, yy, (d - 62) / 14) ? 3 : 2; else i = 3;
    if (luce && i > 0) i--;
    return RGBA[ACQUA[i]!];
  };
  const giro = (a: number[], i: number) => a[((i % a.length) + a.length) % a.length]!;

  return (sc, t, alpha) => {
    const s = sc.s, fermo = sc.intro || sc.end >= 0;
    const subX = s.x + (fermo ? 0 : CFG.velocita * alpha), subY = sc.prevY + (s.y - sc.prevY) * (fermo ? 1 : alpha);
    const shake = sc.shake > 0 ? (sc.shake % 4 < 2 ? 1 : -1) : 0;
    const cf = Math.floor(subX - DX) + shake;
    // cielo a fasce e isole lontane che scorrono piano
    for (let yy = 0; yy < SURF; yy++) for (let xx = 0; xx < W; xx++)
      buf[yy * W + xx] = yy < 9 ? RGBA.acquaBassa : yy < 15 ? (dith(xx, yy, (yy - 9) / 6) ? RGBA.pietraChiara : RGBA.acquaBassa) : RGBA.pietraChiara;
    for (let xx = 0; xx < W; xx++) {
      const h = giro(sc.isole, Math.floor(cf * 0.2) + xx);
      for (let k = 0; k < h; k++) px(xx, SURF - 1 - k, k === h - 1 ? RGBA.erbaScura : RGBA.bosco);
    }
    // acqua, con pochi raggi di luce morbidi (a puntini, più radi andando giù)
    for (let yy = SURF; yy < H; yy++) {
      const d = yy - SURF;
      for (let xx = 0; xx < W; xx++) {
        const r = ((xx + Math.floor(cf * 0.35) + Math.floor(d * 0.55) - Math.floor(t * 3)) % 112 + 112) % 112;
        const luce = d > 2 && d < 58 && r < 6 && dith(xx, yy, (1 - d / 58) * (r === 0 || r === 5 ? 0.25 : 0.55));
        buf[yy * W + xx] = acquaAt(xx, yy, luce);
      }
    }
    // scogli lontani (parallasse ½): sagome scure nell'acqua profonda
    for (let xx = 0; xx < W; xx++) {
      const top = giro(sc.scogli, Math.floor(cf * 0.5) + xx);
      for (let yy = SURF + top; yy < H; yy++) {
        const k = yy - SURF - top;
        if (k === 0 && !dith(xx, yy, 0.5)) continue;
        buf[yy * W + xx] = k < 2 ? RGBA.acquaProfonda : RGBA.abisso;
      }
    }
    // pelo dell'acqua: creste che si muovono
    for (let xx = 0; xx < W; xx++) {
      const wv = (((xx + cf + Math.floor(t * 10)) % 13) + 13) % 13;
      if (wv < 3) px(xx, SURF - 1, RGBA.acquaBassa);
      if (wv === 1) px(xx, SURF - 2, RGBA.pietraChiara);
      px(xx, SURF, wv < 6 ? RGBA.pietraChiara : RGBA.acquaBassa);
    }
    // la barca da cui ti sei tuffato
    const bx = PERLE_X0 - 22 - cf;
    if (bx > -30) spr(BARCA, bx, SURF - 3 + (Math.floor(t * 2) % 2));
    // alghe, coralli, rocce (dal seed della sim), piantati nel fondale
    for (const d of s.decor) {
      const sx = d.x - cf;
      if (sx < -12 || sx > W + 12) continue;
      const base = Math.round(SURF + fondoAt(s.fondo, d.x));
      if (d.k === 'alga') {
        const [c1, c2] = ([['erbaScura', 'bosco'], ['erba', 'erbaScura'], ['bosco', 'erbaScura']] as [Col, Col][])[d.v]!;
        for (let i = 0; i < d.h; i++) {
          const sw = Math.round(tri(t * 0.6 + i * 0.09 + d.x * 0.013) * Math.min(2, i / 6));
          px(sx + sw, base - i, RGBA[i % 3 === 0 ? c2 : c1]); px(sx + sw + 1, base - i, RGBA[c2]);
          if (i % 5 === 3) px(sx + sw + (i % 10 < 5 ? -1 : 2), base - i, RGBA[c1]);
        }
      } else if (d.k === 'corallo') {
        const [c1, c2] = ([['rosso', 'arancio'], ['rosaNeon', 'rosso'], ['viola', 'rosaNeon'], ['arancio', 'giallo']] as [Col, Col][])[d.v]!;
        const h = d.h, b1 = Math.round(h * 0.4), b2 = Math.round(h * 0.7);
        for (let i = 0; i < h; i++) { px(sx, base - i, RGBA[c1]); px(sx + 1, base - i, RGBA[i < 2 ? c1 : c2]); }
        for (let i = 1; i <= 3; i++) { px(sx - i, base - b1, RGBA[c1]); px(sx + 1 + i, base - b2, RGBA[c1]); px(sx - 3, base - b1 - i, RGBA[c1]); px(sx + 4, base - b2 - i, RGBA[c1]); }
        px(sx - 3, base - b1 - 4, RGBA[c2]); px(sx + 4, base - b2 - 4, RGBA[c2]); px(sx, base - h, RGBA[c2]); px(sx + 1, base - h, RGBA[c2]);
      } else {
        const w = d.h * 2 + 2;
        for (let yy = 0; yy < d.h; yy++) {
          const half = Math.round((w / 2) * Math.sqrt(1 - (yy / d.h) * (yy / d.h)));
          for (let xx = -half; xx <= half; xx++) px(sx + xx, base - yy, RGBA[yy === d.h - 1 || xx === -half ? 'pietraScura' : d.v ? 'roccia' : 'pietraScura']);
        }
      }
    }
    // fondale: sabbia a granelli, più scura in basso
    for (let xx = 0; xx < W; xx++) {
      const wx = cf + xx, fy = Math.round(SURF + fondoAt(s.fondo, wx));
      for (let yy = Math.max(fy, SURF); yy < H; yy++) {
        const k = yy - fy, hh = hash(wx, yy);
        buf[yy * W + xx] = k === 0 ? RGBA.sabbiaChiara : k < 3 ? (hh % 9 === 0 ? RGBA.legnoChiaro : RGBA.sabbia)
          : k < 9 ? (dith(wx, yy, (k - 3) / 6) ? RGBA.legnoChiaro : hh % 11 === 0 ? RGBA.sabbiaChiara : RGBA.sabbia)
          : hh % 13 === 0 ? RGBA.sabbia : RGBA.legnoChiaro;
      }
    }
    // perle, conchiglie, ostriche, bolle
    const blink = Math.floor(t * 3) % 4 === 0;
    for (const it of s.items) {
      if (it.preso) continue;
      const sx = Math.round(it.x - cf), sy = Math.round(SURF + it.y);
      if (sx < -14 || sx > W + 14) continue;
      if (it.k === 'bianca') { spr(PERLA.bianca, sx - 2, sy - 2); if (blink && it.x % 3 === 0) { px(sx + 3, sy - 4, RGBA.giallo); px(sx + 3, sy - 2, RGBA.giallo); px(sx + 2, sy - 3, RGBA.giallo); px(sx + 4, sy - 3, RGBA.giallo); } }
      else if (it.k === 'nera') {
        const on = Math.floor(t * 4) % 2 === 0;
        for (const [ox, oy] of [[-5, 0], [5, 0], [0, -5], [0, 5], [-4, -4], [4, 4], [4, -4], [-4, 4]] as [number, number][]) if (on === ((ox + oy) % 2 === 0)) px(sx + ox, sy + oy, RGBA.viola);
        spr(PERLA.nera, sx - 2, sy - 2);
        if (blink) { px(sx + 3, sy - 5, RGBA.giallo); px(sx + 2, sy - 4, RGBA.giallo); px(sx + 4, sy - 4, RGBA.giallo); px(sx + 3, sy - 3, RGBA.giallo); }
      } else if (it.k === 'conchiglia') spr(CONCH, sx - 3, sy - 4);
      else if (it.k === 'bolla') spr(BOLLA, sx - 3, sy - 3 + (Math.floor(t * 3 + it.x) % 2));
      else {
        // ostrica: valva sotto fissa, valva sopra che si apre quando arrivi (la perla rosa si vede solo aperta)
        const ph = (s.tick + it.fase) % OST_PER, apre = ph < OST_OPEN ? Math.min(4, Math.floor(ph / 4), Math.floor((OST_OPEN - ph) / 4)) : 0;
        rect(sx - 6, sy + 2, 13, 2, RGBA.pietraScura); rect(sx - 5, sy + 4, 11, 1, RGBA.roccia); px(sx - 6, sy + 2, RGBA.roccia); px(sx + 6, sy + 2, RGBA.roccia);
        if (apre > 0) { rect(sx - 5, sy - apre + 2, 11, apre, RGBA.neroCaldo); spr(PERLA.rosa, sx - 2, sy - 2); }
        const top = sy - apre + 1;
        rect(sx - 6, top, 13, 1, RGBA.pietra); rect(sx - 5, top - 1, 11, 1, RGBA.pietraScura); px(sx - 2, top - 1, RGBA.pietra); px(sx + 2, top - 1, RGBA.pietra);
        if (apre === 0 && blink) px(sx, sy + 2, RGBA.rosaNeon);
      }
    }
    // pericoli (dove sono adesso; verso dal tick dopo)
    for (const h of s.pericoli) {
      if (h.x + h.amp - cf < -14 || h.x - h.amp - cf > W + 14) continue;
      const p = pericoloAt(h, s.fondo, s.tick), q = pericoloAt(h, s.fondo, s.tick + 1);
      const sx = Math.round(p.x - cf), sy = Math.round(SURF + p.y);
      if (h.k === 'medusa') {
        const f = q.y < p.y ? 1 : 0; // sale = si contrae
        spr(MEDUSA[f]!, sx - 4, sy - 4);
        for (const ox of [-3, -1, 1, 3]) for (let i = 0; i < 6 - f * 2; i++) px(sx + ox + Math.round(tri(t * 1.5 + i * 0.3 + ox) * 0.6), sy + 1 - f + i, RGBA[i % 2 ? 'viola' : 'rosaNeon']);
      } else spr(GRANCHIO[Math.floor(t * 8) % 2]!, sx - 5, sy - 4, q.x < p.x);
    }
    // bollicine
    for (const b of sc.bolle) { const bx2 = Math.round(b.x - cf + tri(b.y * 0.15)), by = Math.round(SURF + b.y); px(bx2, by, RGBA.pietraChiara); if (b.vy < -0.6) px(bx2 + 1, by, RGBA.acquaBassa); }
    // il sub (lampeggia dopo un colpo; muso giù quando scende forte, su quando risale)
    if (!(s.inv > 0 && Math.floor(s.inv / 4) % 2 === 0)) {
      const frame = SUB[(s.hold && !s.affanno ? Math.floor(t * 10) : Math.floor(t * 4)) % 2]!;
      const sx = DX - 11, sy = Math.round(SURF + subY) - 3, tilt = s.vy > 0.7 ? -1 : s.vy < -0.7 ? 1 : 0;
      for (let yy = 0; yy < frame.length; yy++) { const r = frame[yy]!; for (let xx = 0; xx < r.length; xx++) { const c = MAP[r[xx]!]; if (c) px(sx + xx, sy + yy + (xx < 11 ? tilt : 0), RGBA[c]); } }
      if (s.affanno && Math.floor(t * 6) % 2) testo('!', DX + 12, sy - 7, RGBA.rosso);
    }
    // numeri che volano
    for (const e of sc.fx) if (e.testo) testo(e.testo, e.x - cf, SURF + e.y - e.t * 0.4, RGBA[e.col]);
    g.putImageData(img, 0, 0);
  };
}
