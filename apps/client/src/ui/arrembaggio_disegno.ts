// Arrembaggio: il disegno della tempesta (192×136 a pixel, ImageData scalato «nearest»), separato dalla schermata (ui/arrembaggio.ts,
// stesso chunk). Cielo blu notte con nuvole a strati che corrono col vento, lampi che illuminano tutto, pioggia di traverso, mare scuro a
// fasce con le creste di schiuma; a sinistra la scogliera col faro in rovina, la bandiera che dice da dove soffia e il cannone; le navi
// pirata (sagome procedurali: scafo, alberi, vele, bandiera) che passano, prendono fuoco e affondano. Solo colori della palette.
import { MINIGAMES_CFG } from '@marea/content';
import type { ArrembaggioNave } from '@marea/content';
import { createRng, muoviPalla, naveX, potenzaDi, sparo, ventoAt } from '@marea/sim';
import type { ArrembaggioState, ArrNave } from '@marea/sim';
import { RGBA, createTela, dith, hash, tri } from './pixel_kit.ts';
import type { Col } from './pixel_kit.ts';
import { suona } from '../audio/ponte.ts';

const CFG = MINIGAMES_CFG.arrembaggio;
export const W = 192, H = 136;
const ORIZ = 92, MARE = CFG.scena.mare;
const [BX, BY] = CFG.scena.cannone;
const [DX, DY] = CFG.tiro.dir;

export type Fx = { x: number; y: number; t: number; testo: string; col: Col };
/** Effetti solo del client (dal seed o dagli eventi della sim). */
export type ScenaArr = {
  fx: Fx[];
  schizzi: { x: number; t: number }[];
  botti: { x: number; y: number; t: number }[];
  fumo: { x: number; y: number; t: number; vx: number; vy: number }[];
  scie: { x: number; y: number; t: number }[];
  rinculo: number;
  /** Ultima nave affondata e ultimo colpo in acqua (tick), per i messaggi. */
  colpo: { tick: number; nome: string; punti: number } | null;
  tonfo: number;
  lampo: number; lampoX: number;
  /** Nuvole: profili (solo estetica, dal seed) e quanto sono scivolate col vento. */
  nubi1: number[]; nubi2: number[]; nubiX: number;
};

function profilo(seed: number, label: string, n: number, lo: number, hi: number): number[] {
  const r = createRng(seed).fork(label), out: number[] = [];
  let y = (lo + hi) / 2, v = 0;
  while (out.length < n) {
    v = Math.max(-1.2, Math.min(1.2, v + (r.next() - 0.5) * 0.9));
    y = Math.max(lo, Math.min(hi, y + v));
    if (y === lo || y === hi) v = -v * 0.5;
    out.push(Math.round(y));
  }
  return out;
}
export function scenaArrembaggio(_s: ArrembaggioState, seed: number): ScenaArr {
  return {
    fx: [], schizzi: [], botti: [], fumo: [], scie: [], rinculo: 0, colpo: null, tonfo: -999, lampo: 0, lampoX: 100,
    nubi1: profilo(seed, 'nubi1', 600, 0, 16), nubi2: profilo(seed, 'nubi2', 600, 0, 13), nubiX: 0,
  };
}

/** Effetti di un tick (dopo lo step della sim): suoni, fumo, schizzi, botti, numeri che volano, lampi. */
export function effettiArrembaggio(s: ArrembaggioState, sc: ScenaArr): void {
  const u = s.ultimo, vento = ventoAt(s.raffiche, s.tick);
  if (u.sparo) {
    sc.rinculo = 9; suona('cannone');
    for (let i = 0; i < 6; i++) sc.fumo.push({ x: BX + DX * 3, y: BY + DY * 3, t: 0, vx: DX * (0.3 + i * 0.12), vy: DY * (0.3 + i * 0.1) });
  }
  for (const i of u.colpi) {
    const n = s.navi[i]!, d = CFG.navi[n.k], x = naveX(n, s.tick) ?? 0;
    sc.botti.push({ x, y: MARE - d.alto * 0.45, t: 0 });
    sc.fx.push({ x, y: MARE - d.alto - 8, t: 0, testo: `+${d.punti}`, col: n.k === 'tesoro' ? 'giallo' : 'arancio' });
    sc.colpo = { tick: s.tick, nome: d.nome, punti: d.punti };
    suona('colpo_critico'); if (n.k === 'tesoro' || n.k === 'sloop') suona('moneta', n.k === 'tesoro' ? 1 : 0.5);
  }
  for (const p of u.tonfi) { sc.schizzi.push({ x: p.x, t: 0 }); sc.tonfo = s.tick; suona('plop'); }
  if (s.lampi.includes(s.tick)) { sc.lampo = 12; sc.lampoX = 50 + (hash(s.tick, s.seed) % 130); suona('tuono', 0.6); }
  if (sc.lampo > 0) sc.lampo--;
  if (sc.rinculo > 0) sc.rinculo--;
  if (s.tick % 2 === 0) for (const b of s.palle) sc.scie.push({ x: b.x, y: b.y, t: 0 });
  for (const e of sc.scie) e.t++;
  sc.scie = sc.scie.filter((e) => e.t < 10);
  for (const f of sc.fumo) { f.t++; f.x += f.vx + vento * 30; f.y += f.vy; f.vx *= 0.93; f.vy = f.vy * 0.93 - 0.02; }
  sc.fumo = sc.fumo.filter((f) => f.t < 50);
  for (const e of sc.fx) e.t++;
  sc.fx = sc.fx.filter((e) => e.t < 50);
  for (const e of sc.schizzi) e.t++;
  sc.schizzi = sc.schizzi.filter((e) => e.t < 24);
  for (const e of sc.botti) { e.t++; if (e.t % 6 === 0) sc.fumo.push({ x: e.x + ((e.t * 7) % 9) - 4, y: e.y - 4, t: 10, vx: 0, vy: -0.2 }); }
  sc.botti = sc.botti.filter((e) => e.t < 40);
  sc.nubiX += 0.12 + (vento / CFG.vento.max) * 0.35;
}

// ---------- navi: sagome procedurali (scafo, alberi, vele, bandiera), guardano verso dir ----------
const ALBERI: Record<ArrembaggioNave, { dx: number; h: number }[]> = {
  galeone: [{ dx: -9, h: 20 }, { dx: 1, h: 23 }, { dx: 10, h: 18 }],
  brigantino: [{ dx: -5, h: 19 }, { dx: 5, h: 17 }],
  sloop: [{ dx: -1, h: 15 }],
  tesoro: [{ dx: -1, h: 15 }],
};
const SCAFO: Record<ArrembaggioNave, number> = { galeone: 8, brigantino: 7, sloop: 5, tesoro: 5 };

export function createPittoreArrembaggio(cv: HTMLCanvasElement): (s: ArrembaggioState, sc: ScenaArr, t: number, alpha: number, fermo: boolean) => void {
  const T = createTela(cv, W, H), buf = T.buf, px = T.px;
  /** Colore schiarito dal lampo (un gradino più chiaro nella stessa famiglia). */
  const LUCE: Partial<Record<Col, Col>> = { abisso: 'acquaProfonda', acquaProfonda: 'acqua', neroCaldo: 'roccia', roccia: 'pietraScura', pietraScura: 'pietra', legnoScuro: 'legno', legno: 'legnoChiaro', bosco: 'erbaScura' };
  let flash = false;
  const C = (c: Col): number => RGBA[flash ? LUCE[c] ?? c : c];

  function nave(n: ArrNave, cx: number, s: ArrembaggioState, t: number): void {
    const k = n.k, d = CFG.navi[k], L = d.lungo, hh = SCAFO[k], dir = n.dir;
    const eta = n.affondata >= 0 ? s.tick - n.affondata : -1;
    const giu = eta >= 0 ? eta * 0.3 : 0, piega = eta >= 0 ? Math.min(0.35, eta / 120) : 0;
    const bob = eta >= 0 ? 0 : Math.round(tri(t * 0.9 + n.id * 0.37) * 1.2);
    const base = MARE + 2 + bob;
    /** pixel della nave in coordinate locali (lx: + verso la prua, ly: su dalla linea di galleggiamento). */
    const np = (lx: number, ly: number, c: Col) => {
      const yy = Math.round(base - ly + giu + lx * piega);
      if (yy > MARE + 2) return; // sott'acqua
      px(cx + lx * dir, yy, C(c));
    };
    // scafo: poppa alta e dritta, prua che sale a punta
    for (let r = 0; r < hh; r++) {
      const ly = r, x0 = -Math.floor(L / 2) + Math.floor((hh - 1 - r) * 0.4), x1 = Math.floor(L / 2) - Math.floor((hh - 1 - r) * 1.3);
      for (let lx = x0; lx <= x1; lx++) {
        const top = r === hh - 1, fondo = r === 0;
        const c: Col = top ? 'legnoChiaro' : fondo ? 'neroCaldo' : (k === 'galeone' || k === 'brigantino') && r === hh - 3 && ((lx + 40) % 4 === 1) ? 'neroCaldo' : r % 2 ? 'legno' : 'legnoScuro';
        np(lx, ly, k === 'tesoro' && top ? 'giallo' : c);
      }
    }
    // castello di poppa del galeone
    if (k === 'galeone') for (let r = 0; r < 4; r++) for (let lx = -17; lx <= -11; lx++) np(lx, hh + r, r === 3 ? 'legnoChiaro' : r === 1 && lx % 2 === 0 ? 'giallo' : 'legnoScuro');
    // alberi e vele
    const alberi = ALBERI[k];
    alberi.forEach((m, i) => {
      for (let ly = hh; ly < hh + m.h; ly++) np(m.dx, ly, 'legnoScuro');
      if (k === 'sloop' || k === 'tesoro') {
        // vela triangolare (randa) tra l'albero e la poppa
        const vela: Col = k === 'tesoro' ? 'giallo' : 'neroCaldo', bordo: Col = k === 'tesoro' ? 'arancio' : 'roccia';
        for (let ly = hh + 2; ly < hh + m.h - 1; ly++) {
          const w = Math.round((1 - (ly - hh - 2) / (m.h - 3)) * 7) + 1;
          for (let q = 1; q <= w; q++) np(m.dx - q, ly, q === w ? bordo : vela);
        }
        if (k === 'sloop') { np(m.dx - 3, hh + 8, 'pietraChiara'); np(m.dx - 4, hh + 7, 'pietraChiara'); np(m.dx - 2, hh + 7, 'pietraChiara'); np(m.dx - 3, hh + 6, 'pietraChiara'); }
        // fiocco a prua
        for (let ly = hh + 1; ly < hh + m.h - 4; ly++) { const w = Math.round(((ly - hh) / (m.h - 4)) * 4); for (let q = 1; q <= 5 - w; q++) np(m.dx + q, ly, k === 'tesoro' ? 'arancio' : 'roccia'); }
      } else {
        // vele quadre a più ordini, ognuna sotto il suo pennone: chiare e rattoppate sul galeone, nere col teschio sul brigantino
        const nere = k === 'brigantino';
        const ordini: [number, number, number][] = k === 'galeone' ? [[hh + 3, 6, 5], [hh + 11, 5, 4], [hh + 18, 3, 3]] : [[hh + 3, 6, 4], [hh + 11, 5, 3]];
        for (const [y0, hv, wv0] of ordini) {
          const wv = i === 1 || alberi.length === 1 ? wv0 : wv0 - 1;
          if (y0 + hv > hh + m.h - 1) continue;
          for (let q = -wv - 1; q <= wv + 1; q++) np(m.dx + q, y0 + hv, 'legnoScuro');
          for (let ly = y0; ly < y0 + hv; ly++) for (let q = -wv; q <= wv; q++) {
            if (ly === y0 && Math.abs(q) === wv) continue; // angoli tondi in basso (la vela è gonfia)
            if (!nere && hash(n.id * 31 + i * 7 + q, ly) % 19 === 0) continue; // strappi
            const c: Col = nere ? (Math.abs(q) === wv || ly === y0 ? 'roccia' : 'neroCaldo') : q === -wv || ly === y0 ? 'pietra' : hash(q + 9, ly + i) % 23 === 0 ? 'sabbia' : 'pietraChiara';
            np(m.dx + q, ly, c);
          }
        }
        if (nere && i === 0) for (const [ox, oy] of [[0, 6], [-1, 5], [1, 5], [0, 4], [-1, 7], [1, 7]] as const) np(m.dx + ox, hh + oy, oy === 7 ? 'neroCaldo' : 'pietraChiara');
      }
    });
    // bompresso e sartie (righe a puntini dalle cime degli alberi a poppa e a prua)
    const prua = Math.floor(L / 2) - 1;
    for (let q = 0; q < 6; q++) np(prua + q, hh - 1 + (q >> 1), 'legnoScuro');
    const sartia = (x0: number, y0: number, x1: number, y1: number) => { for (let k2 = 0; k2 <= 12; k2 += 2) np(Math.round(x0 + ((x1 - x0) * k2) / 12), Math.round(y0 + ((y1 - y0) * k2) / 12), 'neroCaldo'); };
    const a0 = alberi[0]!, a1 = alberi[alberi.length - 1]!;
    sartia(a0.dx, hh + a0.h - 1, -Math.floor(L / 2) + 1, hh);
    sartia(a1.dx, hh + a1.h - 1, prua + 5, hh + 2);
    // bandiera in cima all'albero più alto (sventola)
    const top = alberi.reduce((a, m) => (m.h > a.h ? m : a));
    const fl: Col = k === 'tesoro' ? 'giallo' : k === 'galeone' ? 'neroCaldo' : 'rosso';
    for (let q = 1; q <= 4; q++) for (let r = 0; r < 3; r++) np(top.dx - q, hh + top.h - 1 - r + (Math.floor(t * 8 + q) % 2), fl);
    if (k === 'galeone') np(top.dx - 2, hh + top.h - 2, 'pietraChiara');
    // fuoco a bordo appena colpita
    if (eta >= 0 && eta < 60) for (let i = 0; i < 10; i++) {
      const h1 = hash(n.id * 97 + i, Math.floor(eta / 3));
      np(-L / 2 + (h1 % L), hh + (h1 >> 8) % 7, (h1 >> 4) % 3 === 0 ? 'giallo' : (h1 >> 4) % 3 === 1 ? 'arancio' : 'rosso');
    }
  }

  return (s, sc, t) => {
    flash = sc.lampo > 6 || (sc.lampo > 0 && sc.lampo % 3 === 0);
    const vento = ventoAt(s.raffiche, s.tick), vk = vento / CFG.vento.max;
    // ---- cielo: blu notte, un velo più chiaro solo sull'orizzonte (a puntini) ----
    for (let y = 0; y < ORIZ; y++) for (let x = 0; x < W; x++)
      buf[y * W + x] = y < 76 ? C('abisso') : dith(x, y, ((y - 76) / 16) * 0.6) ? C('acquaProfonda') : C('abisso');
    // nuvole a due strati (lontane: roccia col bordo preso dalla luce, vicine: nero), corrono col vento
    const n1 = Math.floor(sc.nubiX * 0.5), n2 = Math.floor(sc.nubiX);
    for (let x = 0; x < W; x++) {
      const p1 = sc.nubi1[((x - n1) % 600 + 600) % 600]!, b1 = 30 + p1;
      for (let y = 0; y <= b1; y++) buf[y * W + x] = y === b1 ? C('pietraScura') : y === b1 - 1 && dith(x, y, 0.5) ? C('pietraScura') : C('roccia');
      const p2 = sc.nubi2[((x - n2 + 300) % 600 + 600) % 600]!, b2 = 14 + p2;
      for (let y = 0; y <= b2; y++) buf[y * W + x] = y === b2 ? C('roccia') : y > b2 - 3 && dith(x, y, 0.5) ? C('roccia') : C('neroCaldo');
    }
    // fulmine: dal bordo delle nuvole all'orizzonte, a zig-zag, nei primi tick del lampo
    if (sc.lampo > 5) {
      let x = sc.lampoX;
      for (let y = 30 + (sc.nubi1[((sc.lampoX - n1) % 600 + 600) % 600] ?? 0); y < ORIZ; y++) {
        x += (hash(y, sc.lampoX) % 3) - 1;
        px(x, y, RGBA.pietraChiara); px(x + 1, y, RGBA.acquaBassa);
        if (y % 11 === 0) for (let k = 1; k < 6; k++) px(x - k, y + k, RGBA.acquaBassa); // ramo
      }
    }
    // ---- mare scuro: la riga chiara dell'orizzonte, fasce d'onda a puntini, creste di schiuma (più veloci vicino) ----
    for (let y = ORIZ; y < H; y++) {
      const d = y - ORIZ, fascia = ((d + Math.floor(t * 2)) % 6) < 2;
      for (let x = 0; x < W; x++)
        buf[y * W + x] = d === 0 ? C('acqua') : d < 3 ? (dith(x, y, 0.5) ? C('acquaProfonda') : C('abisso'))
          : y < MARE + 4 ? (fascia && dith(x, y, 0.3) ? C('acquaProfonda') : C('abisso'))
          : dith(x, y, 0.35 + ((y - MARE) / 30) * 0.4) ? C('acquaProfonda') : C('abisso');
    }
    for (const [y, vel, per, lun] of [[ORIZ + 3, 4, 29, 2], [ORIZ + 7, 7, 23, 3], [ORIZ + 12, 10, 19, 4], [ORIZ + 17, 14, 21, 5], [MARE + 8, 20, 25, 6], [MARE + 14, 26, 27, 7], [MARE + 20, 32, 31, 9]] as const) {
      const off = Math.floor(t * vel + vk * t * 6);
      for (let x = 0; x < W; x++) {
        const k = (((x + off + y * 7) % per) + per) % per;
        if (k < lun) px(x, y + (k === 0 || k === lun - 1 ? 1 : 0), C(k === 1 || k === lun - 2 ? 'pietraChiara' : 'acqua'));
      }
    }
    // ---- navi (dietro le onde vicine) ----
    for (const n of s.navi) {
      if (n.affondata >= 0 && s.tick - n.affondata > 90) continue;
      const x = naveX(n, n.affondata >= 0 ? n.affondata : s.tick);
      if (x === null) continue;
      nave(n, Math.round(x), s, t);
    }
    // onde davanti agli scafi
    const offw = Math.floor(t * 12);
    for (let x = 0; x < W; x++) {
      const k = (((x + offw) % 14) + 14) % 14, y = MARE + 3 + (k < 7 ? 0 : 1);
      px(x, y, C('abisso')); px(x, y + 1, C('acquaProfonda'));
      if (k === 2 || k === 3) px(x, y - 1, C('pietraChiara'));
      else if (k === 1 || k === 4) px(x, y - 1, C('acqua'));
    }
    // ---- scogliera a strati (cima a y 68), erba, schiuma che sbatte ----
    const bordo = (y: number) => (y < 72 ? 41 - (72 - y) : 41 + (hash(y >> 2, 3) % 3) - (y > 84 && y < 100 ? 2 : 0) + (y > 116 ? (y - 116) >> 1 : 0));
    for (let y = 68; y < H; y++) {
      const e = bordo(y);
      for (let x = 0; x <= e; x++) {
        // strati di roccia: una riga scura ogni 8 px (rotta qua e là), il gradino sopra preso dalla luce, qualche crepa verticale
        const yy = y + Math.round(tri(x * 0.045 + 0.3) * 3 + tri(x * 0.13) * 1.2), sy = yy % 9, riga = Math.floor(yy / 9);
        const crepa = hash(x, riga) % 13 === 0 && sy > 1 && sy < 7;
        const c: Col = x >= e - 1 ? 'pietraScura' : sy === 0 ? (hash(x >> 2, riga) % 4 ? 'neroCaldo' : 'roccia') : sy === 1 && hash(x >> 1, riga) % 3 ? 'pietraScura'
          : crepa ? 'neroCaldo' : hash(x, y) % 41 === 0 ? 'pietraScura' : 'roccia';
        buf[y * W + x] = C(c);
      }
    }
    for (let x = 0; x <= 37; x++) { px(x, 68, C(hash(x, 4) % 4 ? 'bosco' : 'erbaScura')); if (hash(x, 9) % 3 === 0) px(x, 67, C('erbaScura')); }
    const onda = Math.floor(t * 2.2) % 4;
    for (let i = 0; i < 10; i++) { const y = MARE + 1 + i * 2, e = bordo(y); for (let k = 0; k < 2 + ((i + onda) % 3); k++) px(e + 1 + k, y - ((i + onda) % 2), C('pietraChiara')); }
    if (onda === 0) for (let k = 0; k < 6; k++) px(bordo(MARE - 2) + 1 + (k % 3), MARE - 2 - k, C('pietraChiara')); // spruzzo
    // ---- faro in rovina: torre a fasce rosse scrostate, cima spezzata, travi della lanterna rotte, finestra accesa ----
    const fx0 = 11;
    for (let y = 18; y < 68; y++) {
      const half = 6 + Math.floor((y - 18) / 16);
      for (let x = fx0 - half; x <= fx0 + half; x++) {
        const rel = x - (fx0 - half), crollo = 18 + Math.max(0, rel - 4) * 1.4 + (hash(rel, 2) % 3); // la cima scende a destra, a pezzi
        if (y < crollo) continue;
        const banda = Math.floor((y - 18) / 8) % 2 === 1, h1 = hash(x, y);
        const c: Col = x === fx0 - half ? 'pietraScura' : x === fx0 + half ? 'pietra'
          : y < crollo + 1 ? 'pietraScura'
          : banda ? (h1 % 4 === 0 ? 'pietra' : 'rosso') : h1 % 7 === 0 ? 'pietra' : h1 % 31 === 0 ? 'pietraScura' : 'pietraChiara';
        buf[y * W + x] = C(c);
      }
    }
    for (const [x, y] of [[6, 17], [6, 16], [7, 15], [8, 14], [9, 14], [10, 15], [5, 18]] as const) px(x, y, C('neroCaldo')); // travi storte
    const luce = Math.floor(t * 7) % 5 !== 0;
    for (let y = 30; y < 35; y++) for (let x = 9; x < 13; x++) px(x, y, RGBA[(x === 9 || y === 30) ? 'arancio' : luce ? 'giallo' : 'arancio']);
    for (let y = 56; y < 68; y++) for (let x = 9; x < 14; x++) px(x, y, y === 56 && (x === 9 || x === 13) ? C('pietraChiara') : C('neroCaldo')); // porta
    for (let k = 0; k < 9; k++) { px(5 + ((k * 3) % 4 === 0 ? 1 : 0), 66 - k * 4, C('bosco')); px(6, 64 - k * 4, C('erbaScura')); } // edera
    for (const [x, y] of [[20, 66], [21, 66], [21, 65], [3, 67]] as const) px(x, y, C('pietra')); // sassi caduti
    // bandiera pirata sull'asta: dice da dove soffia il vento
    for (let y = 40; y < 68; y++) px(24, y, C('legnoScuro'));
    const lb = 4 + Math.round(Math.abs(vk) * 6), vd = vk >= 0 ? 1 : -1;
    for (let q = 1; q <= lb; q++) for (let r = 0; r < 6; r++) px(24 + q * vd, 40 + r + (q > 2 ? Math.floor(t * 10 + q * 0.7) % 2 : 0), C(r === 5 ? 'roccia' : 'neroCaldo'));
    for (const [ox, oy] of [[2, 1], [3, 1], [2, 2], [3, 2], [2, 3]] as const) px(24 + (ox + 0) * vd, 40 + oy, RGBA.pietraChiara);
    // mucchio di palle accanto al cannone: cala man mano (una ogni 9 rimaste)
    const mucchio = Math.ceil(s.munizioni / 9);
    ([[22, 66], [25, 66], [23, 63], [24, 60]] as const).slice(0, mucchio).forEach(([x, y]) => { T.rect(x - 1, y - 1, 3, 3, RGBA.neroCaldo); px(x - 1, y - 1, RGBA.pietraScura); });
    // cannone: affusto di legno con due ruote, canna nera inclinata verso dir (rincula dopo il colpo)
    const rc = sc.rinculo > 0 ? Math.min(3, sc.rinculo / 2) : 0;
    T.rect(27, 63, 10, 4, C('legno')); T.rect(27, 63, 10, 1, C('legnoChiaro')); T.rect(27, 66, 10, 1, C('legnoScuro'));
    for (const wx of [29, 35]) for (const [ox, oy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) { px(wx + ox, 67 + oy, RGBA.neroCaldo); px(wx, 67, RGBA.roccia); }
    for (let k = 0; k <= 11; k++) {
      const cx = BX - DX * (k + rc), cy = BY - DY * (k + rc), r = k > 8 ? 2 : 1.5;
      for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) if (ox * ox + oy * oy <= r * r + 0.5) px(cx + ox, cy + oy, RGBA[ox + oy < -1 ? 'pietraScura' : 'neroCaldo']);
    }
    px(BX - DX * rc + 1, BY - DY * rc - 1, RGBA.roccia);
    if (sc.rinculo > 5) for (let k = 0; k < 8; k++) for (const o of [-1, 0, 1]) if (k < 6 || o === 0) px(BX + DX * (2 + k) + o * 0.8, BY + DY * (2 + k) + o * 0.6, RGBA[k < 3 ? 'giallo' : k < 6 ? 'arancio' : 'rosso']); // vampata
    // ---- mirino: la prima metà della parabola mentre carichi (il vento di adesso compreso) ----
    if (s.carica >= 0 && !s.done) {
      const b = sparo(potenzaDi(s.carica));
      for (let k = 1; k <= 46; k++) {
        muoviPalla(b, ventoAt(s.raffiche, s.tick + k));
        if (b.y > MARE) break;
        if (k % 4 === 0) { px(b.x, b.y, RGBA[k > 34 ? 'arancio' : 'giallo']); if (k <= 24) px(b.x + 1, b.y, RGBA.giallo); }
      }
    }
    // ---- palle, scie, botti, schizzi, fumo ----
    for (const e of sc.scie) if (e.t < 8) px(e.x, e.y, RGBA[e.t < 4 ? 'pietra' : 'pietraScura']);
    for (const b of s.palle) {
      const x = Math.round(b.x), y = Math.round(b.y);
      T.rect(x - 1, y - 1, 3, 3, RGBA.neroCaldo); px(x - 1, y - 1, RGBA.pietraScura); px(x, y - 2, RGBA.neroCaldo); px(x + 2, y, RGBA.neroCaldo);
    }
    for (const e of sc.botti) {
      const r = Math.min(8, 2 + e.t * 0.6);
      for (let k = 0; k < 18; k++) {
        const h1 = hash(k, Math.floor(e.x)), ang = (h1 % 16) / 16, rr = r * (0.4 + ((h1 >> 5) % 7) / 10);
        const ox = tri(ang * 2) * rr, oy = tri(ang * 2 + 0.5) * rr * 0.7 - e.t * 0.15;
        if (e.t < 26) px(e.x + ox, e.y + oy, RGBA[e.t < 6 ? 'giallo' : k % 3 === 0 ? 'rosso' : 'arancio']);
      }
    }
    for (const e of sc.schizzi) {
      const h = e.t < 8 ? e.t * 1.6 : Math.max(0, 13 - (e.t - 8) * 0.9);
      for (let k = 0; k < h; k++) { px(e.x, MARE - k, RGBA[k > h - 2 ? 'pietraChiara' : 'acquaBassa']); if (k < h - 3) { px(e.x - 1, MARE - k + 2, RGBA.pietraChiara); px(e.x + 1, MARE - k + 2, RGBA.pietraChiara); } }
      if (e.t > 6) { px(e.x - 3, MARE - h + 4, RGBA.pietraChiara); px(e.x + 3, MARE - h + 3, RGBA.pietraChiara); }
    }
    for (const f of sc.fumo) {
      const c = f.t < 12 ? RGBA.pietra : RGBA.pietraScura, r = f.t < 20 ? 1 : 2;
      T.rect(f.x - r / 2, f.y - r / 2, r + 1, r, c);
    }
    // ---- pioggia di traverso (inclinata dal vento) ----
    const sl = vk * 0.8;
    for (let i = 0; i < 80; i++) {
      const h1 = hash(i, 777), x0 = (h1 % 260) - 30, y0 = (((h1 >> 9) % H) + Math.floor(t * 170)) % (H + 10) - 5;
      const xx = x0 + sl * y0 + ((Math.floor(t * 40) * sl) | 0) % W;
      for (let k = 0; k < 3; k++) px(((Math.round(xx + sl * k) % W) + W) % W, y0 + k, RGBA[flash ? 'pietraChiara' : k === 2 ? 'acquaBassa' : 'acqua']);
    }
    // ---- vento: frecce in alto al centro (quante e da che parte) ----
    const nf = Math.round(Math.abs(vk) * 3);
    if (nf === 0) for (let x = 92; x < 100; x++) px(x, 5, RGBA.pietra);
    for (let f = 0; f < nf; f++) {
      const ax = 96 + (f - (nf - 1) / 2) * 6 * (vk >= 0 ? 1 : -1);
      for (let k = 0; k < 3; k++) { px(ax + k * (vk >= 0 ? -1 : 1), 5 - k, RGBA.pietraChiara); px(ax + k * (vk >= 0 ? -1 : 1), 5 + k, RGBA.pietraChiara); }
    }
    // ---- numeri che volano ----
    for (const e of sc.fx) T.testo(e.testo, e.x, e.y - e.t * 0.4, RGBA[e.col]);
    T.flush();
  };
}
