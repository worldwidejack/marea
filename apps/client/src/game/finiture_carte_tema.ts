// Le carte da parati a tema disegnate intere (finiture_disegni.ts): murali e scene che girano sulle tre pareti come un panorama solo
// (orizzonte tropicale, bosco, origami, onsen: il sole sta sempre in mezzo alla parete di fondo), insegne al neon, bacheche, finestrini.
// 32 texel/m, in basso 8 texel di battiscopa; `inizio` allinea i motivi al giro, `posti` distribuisce le cose sulla lunghezza.
import { P, R, TEX_MURO, anello, centri, cornice, filo, giroX, inizio, linea, ovale, pesca, posti, quante, retino, rilievo, stella, triangolo, type DisegnoMuro, type Muro, type Tela } from './finiture_kit.ts';
import { damasco } from './finiture_carte.ts';

/** Disegnino a pixel: righe di caratteri, ogni carattere un colore della mappa (spazio = vuoto), ingrandito di `k`. */
function sprite(t: Tela, righe: readonly string[], x: number, y: number, k: number, col: Record<string, string>): void {
  righe.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const cc = col[r[i]!]; if (cc) R(t, cc, x + i * k, y + j * k, k, k); } });
}
/** Alone a retino attorno a un punto (luce di una torcia, di un neon). */
function alone(t: Tela, col: string, cx: number, cy: number, r: number): void {
  t.g.save(); t.g.beginPath(); t.g.ellipse(Math.round(cx), Math.round(cy), r, r, 0, 0, Math.PI * 2); t.g.clip(); retino(t, col, cx - r, cy - r, 2 * r, 2 * r); t.g.restore();
}
/** Dove sta (in texel di questa parete) il centro della parete di fondo: il sole, la luna. */
const centroFondo = (s: Muro): number => (s.giro / 2 - s.u0) * TEX_MURO;
/** Una palma: tronco curvo a segmenti e ciuffo di foglie. */
function palma(t: Tela, x: number, base: number, h: number, d: number): void {
  let px = x, py = base;
  for (let i = 0; i < h; i += 3) { const nx = x + d * (i * i) / (h * 4), ny = base - i; R(t, i % 6 ? P.legno : P.legnoScuro, nx - 1, ny - 3, 3, 3); px = nx; py = ny; }
  for (const a of [-2.8, -2.2, -1.6, -1, -0.4]) { linea(t, P.erbaScura, px, py, px + Math.cos(a) * 14, py + Math.sin(a) * 8 + 5, 2); ovale(t, P.erba, px + Math.cos(a) * 9, py + Math.sin(a) * 5 + 2, 3, 1.5); }
  ovale(t, P.legnoScuro, px - 1, py + 1, 2, 2); ovale(t, P.legnoScuro, px + 2, py + 2, 2, 2);
}

const INVADER = ['  x     x  ', '   x   x   ', '  xxxxxxx  ', ' xx xxx xx ', 'xxxxxxxxxxx', 'x xxxxxxx x', 'x x     x x', '   xx xx   '];
const FUNGO = ['  xxxxx  ', ' xxoxxxx ', 'xxxxxxoxx', 'xoxxxxxxx', '   sss   ', '   sss   ', '   sss   '];

export const CARTE_TEMA: Record<string, DisegnoMuro> = {
  // sala giochi: mattoni scuri, tubi al neon in alto e in basso, insegne al neon grandi (invasore, joystick, pianeta, mangiatutto)
  muro_arcade_neon: (t, c, s) => {
    for (let y = 0, j = 0; y < t.h; y += 8, j++) { R(t, P.roccia, 0, y, t.w, 1); for (let x = inizio(s, 24) + (j % 2 ? 12 : 0); x < t.w; x += 24) R(t, P.roccia, x, y, 1, 8); }
    for (const [y, col] of [[6, c.k], [t.h - 14, P.rosaNeon]] as const) { retino(t, col, 0, y - 2, t.w, 6); R(t, col, 0, y, t.w, 2); }
    posti(s, 3.2).forEach((x, i) => {
      const y = t.h * 0.45, n = (i + Math.round(s.u0)) % 4;
      alone(t, n === 0 ? P.verdeNeon : n === 1 ? P.rosaNeon : n === 2 ? c.b : P.giallo, x, y, 26);
      if (n === 0) sprite(t, INVADER, x - 16, y - 12, 3, { x: P.verdeNeon });
      else if (n === 1) { R(t, P.roccia, x - 12, y + 8, 24, 6); R(t, P.pietraScura, x - 1, y - 8, 3, 16); ovale(t, P.rosaNeon, x, y - 12, 6, 6); ovale(t, P.pietraChiara, x - 2, y - 14, 2, 2); ovale(t, P.rossoNeon, x + 7, y + 6, 3, 2); }
      else if (n === 2) { ovale(t, c.b, x, y, 11, 11); ovale(t, P.violaNeon, x + 3, y + 3, 5, 5); linea(t, c.k, x - 20, y + 6, x + 20, y - 6, 2); }
      else { ovale(t, P.giallo, x - 6, y, 11, 11); triangolo(t, c.a, x - 6, y, x + 6, y - 9, x + 6, y + 9); for (const d of [10, 18]) ovale(t, P.giallo, x + d, y, 2, 2); R(t, c.a, x - 6, y - 7, 2, 2); }
    });
  },
  // damasco viola dei fantasmi: volute verde acido con i fantasmini nascosti, ectoplasma che cola dall'alto; in fondo un ritratto che ti guarda
  damasco_ectoplasmatico: (t, c, s) => {
    for (let y = 24, j = 0; y < t.h - 8; y += 26, j++) for (let x = inizio(s, 34) + (j % 2 ? 17 : 0); x < t.w + 17; x += 34) {
      damasco(t, P.abisso, x, y, 10);
      if ((x - inizio(s, 34) + j * 17) % 102 === 0) { ovale(t, P.pietraChiara, x, y - 1, 3, 4); R(t, P.pietraChiara, x - 3, y + 1, 6, 3); R(t, c.k, x - 2, y - 2, 1, 1); R(t, c.k, x + 1, y - 2, 1, 1); }
    }
    R(t, c.b, 0, 0, t.w, 4);
    for (let x = 0; x < t.w; x++) { const u = giroX(s) + x, l = Math.max(0, Math.round(8 + Math.sin(u / 7) * 6 + Math.sin(u / 2.3) * 3)); R(t, c.b, x, 4, 1, l); if (l > 12 && (u % 9) === 0) ovale(t, c.b, x, 6 + l, 1.5, 2); }
    if (s.lato === 'fondo') {
      const x = (s.x0 + s.x1) / 2, y = t.h * 0.5;
      ovale(t, P.giallo, x, y, 17, 22); ovale(t, P.legno, x, y, 15, 20); ovale(t, P.abisso, x, y, 12, 17);
      ovale(t, P.pietraChiara, x, y - 2, 6, 7); R(t, P.pietraChiara, x - 6, y - 2, 12, 12); for (const d of [-6, -2, 2]) triangolo(t, P.abisso, x + d, y + 10, x + d + 4, y + 10, x + d + 2, y + 7);
      R(t, c.b, x - 3, y - 4, 2, 2); R(t, c.b, x + 2, y - 4, 2, 2);
    }
    for (const x of [s.x0, s.x1 - 10]) { R(t, P.legnoScuro, x, t.h - 40, 10, 32); R(t, c.k, x + 4, t.h - 40, 1, 32); triangolo(t, c.a, x, t.h - 40, x + 10, t.h - 40, x === s.x0 ? x + 10 : x, t.h - 50); }
  },
  // policarbonato viola: lastre imbullonate, sotto le piste dorate che girano tutta la stanza, chip, cavi colorati e LED
  parete_policarbonato_viola: (t, c, s) => {
    for (let y = 14; y < t.h - 10; y += 10) { let x = inizio(s, 40) - 40, yy = y; while (x < t.w) { const l = 20 + Math.floor(t.r.next() * 30); R(t, P.giallo, x, yy, l, 1); x += l; const d = t.r.next() < 0.5 ? -4 : 4; if (yy + d > 10 && yy + d < t.h - 12) { linea(t, P.giallo, x, yy, x + 4, yy + d); x += 4; yy += d; } } }
    for (const x of posti(s, 1.6)) {
      const y = 30 + Math.floor(t.r.next() * 30); R(t, P.neroCaldo, x - 8, y, 16, 12); for (let i = 0; i < 4; i++) { R(t, P.pietra, x - 9, y + 2 + i * 3, 1, 1); R(t, P.pietra, x + 8, y + 2 + i * 3, 1, 1); } R(t, P.roccia, x - 6, y + 2, 4, 3);
      R(t, pesca(t, [c.k, P.verdeNeon, P.rosaNeon]), x + 3, y + 3, 2, 2);
    }
    const ps = posti(s, 1.6); ps.slice(1).forEach((x, i) => { filo(t, P.rosso, ps[i]! + 8, 40, x - 8, 44, 14, 2); filo(t, P.verdeNeon, ps[i]! + 8, 48, x - 8, 46, 10, 1); });
    for (const x of posti(s, 1.2)) { R(t, c.b, x, 0, 2, t.h); for (const y of [6, t.h - 14]) { ovale(t, P.pietra, x + 1, y, 2, 2); R(t, P.roccia, x, y, 1, 1); } }
    R(t, c.k, 0, 0, t.w, 1); R(t, c.b, 0, 1, t.w, 2);
  },
  // la parete della disperazione organizzata: lavagne di sughero piene di post-it, foto, calendario e un poster, fili rossi che collegano tutto
  muro_disperazione_organizzata: (t, c, s) => {
    const ps = posti(s, 2.6), puntine: [number, number][] = [];
    for (const x of ps) { const w = 64, y = 14; R(t, P.legnoChiaro, x - w / 2, y, w, 58); cornice(t, P.legno, x - w / 2, y, w, 58, 3); }
    for (let n = Math.round((s.x1 - s.x0) / 14); n > 0; n--) {
      const x = s.x0 + 6 + t.r.next() * (s.x1 - s.x0 - 18), y = 10 + t.r.next() * (t.h - 34), f = Math.floor(t.r.next() * 5);
      if (f < 3) { const col = [c.b, P.rosaNeon, P.acquaBassa][f]!; R(t, col, x, y, 9, 9); R(t, P.pietraScura, x + 2, y + 3, 5, 1); R(t, P.pietraScura, x + 2, y + 5, 4, 1); }
      else if (f === 3) { R(t, P.pietraChiara, x, y, 12, 10); R(t, P.acquaProfonda, x + 1, y + 1, 10, 6); ovale(t, P.giallo, x + 7, y + 3, 1.5, 1.5); triangolo(t, P.erbaScura, x + 1, y + 7, x + 9, y + 7, x + 4, y + 3); }
      else { R(t, P.pietraChiara, x, y, 12, 12); R(t, P.rosso, x, y, 12, 3); for (let r = 0; r < 3; r++) R(t, P.pietraScura, x + 1, y + 5 + r * 2, 10, 1); linea(t, c.k, x + 2, y + 6, x + 9, y + 10); }
      R(t, c.k, x + 4, y, 2, 2); puntine.push([x + 5, y + 1]);
    }
    if (s.lato === 'fondo') { const x = (s.x0 + s.x1) / 2 + 40; R(t, P.abisso, x, 20, 22, 30); R(t, P.arancio, x + 4, 24, 14, 12); sprite(t, ['  x  ', ' xxx ', 'x x x'], x + 6, 40, 2, { x: P.giallo }); }
    puntine.sort((p, q) => p[0] - q[0]); for (let i = 2; i < puntine.length; i += 3) { const a = puntine[i - 2]!, b = puntine[i]!; if (Math.abs(a[0] - b[0]) < 120) filo(t, c.k, a[0], a[1], b[0], b[1], 4); }
  },
  // bosco di notte che gira tutta la stanza: tronchi col muschio, chiome in alto, funghi giganti che si illuminano, spore che galleggiano
  parete_bosco_spore: (t, c, s) => {
    R(t, P.boscoOmbra, 0, 0, t.w, t.h); R(t, P.bosco, 0, t.h - 22, t.w, 22); R(t, P.erbaScura, 0, t.h - 22, t.w, 2);
    for (let x = inizio(s, 70) - 70; x < t.w + 70; x += 70) {
      const tx = x + 20 + ((giroX(s) + x) * 7 % 30 + 30) % 30, w = 10 + ((giroX(s) + x) % 3 + 3) % 3 * 2;
      R(t, P.legnoScuro, tx, 0, w, t.h - 20); R(t, P.ombraCalda, tx + w - 2, 0, 2, t.h - 20); R(t, P.erbaScura, tx, 20, 2, t.h - 50); R(t, P.ombraCalda, tx - 3, t.h - 24, w + 6, 4);
    }
    for (let x = inizio(s, 22) - 22; x < t.w + 22; x += 22) { ovale(t, P.bosco, x, 4, 16, 10); ovale(t, P.erbaScura, x + 8, 2, 8, 5); }
    posti(s, 1.4).forEach((x, i) => {
      const grande = i % 2 === 0, k = grande ? 3 : 2, col = (i + Math.round(s.u0)) % 3 ? c.b : c.k, w = 9 * k, y = t.h - 10 - 7 * k;
      if (grande) alone(t, col, x, y + 2 * k, w * 0.6);
      sprite(t, FUNGO, x - w / 2, y, k, { x: col, o: P.pietraChiara, s: P.pietraChiara });
    });
    for (let n = Math.round(t.w / 30); n > 0; n--) { const x = t.r.next() * t.w, y = 10 + t.r.next() * (t.h - 40), col = pesca(t, [c.b, c.k, P.verdeNeon]); R(t, col, x, y, 2, 2); retino(t, col, x - 1, y - 1, 4, 4); }
  },
  // vetrate su un temporale d'estate al crepuscolo: telai di legno, colline e pioggia continui, un lampo; lucine calde appese in alto
  vetrata_temporale_estivo: (t, c, s) => {
    const y1 = t.h - 22;
    for (let x = 0; x < t.w; x++) { const u = giroX(s) + x, col = 46 + Math.round(Math.sin(u / 29) * 6 + Math.sin(u / 11) * 2); R(t, P.acquaProfonda, x, col - 14, 1, 14); R(t, P.boscoOmbra, x, col, 1, y1 - col); if (u % 40 < 2) R(t, P.ombraCalda, x, col - 8, 1, 8); }
    retino(t, P.acquaProfonda, 0, 26, t.w, 6);
    for (let y = 4; y < y1; y += 9) for (let x = inizio(s, 13) + (y % 2 ? 6 : 0); x < t.w; x += 13) linea(t, P.acqua, x, y, x - 2, y + 4);
    const ps = posti(s, 2), w = (s.x1 - s.x0) / ps.length, lampo = s.lato === 'fondo' ? Math.floor(ps.length / 3) : -1;
    ps.forEach((x, i) => {
      if (i === lampo) for (const [x0, y0, x1, y1_] of [[x + 4, 12, x - 2, 26], [x - 2, 26, x + 6, 28], [x + 6, 28, x, 46]] as const) linea(t, P.giallo, x0, y0, x1, y1_, 2);
      R(t, c.b, x - w / 2, 0, 8, t.h); R(t, c.b, x + w / 2 - 8, 0, 8, t.h); R(t, c.b, x - 2, 10, 4, y1 - 10); R(t, c.b, x - w / 2, (10 + y1) / 2 - 2, w, 4);
      for (const d of [-w / 4, w / 4]) { R(t, P.acquaBassa, x + d, 30 + (i * 13 + d) % 20, 1, 5); R(t, P.acquaBassa, x + d + 6, 50 + (i * 7) % 14, 1, 4); }
    });
    R(t, c.b, 0, 0, t.w, 10); R(t, c.b, 0, y1, t.w, t.h - y1); R(t, P.legnoChiaro, 0, y1, t.w, 2); R(t, P.legno, 0, 9, t.w, 1);
    const lu = posti(s, 0.9); filo(t, P.neroCaldo, s.x0, 12, s.x1, 12, 0);
    lu.slice(1).forEach((x, i) => filo(t, P.neroCaldo, lu[i]!, 14, x, 14, 6));
    for (const x of lu) { alone(t, c.k, x, 18, 6); ovale(t, c.k, x, 17, 2.5, 3); R(t, P.giallo, x - 1, 16, 1, 1); R(t, P.neroCaldo, x - 1, 13, 3, 2); }
  },
  // cialda e glassa: wafer a quadretti sotto, glassa rosa che cola con gocce lunghe e corte, codette arcobaleno
  muro_cialda_glassa: (t, c, s) => {
    for (let y = 40; y < t.h; y += 6) R(t, P.legnoChiaro, 0, y, t.w, 1);
    for (let x = inizio(s, 6); x < t.w; x += 6) R(t, P.legnoChiaro, x, 40, 1, t.h);
    for (let x = 0; x < t.w; x++) {
      const u = giroX(s) + x, l = 30 + Math.round(Math.max(0, Math.sin(u / 9)) * 14 + Math.max(0, Math.sin(u / 23 + 1)) * 18);
      R(t, c.b, x, 0, 1, l); if (Math.sin(u / 9) > 0.9) ovale(t, c.b, x, l, 2, 2.5);
      if (u % 17 === 3) R(t, P.pietraChiara, x, 6, 1, l - 14);
    }
    for (let y = 6; y < 34; y += 7) for (let x = inizio(s, 11) + (y % 2 ? 5 : 0); x < t.w; x += 11) { const col = [c.k, P.cianoNeon, P.verdeNeon, P.pietraChiara, P.violaNeon][(x + y + giroX(s)) % 5 & 7] ?? c.k; if ((x + y) % 3) R(t, col, x, y, 3, 1); else R(t, col, x, y, 1, 3); }
  },
  // orizzonte tropicale: un panorama solo sulle tre pareti, col sole in mezzo alla parete di fondo, mare, isolotti con le palme e la spiaggia
  orizzonte_tropicale: (t, c, s) => {
    const mare = Math.round(t.h * 0.52), riva = Math.round(t.h * 0.72), sole = centroFondo(s);
    for (const [y, col] of [[0, P.acquaProfonda], [12, c.a], [26, c.b], [mare - 10, P.pietraChiara]] as const) { R(t, col, 0, y, t.w, mare - y); if (y) retino(t, col, 0, y - 1, t.w, 1); }
    ovale(t, P.arancio, sole, mare - 4, 18, 18); ovale(t, P.giallo, sole, mare - 4, 14, 14); R(t, c.a, 0, mare, t.w, riva - mare);
    for (let y = mare + 3; y < riva; y += 4) for (let x = inizio(s, 19) + (y % 8 ? 9 : 0); x < t.w; x += 19) R(t, Math.abs(x - sole) < 22 ? P.giallo : c.b, x, y, 6, 1);
    for (let x = inizio(s, 90) - 90; x < t.w + 90; x += 90) { const cx = x + 40, cy = 14 + ((giroX(s) + x) / 90 % 3) * 5; for (const [dx, r] of [[-8, 5], [0, 7], [9, 5]] as const) ovale(t, P.pietraChiara, cx + dx, cy, r * 1.4, r * 0.8); }
    for (let x = 0; x < t.w; x++) { const d = Math.round(Math.sin((giroX(s) + x) / 6) * 1.5); R(t, P.sabbia, x, riva + d, 1, t.h - riva - d); R(t, P.pietraChiara, x, riva + d - 1, 1, 1); }
    for (const x of posti(s, 4.2)) { if (Math.abs(x - sole) < 40) continue; ovale(t, c.k, x, mare + 1, 26, 6); R(t, P.sabbia, x - 20, mare - 1, 40, 2); palma(t, x - 6, mare - 2, 30, 1); palma(t, x + 8, mare - 1, 22, -1); }
    for (let i = 0; i < 3; i++) { const bx = sole - 60 + i * 50, by = 18 + i * 4; linea(t, P.neroCaldo, bx, by, bx + 3, by + 2); linea(t, P.neroCaldo, bx + 3, by + 2, bx + 6, by); }
  },
  // scheda madre a 32 bit: piste dorate, via, condensatori e resistenze, la CPU al centro della parete di fondo, banchi di RAM ai lati
  scheda_madre_32bit: (t, c, s) => {
    for (let y = 6; y < t.h - 10; y += 6) { let x = inizio(s, 30) - 30, yy = y; while (x < t.w) { const l = 10 + Math.floor(t.r.next() * 30); R(t, P.erbaScura, x, yy, l, 1); x += l; if (t.r.next() < 0.3) anello(t, c.b, x, yy, 1.5, 1.5, 1); } }
    for (let n = Math.round(t.w / 18); n > 0; n--) { const x = t.r.next() * t.w, y = 8 + t.r.next() * (t.h - 24); if (t.r.next() < 0.5) { ovale(t, pesca(t, [P.acquaProfonda, P.pietra, P.abisso]), x, y, 3, 3); R(t, P.pietraChiara, x - 1, y - 1, 1, 1); } else { R(t, P.sabbia, x, y, 8, 3); R(t, P.rosso, x + 2, y, 1, 3); R(t, P.abisso, x + 4, y, 1, 3); R(t, c.b, x - 2, y + 1, 2, 1); R(t, c.b, x + 8, y + 1, 2, 1); } }
    if (s.lato === 'fondo') {
      const x = (s.x0 + s.x1) / 2, y = t.h * 0.45;
      for (let i = -14; i <= 14; i += 3) { linea(t, c.b, x + i, y - 18, x + i * 1.6, y - 40); linea(t, c.b, x + i, y + 18, x + i * 1.6, y + 42); }
      R(t, c.b, x - 20, y - 20, 40, 40); R(t, c.k, x - 18, y - 18, 36, 36); R(t, P.pietraScura, x - 10, y - 10, 20, 20); R(t, P.pietra, x - 9, y - 9, 18, 2); triangolo(t, c.b, x - 18, y - 18, x - 12, y - 18, x - 18, y - 12);
    } else for (const x of posti(s, 2.4)) for (let i = -1; i <= 1; i++) { R(t, c.k, x + i * 10 - 3, 14, 6, t.h - 34); for (let y = 16; y < t.h - 22; y += 3) R(t, c.b, x + i * 10 - 2, y, 1, 1); R(t, P.pietra, x + i * 10 - 3, 14, 6, 2); }
  },
  // palestra comunale: zoccolo blu, sopra crema con la riga; spalliere ai lati, in fondo canestro e orologio
  muro_palestra_comunale: (t, c, s) => {
    const z = t.h - 42; R(t, c.b, 0, 0, t.w, z); R(t, c.a, 0, z, t.w, t.h - z); R(t, P.rosso, 0, z - 3, t.w, 3);
    for (let y = 6; y < z; y += 12) R(t, P.pietraChiara, 0, y, t.w, 1);
    if (s.lato === 'fondo') {
      const x = (s.x0 + s.x1) / 2, ps = posti(s, 6);
      R(t, P.pietraChiara, x - 22, 14, 44, 30); cornice(t, P.rosso, x - 22, 14, 44, 30, 2); cornice(t, P.rosso, x - 9, 26, 18, 14, 1);
      R(t, P.arancio, x - 9, 44, 18, 2); for (let i = 0; i < 5; i++) linea(t, P.pietraChiara, x - 8 + i * 4, 46, x - 6 + i * 3, 58);
      for (const cx of ps.length > 1 ? [ps[0]!, ps[ps.length - 1]!] : []) { ovale(t, c.k, cx, 28, 11, 11); ovale(t, P.pietraChiara, cx, 28, 9, 9); for (let i = 0; i < 12; i++) R(t, c.k, cx + Math.cos(i / 1.91) * 7.5, 28 + Math.sin(i / 1.91) * 7.5, 1, 1); linea(t, P.neroCaldo, cx, 28, cx, 22); linea(t, P.neroCaldo, cx, 28, cx + 5, 28); }
    } else for (const x of posti(s, 2.2)) { R(t, P.legno, x - 16, 8, 3, t.h - 8); R(t, P.legno, x + 13, 8, 3, t.h - 8); for (let y = 12; y < t.h - 8; y += 7) { R(t, P.legnoChiaro, x - 13, y, 26, 2); R(t, P.legno, x - 13, y + 2, 26, 1); } }
  },
  // carrozza del treno: legno lucido, finestrini col paesaggio che scorre (continua da un finestrino all'altro), portabagagli d'ottone con le valigie
  finestrino_espvresso: (t, c, s) => {
    const y0 = 26, y1 = t.h - 34;
    const ps = posti(s, 2), w = (s.x1 - s.x0) / ps.length;
    for (const x of ps) {
      const x0 = x - w / 2 + 8, x1 = x + w / 2 - 8;
      R(t, P.giallo, x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6); R(t, P.ombraCalda, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
      for (let xx = Math.round(x0); xx < x1; xx++) {
        const u = giroX(s) + xx, mont = y0 + 14 + Math.round(Math.abs(((u / 14) % 2) - 1) * 10), coll = y0 + 28 + Math.round(Math.sin(u / 17) * 3);
        R(t, P.acquaBassa, xx, y0, 1, mont - y0); R(t, P.pietraScura, xx, mont, 1, coll - mont); R(t, mont < y0 + 17 ? P.pietraChiara : P.pietraScura, xx, mont, 1, 2); R(t, P.erba, xx, coll, 1, y1 - coll); if (u % 7 === 0) R(t, P.erbaChiara, xx, coll + 6 + (u % 3) * 4, 6, 1);
        if (u % 61 === 0) { R(t, P.legnoScuro, xx, y0 + 12, 1, y1 - y0 - 12); R(t, P.legnoScuro, xx - 3, y0 + 14, 7, 1); }
      }
      R(t, P.pietraChiara, x0 + 3, y0 + 3, 8, 1); R(t, P.pietraChiara, x0 + 3, y0 + 3, 1, 5);
    }
    R(t, c.k, 0, y1 + 6, t.w, 4); R(t, P.giallo, 0, y1 + 5, t.w, 1);
    R(t, P.giallo, 0, 4, t.w, 1); R(t, P.giallo, 0, 14, t.w, 1); for (let x = inizio(s, 20); x < t.w; x += 20) R(t, P.giallo, x, 4, 1, 16);
    for (const x of posti(s, 1.3)) { const col = pesca(t, [c.k, c.b, P.legnoChiaro, P.erbaScura]), w2 = 14 + Math.floor(t.r.next() * 8); R(t, col, x - w2 / 2, 5, w2, 9); R(t, P.ombraCalda, x - 2, 3, 4, 2); cornice(t, P.ombraCalda, x - w2 / 2, 5, w2, 9); }
  },
  // groviera: buchi di tutte le misure con l'ombra dentro, la crosta in alto; in fondo, la tana del topo
  parete_groviera_dop: (t, c, s) => {
    R(t, c.b, 0, 0, t.w, 6); R(t, P.legnoChiaro, 0, 5, t.w, 1);
    for (let n = Math.round(t.w / 9); n > 0; n--) {
      const r = pesca(t, [2, 2, 3, 3, 4, 5, 7, 9]), x = t.r.next() * t.w, y = 10 + r + t.r.next() * (t.h - 22 - 2 * r);
      ovale(t, c.b, x, y, r, r * 0.85); ovale(t, P.legnoChiaro, x, y - r * 0.15, r * 0.8, r * 0.6); R(t, P.giallo, x - r * 0.5, y + r * 0.6, r, 1);
    }
    if (s.lato === 'fondo') {
      const x = (s.x0 + s.x1) / 2, y = t.h - 8;
      ovale(t, c.b, x, y, 14, 16); ovale(t, c.k, x, y, 11, 13); R(t, P.giallo, x - 3, y - 6, 2, 2); R(t, P.giallo, x + 2, y - 6, 2, 2); R(t, P.pietraChiara, x - 2, y - 6, 1, 1); R(t, P.pietraChiara, x + 3, y - 6, 1, 1);
    }
  },
  // panorama di carta piegata: montagne a origami (una faccia in luce, una in ombra) su tutto il giro, sole di carta in fondo, gru in volo
  panorama_origami: (t, c, s) => {
    for (let y = 0; y < t.h; y += 16) R(t, P.acquaBassa, 0, y, t.w, 1);
    for (let x = inizio(s, 48); x < t.w; x += 48) linea(t, P.acquaBassa, x, 0, x + 30, t.h);
    const sole = centroFondo(s); stella(t, c.k, sole, 26, 14, 10, 8); ovale(t, P.arancio, sole, 26, 7, 7); stella(t, c.k, sole, 26, 5, 3, 8);
    const monti = (passo: number, alto: number, base: number, luce: string, ombra: string, fase: number) => {
      for (let x = inizio(s, passo) - passo + fase; x < t.w + passo; x += passo) { const h = alto * (0.7 + (((giroX(s) + x) * 13) % 7) / 20); triangolo(t, luce, x - passo * 0.7, base, x, base, x, base - h); triangolo(t, ombra, x, base - h, x, base, x + passo * 0.7, base); if (h > alto * 0.8) triangolo(t, P.pietraChiara, x - 5, base - h + 8, x, base - h + 8, x, base - h); }
    };
    monti(70, 46, t.h - 30, P.pietraChiara, P.pietra, 0); monti(54, 30, t.h - 12, c.b, P.erbaScura, 27);
    R(t, P.erbaScura, 0, t.h - 12, t.w, 12);
    for (const x of posti(s, 2.6)) { const y = 16 + ((giroX(s) + x) % 20); triangolo(t, P.rosso, x - 7, y, x, y + 3, x, y - 4); triangolo(t, P.rosaNeon, x, y - 4, x, y + 3, x + 6, y - 2); triangolo(t, P.rosso, x + 4, y - 1, x + 9, y - 6, x + 6, y); }
  },
  // paravento imperiale: ante di lacca rossa con la cornice d'oro, ognuna col suo dipinto (gru, bambù, monte con la luna, ramo di pruno)
  paravento_imperiale: (t, c, s) => {
    R(t, P.neroCaldo, 0, 0, t.w, t.h);
    const n = Math.max(1, quante((s.x1 - s.x0) / TEX_MURO, 1.3)), w = (s.x1 - s.x0) / n;
    centri(s.x0, s.x1, n).forEach((x, i) => {
      const x0 = x - w / 2 + 1, y0 = 6, h = t.h - 18, q = (i + Math.round(s.u0 * 2)) % 4;
      R(t, c.a, x0, y0, w - 2, h); cornice(t, c.b, x0, y0, w - 2, h, 2); cornice(t, P.arancio, x0 + 4, y0 + 4, w - 10, h - 8);
      const cx = x, cy = y0 + h / 2;
      if (q === 0) { ovale(t, P.pietraChiara, cx, cy - 6, 6, 4); linea(t, P.pietraChiara, cx + 4, cy - 8, cx + 10, cy - 20, 2); ovale(t, P.rosso, cx + 10, cy - 21, 1.5, 1.5); triangolo(t, P.pietraChiara, cx - 4, cy - 8, cx - 18, cy - 18, cx - 2, cy - 4); linea(t, P.neroCaldo, cx, cy - 2, cx - 2, cy + 10); for (let k2 = 0; k2 < 3; k2++) filo(t, c.b, x0 + 6, cy + 18 + k2 * 5, x0 + w - 8, cy + 18 + k2 * 5, -3); }
      else if (q === 1) for (const d of [-8, 2, 10]) { for (let y = y0 + 8; y < y0 + h - 6; y += 10) { R(t, c.k, cx + d, y, 3, 9); R(t, c.b, cx + d, y + 9, 3, 1); } triangolo(t, c.k, cx + d + 3, y0 + 24 + d, cx + d + 14, y0 + 20 + d, cx + d + 12, y0 + 26 + d); }
      else if (q === 2) { ovale(t, c.b, cx + 8, cy - 16, 6, 6); triangolo(t, P.ombraCalda, x0 + 6, y0 + h - 8, x0 + w - 8, y0 + h - 8, cx - 4, cy - 10); triangolo(t, P.pietraChiara, cx - 4, cy - 10, cx - 9, cy - 3, cx + 1, cy - 3); }
      else { linea(t, P.ombraCalda, x0 + 6, cy + 12, cx + 6, cy - 14, 2); linea(t, P.ombraCalda, cx - 4, cy + 1, cx - 10, cy - 10); for (const [dx, dy] of [[0, -6], [6, -14], [-9, -10], [-3, 2], [4, -1]] as const) { ovale(t, P.pietraChiara, cx + dx, cy + dy, 2.5, 2.5); R(t, P.rosaNeon, cx + dx, cy + dy, 1, 1); } }
      R(t, c.b, x0 + w - 3, y0 + 14, 2, 4); R(t, c.b, x0 + w - 3, y0 + h - 18, 2, 4);
    });
  },
  // onsen di notte: steccato di bambù legato con la corda, monti innevati, la luna in mezzo alla parete di fondo, vapore e lanterne di carta
  staccionata_onsen: (t, c, s) => {
    const luna = centroFondo(s), y1 = Math.round(t.h * 0.42);
    for (let x = inizio(s, 37); x < t.w; x += 37) R(t, P.pietraChiara, x + ((giroX(s) + x) % 23), 4 + ((giroX(s) + x) % 17), 1, 1);
    ovale(t, c.b, luna, 18, 9, 9); ovale(t, P.pietra, luna + 3, 16, 2, 2); alone(t, c.b, luna, 18, 14);
    for (let x = inizio(s, 80) - 80; x < t.w + 80; x += 80) { const h = 22 + ((giroX(s) + x) / 80 % 3) * 5; triangolo(t, P.roccia, x - 48, y1 + 6, x + 48, y1 + 6, x, y1 - h); triangolo(t, P.neroCaldo, x, y1 - h, x + 48, y1 + 6, x + 10, y1 + 6); triangolo(t, c.b, x - 10, y1 - h + 10, x + 4, y1 - h + 10, x, y1 - h); }
    for (let x = 0; x < t.w; x += 4) { const u = giroX(s) + x; R(t, c.k, x, y1, 4, t.h - y1); R(t, P.legno, x + 3, y1, 1, t.h - y1); for (let y = y1 + 8 + (u % 3) * 3; y < t.h; y += 14) R(t, P.legno, x, y, 4, 1); R(t, P.legnoChiaro, x, y1, 3, 1); }
    for (const y of [y1 + 12, t.h - 22]) { R(t, P.ombraCalda, 0, y, t.w, 3); for (let x = inizio(s, 4); x < t.w; x += 4) R(t, P.legnoScuro, x, y, 2, 3); }
    for (let n = Math.round(t.w / 60); n > 0; n--) { const x = t.r.next() * t.w, y = y1 - 6 + t.r.next() * 10; retino(t, c.b, x - 10, y - 4, 20, 5); retino(t, c.b, x - 4, y - 10, 12, 5, 1); }
    for (const x of posti(s, 2.4)) { R(t, P.neroCaldo, x, y1 - 4, 1, 8); alone(t, P.arancio, x, y1 + 14, 12); ovale(t, P.rosso, x, y1 + 14, 6, 8); R(t, P.ombraCalda, x - 4, y1 + 6, 8, 2); R(t, P.ombraCalda, x - 4, y1 + 21, 8, 2); for (const d of [-3, 0, 3]) R(t, P.giallo, x + d, y1 + 10, 1, 8); }
  },
  // laboratorio ad alto voltaggio: piastrelle bianche, provettoni di liquido fluo con le bolle, archi elettrici, quadro comandi con le leve
  parete_alto_voltaggio: (t, c, s) => {
    for (let y = 0; y < t.h; y += 16) R(t, P.pietra, 0, y, t.w, 1);
    for (let x = inizio(s, 16); x < t.w; x += 16) R(t, P.pietra, x, 0, 1, t.h);
    R(t, P.roccia, 0, 4, t.w, 3); R(t, P.rosso, 0, 9, t.w, 2);
    const ps = posti(s, 1.8), quadro = s.lato === 'fondo' ? Math.floor(ps.length / 2) : -1;
    ps.forEach((x, i) => {
      if (i === quadro) {
        R(t, P.pietraScura, x - 28, 20, 56, 52); rilievo(t, P.pietra, P.roccia, x - 28, 20, 56, 52, 2);
        for (const d of [-14, 0, 14]) { ovale(t, P.pietraChiara, x + d, 34, 5, 5); anello(t, P.neroCaldo, x + d, 34, 5, 5, 1); linea(t, P.rosso, x + d, 34, x + d + 3, 31); }
        for (const [d, col] of [[-10, P.rosso], [10, P.acquaProfonda]] as const) { R(t, P.roccia, x + d - 3, 54, 6, 12); linea(t, P.neroCaldo, x + d, 60, x + d + (d < 0 ? -6 : 6), 46, 2); ovale(t, col, x + d + (d < 0 ? -6 : 6), 45, 3, 3); }
        triangolo(t, P.giallo, x - 6, 18, x + 6, 18, x, 8); R(t, P.neroCaldo, x - 0.5, 12, 1, 3); R(t, P.neroCaldo, x - 0.5, 16, 1, 1); return;
      }
      const col = i % 2 ? c.k : c.b;
      R(t, P.pietraScura, x - 6, 16, 12, t.h - 26); R(t, P.pietraChiara, x - 5, 17, 10, t.h - 28); R(t, col, x - 4, 30, 8, t.h - 42); R(t, P.pietraChiara, x - 3, 18, 1, t.h - 30);
      for (const [dx, dy] of [[0, 40], [2, 52], [-1, 64]] as const) anello(t, P.pietraChiara, x + dx, dy, 1.5, 1.5, 1);
      R(t, P.roccia, x - 7, 12, 14, 5); R(t, P.roccia, x - 7, t.h - 12, 14, 4);
      if (i + 1 < ps.length && i + 1 !== quadro) { let px = x + 7, py = 22; for (let k2 = 1; k2 <= 6; k2++) { const nx = x + 7 + (k2 * (ps[i + 1]! - x - 14)) / 6, ny = 22 + (k2 % 2 ? -5 : 4); linea(t, P.cianoNeon, px, py, nx, ny); px = nx; py = ny; } }
    });
  },
};
