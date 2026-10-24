// I pavimenti classici disegnati interi (finiture_disegni.ts): legni, pietre, piastrelle, stuoie. 16 texel/m, una cella = 32 texel;
// y = 0 è il muro di fondo, y = h il davanti (la porta). Ogni disegno guarda la misura della stanza: fasce lungo i muri, rosoni al centro.
import { P, R, anello, assi, cornice, esagono, lastre, linea, ovale, pesca, quante, retino, rilievo, rombo, stella, trasposta, type DisegnoPav, type Tela } from './finiture_kit.ts';

/** Fascia di assi lungo i quattro muri (larga b texel), angoli tagliati a 45°, filetto dentro. */
function fasciaAssi(t: Tela, b: number, toni: readonly string[], fuga: string, filetto: string): void {
  const o = { larg: Math.max(3, b / 2), min: 40, max: 72, toni, fuga };
  assi(t, { ...o, x: 0, y: 0, w: t.w, h: b }); assi(t, { ...o, x: 0, y: t.h - b, w: t.w, h: b });
  trasposta(t, (u) => { assi(u, { ...o, x: b, y: 0, w: u.w - 2 * b, h: b }); assi(u, { ...o, x: b, y: u.h - b, w: u.w - 2 * b, h: b }); });
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [t.w - 1, 0, -1, 1], [0, t.h - 1, 1, -1], [t.w - 1, t.h - 1, -1, -1]] as const) linea(t, fuga, x, y, x + sx * (b - 1), y + sy * (b - 1));
  cornice(t, fuga, 0, 0, t.w, t.h); cornice(t, filetto, b, b, t.w - 2 * b, t.h - 2 * b);
}
/** Una tessera a esagono di una griglia a punta in su: centro della colonna i, riga j. */
const esaCentro = (i: number, j: number, a: number, b: number): [number, number] => [i * 2 * a + (j % 2 ? a : 0), j * 1.5 * b];
/** Distanza in esagoni tra due tessere (righe dispari spostate a destra). */
function esaDist(i: number, j: number, ci: number, cj: number): number {
  const q = (c: number, r: number) => [c - (r - (r & 1)) / 2, r] as const, [x1, z1] = q(i, j), [x2, z2] = q(ci, cj);
  return Math.max(Math.abs(x1 - x2), Math.abs(z1 - z2), Math.abs(x1 + z1 - x2 - z2));
}

export const PAVIMENTI: Record<string, DisegnoPav> = {
  // piastrelle di serie: campo crema col tozzetto scuro agli incroci, giro di piastrelle grigie lungo i muri, al centro un rombo intarsiato
  piastrelle: (t, c) => {
    const L = 16, Rr = Math.min(t.w, t.h) / 2 - 22;
    if (Rr > 10) { for (const [r, col] of [[Rr, c.k], [Rr - 2, c.b], [Rr - 7, c.a], [Rr * 0.5, c.b], [Rr * 0.5 - 3, c.a], [5, c.k]] as const) rombo(t, col, t.w / 2, t.h / 2, r, r); }
    R(t, c.b, 0, 0, t.w, L); R(t, c.b, 0, t.h - L, t.w, L); R(t, c.b, 0, 0, L, t.h); R(t, c.b, t.w - L, 0, L, t.h);
    for (let x = 0; x < t.w; x += L) R(t, x === 0 || x === t.w - L ? c.k : c.b, x, 0, 1, t.h);
    for (let y = 0; y < t.h; y += L) R(t, c.b, 0, y, t.w, 1);
    cornice(t, c.k, 0, 0, t.w, t.h); cornice(t, c.k, L, L, t.w - 2 * L, t.h - 2 * L);
    for (let y = 2 * L; y < t.h - L; y += L) for (let x = 2 * L; x < t.w - L; x += L) rombo(t, c.k, x, y, 2, 2);
    for (const [x, y] of [[0, 0], [t.w - L, 0], [0, t.h - L], [t.w - L, t.h - L]] as const) { R(t, c.k, x, y, L, L); rombo(t, c.a, x + L / 2, y + L / 2, 5, 5); }
  },
  // listelli di noce lungo la stanza, una fascia di listelli lungo i muri con gli angoli a 45°
  parquet: (t, c) => {
    assi(t, { x: 8, y: 8, w: t.w - 16, h: t.h - 16, larg: 4, min: 28, max: 64, toni: [c.a, c.a, c.a, c.b], fuga: c.k });
    fasciaAssi(t, 8, [c.b, c.b, c.k], P.ombraCalda, c.a);
  },
  // stuoie quadrate di bambù a cesto (una per verso), canne coi nodi, bordo di tela scura cucito
  bambu: (t, c) => {
    const M = 32;
    for (let y = 0; y < t.h; y += M) for (let x = 0; x < t.w; x += M) {
      const oriz = ((x + y) / M) % 2 === 0;
      for (let s = 0; s < M; s += 3) {
        if (oriz) { R(t, c.b, x, y + s + 2, M, 1); for (let n = (s * 5 + x) % 11; n < M; n += 11) R(t, c.b, x + n, y + s, 1, 2); }
        else { R(t, c.b, x + s + 2, y, 1, M); for (let n = (s * 5 + y) % 11; n < M; n += 11) R(t, c.b, x + s, y + n, 2, 1); }
      }
      cornice(t, c.k, x, y, M, M);
    }
    cornice(t, c.k, 0, 0, t.w, t.h, 3);
    for (let x = 2; x < t.w; x += 4) { R(t, c.a, x, 1, 2, 1); R(t, c.a, x, t.h - 2, 2, 1); }
    for (let y = 2; y < t.h; y += 4) { R(t, c.a, 1, y, 1, 2); R(t, c.a, t.w - 2, y, 1, 2); }
  },
  // lastre di pietra levigata a opus incertum, un cordolo di pietre lunghe lungo i muri
  lastre: (t, c) => {
    const pietra = (toni: readonly string[]) => (x: number, y: number, w: number, h: number) => {
      const col = pesca(t, toni); R(t, col, x, y, w, h);
      if (w > 4 && h > 4) rilievo(t, col === P.pietraChiara ? c.a : P.pietraChiara, c.b, x + 1, y + 1, w - 2, h - 2);
      R(t, c.k, x + w - 1, y, 1, h); R(t, c.k, x, y + h - 1, w, 1);
    };
    const B = 8;
    lastre(t, B, B, t.w - 2 * B, t.h - 2 * B, 10, 30, pietra([c.a, c.a, P.pietraChiara]));
    for (const [x, y, w, h] of [[0, 0, t.w, B], [0, t.h - B, t.w, B], [0, B, B, t.h - 2 * B], [t.w - B, B, B, t.h - 2 * B]] as const) lastre(t, x, y, w, h, 20, 48, pietra([c.b, c.b, c.a]));
    cornice(t, c.k, 0, 0, t.w, t.h);
  },
  // le assi del corridoio e delle scale (non si comprano): tavole larghe coi chiodi, come un pontile
  assi: (t, c) => assi(t, { x: 0, y: 0, w: t.w, h: t.h, larg: 8, min: 28, max: 32, toni: [c.a, c.a, c.b], fuga: c.k, vena: c.b, chiodo: c.k }),
  // rovere sbiancato: tavole lunghe verso il fondo, niente fasce, solo le testate; e le briciole che si vedono tutte
  parquet_rovere_sbiancato: (t, c) => {
    trasposta(t, (u) => assi(u, { x: 0, y: 4, w: u.w, h: u.h - 8, larg: 5, min: 40, max: 90, toni: [c.a, c.a, c.b], fuga: c.k, vena: c.b }));
    R(t, c.b, 0, 0, t.w, 4); R(t, c.b, 0, t.h - 4, t.w, 4); R(t, c.k, 0, 3, t.w, 1); R(t, c.k, 0, t.h - 4, t.w, 1);
    const bx = Math.round(t.w * 0.68), by = Math.round(t.h * 0.62);
    for (const [dx, dy] of [[0, 0], [3, 1], [5, -1], [8, 2]] as const) R(t, P.legnoChiaro, bx + dx, by + dy, dx % 2 ? 1 : 2, 1);
  },
  // spina di pesce in tre tostature (miele, caramello, caffè), cornice di listelli dritti scuri
  parquet_chicco_tostato: (t, c) => {
    const W = 4, toni = [c.a, c.a, c.a, c.b, c.b];
    const pezzo = (x: number, y: number, w: number, h: number) => { R(t, pesca(t, toni), x, y, w, h); R(t, c.k, x + w - 1, y, 1, h); R(t, c.k, x, y + h - 1, w, 1); };
    for (let k = -2; k * W < t.h + 2 * W; k++) for (let m = Math.floor((-W * k - 8 * W) / (4 * W)); W * k + 4 * W * m < t.w + 4 * W; m++) {
      const x = W * k + 4 * W * m; pezzo(x, W * k, 2 * W, W); pezzo(x + 2 * W, W * k - W, W, 2 * W);
    }
    fasciaAssi(t, 10, [c.k, c.k, c.b], P.ombraCalda, c.a);
  },
  // quadrotte di noce: riquadri da un metro di quattro listelli, a verso alterno; fascia scura lungo i muri
  parquet_quadrotte_noce: (t, c) => {
    const Q = 16, B = 8;
    for (let y = B; y < t.h - B; y += Q) for (let x = B; x < t.w - B; x += Q) {
      const oriz = ((x + y - 2 * B) / Q) % 2 === 0;
      for (let s = 0; s < Q; s += 4) {
        const col = pesca(t, [c.a, c.b, c.a]);
        if (oriz) { R(t, col, x, y + s, Q, 4); R(t, c.k, x, y + s + 3, Q, 1); } else { R(t, col, x + s, y, 4, Q); R(t, c.k, x + s + 3, y, 1, Q); }
      }
      cornice(t, c.k, x, y, Q, Q);
    }
    fasciaAssi(t, B, [c.k, c.k, c.a], c.k, c.b);
  },
  // cotto posato in diagonale, in quattro cotture diverse; fascia di mezzane dritte lungo i muri con i quadrotti negli angoli
  cotto_tradizionale: (t, c) => {
    const r = 6, B = 8;
    for (let y = 0; y < t.h + 2 * r; y += r) for (let x = (y / r) % 2 ? r : 0; x < t.w + 2 * r; x += 2 * r) {
      rombo(t, c.k, x, y, r + 1, r + 1); rombo(t, pesca(t, [c.a, c.a, c.a, c.a, c.a, P.legnoChiaro]), x, y, r - 0.5, r - 0.5);
    }
    for (const [x, y, w, h] of [[0, 0, t.w, B], [0, t.h - B, t.w, B], [0, 0, B, t.h], [t.w - B, 0, B, t.h]] as const) {
      R(t, P.legnoChiaro, x, y, w, h);
      if (w > h) for (let i = x; i < x + w; i += 16) R(t, c.k, i, y, 1, h); else for (let j = y; j < y + h; j += 16) R(t, c.k, x, j, w, 1);
    }
    cornice(t, c.k, 0, 0, t.w, t.h); cornice(t, c.b, B, B, t.w - 2 * B, t.h - 2 * B);
    for (const [x, y] of [[0, 0], [t.w - B, 0], [0, t.h - B], [t.w - B, t.h - B]] as const) { R(t, c.b, x, y, B, B); rombo(t, c.a, x + B / 2, y + B / 2, 2.5, 2.5); }
  },
  // marmo bianco a lastroni da 2×2 m con vene lunghe che li attraversano tutti, intarsio a stella al centro, fascia di bardiglio
  marmo_bianco_venato: (t, c) => {
    for (let x = 64; x < t.w; x += 64) R(t, P.pietraChiara, x, 0, 1, t.h);
    for (let y = 64; y < t.h; y += 64) R(t, P.pietraChiara, 0, y, t.w, 1);
    for (let n = quante(t.w + t.h, 70); n > 0; n--) {
      let x = t.r.next() * t.w, y = 0, a = Math.PI / 2 + (t.r.next() - 0.5) * 1.6;
      if (t.r.next() < 0.4) { x = t.r.next() < 0.5 ? 0 : t.w; y = t.r.next() * t.h; a = x ? Math.PI - 0.5 : 0.5; }
      for (let i = 0; i < 900 && x >= -2 && x <= t.w + 2 && y >= -2 && y <= t.h + 2; i++) {
        const nx = x + Math.cos(a) * 2, ny = y + Math.sin(a) * 2; linea(t, i % 37 < 12 ? c.k : c.b, x, y, nx, ny); x = nx; y = ny; a += (t.r.next() - 0.5) * 0.5;
      }
    }
    const cx = t.w / 2, cy = t.h / 2, rr = Math.min(t.w, t.h) / 4;
    ovale(t, c.a, cx, cy, rr + 3, rr + 3); anello(t, c.k, cx, cy, rr + 2, rr + 2, 2); anello(t, c.b, cx, cy, rr - 2, rr - 2, 1);
    stella(t, c.b, cx, cy, rr - 3, rr / 3, 8, -Math.PI / 2 + Math.PI / 8); stella(t, c.k, cx, cy, rr - 3, rr / 4, 4); ovale(t, c.a, cx, cy, 3, 3);
    cornice(t, c.k, 0, 0, t.w, t.h, 5); cornice(t, c.b, 6, 6, t.w - 12, t.h - 12);
  },
  // resina spatolata: le passate di spatola come mezzelune chiare, giunti di dilatazione che dividono la stanza in campi grandi
  resina_cemento_spatolato: (t, c) => {
    for (let n = quante(t.w * t.h, 900); n > 0; n--) {
      const x = t.r.next() * t.w, y = t.r.next() * t.h, rx = 14 + t.r.next() * 26, ry = rx * (0.4 + t.r.next() * 0.3), dx = (t.r.next() - 0.5) * 8, dy = 2 + t.r.next() * 4;
      ovale(t, c.b, x, y, rx, ry); ovale(t, c.a, x + dx, y + dy, rx, ry);
    }
    const nx = quante(t.w, 96), ny = quante(t.h, 96);
    for (let i = 1; i < nx; i++) R(t, c.k, Math.round((i * t.w) / nx), 0, 1, t.h);
    for (let j = 1; j < ny; j++) R(t, c.k, 0, Math.round((j * t.h) / ny), t.w, 1);
    cornice(t, c.k, 0, 0, t.w, t.h, 2);
  },
  // moquette a pelo corto: le righe fresche dell'aspirapolvere, il bordo rinforzato e, dalla porta, le impronte di fango che si fermano
  moquette_beige_pelo_corto: (t, c) => {
    const n = quante(t.w, 14);
    for (let i = 0; i < n; i += 2) retino(t, c.b, Math.round((i * t.w) / n), 0, Math.round(t.w / n), t.h, i);
    cornice(t, c.k, 0, 0, t.w, t.h, 3); cornice(t, c.b, 3, 3, t.w - 6, t.h - 6);
    let x = t.w / 2 + 6, y = t.h - 6;
    for (let i = 0; i < 9; i++) {
      const lato = i % 2 ? -3 : 3, col = i < 6 ? P.legnoScuro : P.legno;
      ovale(t, col, x + lato, y, 1.6, 2.4); R(t, col, x + lato - 1, y - 4, 3, 1);
      x -= 2.5 + i * 0.6; y -= 9;
    }
  },
  // ardesia a corsi di altezze diverse, una lastra più scura qua e là, e la macchia di sole della finestra dove ci si addormenta
  lastre_ardesia_naturale: (t, c) => {
    for (let y = 0; y < t.h;) {
      const hh = pesca(t, [8, 10, 12]);
      for (let x = -Math.floor(t.r.next() * 20); x < t.w;) {
        const l = 14 + Math.floor(t.r.next() * 20), col = pesca(t, [c.a, c.a, c.a, c.k]);
        R(t, col, x, y, l, hh); R(t, col === c.k ? c.a : c.b, x + 1, y, l - 2, 1); R(t, c.k, x + l - 1, y, 1, hh); x += l;
      }
      R(t, c.k, 0, y + hh - 1, t.w, 1); y += hh;
    }
    const sx = Math.round(t.w * 0.18), sy = Math.round(t.h * 0.12), lw = 22, lh = 30;
    for (let j = 0; j < lh; j++) {
      if (j === lh / 2) continue;
      const x = sx + Math.round(j * 0.6);
      retino(t, c.b, x, sy + j, lw / 2 - 1, 1, j); retino(t, c.b, x + lw / 2 + 1, sy + j, lw / 2 - 1, 1, j);
    }
  },
  // tatami da 1×2 m a corsi sfalsati (mai quattro angoli insieme), la trama lungo il lato lungo, i bordi di stoffa scura
  tatami_intrecciato: (t, c) => {
    const L = 32, S = 16;
    for (let y = 0; y < t.h; y += S) for (let x = (y / S) % 2 ? -S : 0; x < t.w; x += L) {
      R(t, c.a, x, y, L, S);
      for (let yy = y + 4; yy < y + S - 3; yy += 3) R(t, P.erba, x + 1, yy, L - 2, 1);
      R(t, c.k, x, y, L, 1); R(t, c.b, x, y + 1, L, 1); R(t, c.b, x, y, 1, S);
    }
    cornice(t, c.k, 0, 0, t.w, t.h, 2);
  },
  // cementine esagonali: un grande rosone di anelli rossi, crema e azzurri al centro, intorno tessere azzurre col fiorellino
  cementine_esagonali: (t, c) => {
    const a = 6, b = 7, nj = Math.ceil(t.h / (1.5 * b)) + 1, ni = Math.ceil(t.w / (2 * a)) + 1, ci = Math.floor(ni / 2), cj = Math.floor(nj / 2) & ~1;
    const Rr = Math.max(2, Math.floor(Math.min(ni, nj * 0.85) / 2) - 1);
    R(t, c.k, 0, 0, t.w, t.h);
    for (let j = 0; j <= nj; j++) for (let i = -1; i <= ni; i++) {
      const [x, y] = esaCentro(i, j, a, b), d = esaDist(i, j, ci, cj);
      if (d <= Rr) {
        const anelloN = d % 3; esagono(t, anelloN === 0 ? c.b : anelloN === 1 ? c.a : P.pietraChiara, x, y, a - 1, b - 1);
        if (anelloN !== 2) rombo(t, c.k, x, y, 2, 2);
      } else { esagono(t, c.a, x, y, a - 1, b - 1); R(t, c.k, x - 1, y - 1, 2, 2); }
    }
    cornice(t, c.b, 0, 0, t.w, t.h, 5); cornice(t, c.k, 5, 5, t.w - 10, t.h - 10);
  },
  // nido d'ape: tesserine bianche a esagono, i fiorellini blu da contare a distanze regolari, un bordo blu tutto intorno
  mosaico_nido_ape: (t, c) => {
    const a = 3, b = 4, nj = Math.ceil(t.h / (1.5 * b)) + 1, ni = Math.ceil(t.w / (2 * a)) + 1;
    R(t, c.k, 0, 0, t.w, t.h);
    const fiori: [number, number][] = [];
    for (let j = 2; j < nj; j += 6) for (let i = (j / 6) % 2 ? 5 : 2; i < ni; i += 6) fiori.push([i, j]);
    for (let j = 0; j <= nj; j++) for (let i = -1; i <= ni; i++) {
      const [x, y] = esaCentro(i, j, a, b), d = Math.min(...fiori.map(([fi, fj]) => esaDist(i, j, fi, fj)));
      esagono(t, d === 0 ? P.giallo : d === 1 ? c.b : c.a, x, y, a - 0.5, b - 0.5);
    }
    cornice(t, c.b, 0, 0, t.w, t.h, 4); cornice(t, c.a, 4, 4, t.w - 8, t.h - 8);
  },
  // graniglia: scaglie di marmo fitte ma grandi, listelli d'ottone a riquadri, una rosa dei venti al centro. E un bottone perso.
  graniglia_indistruttibile: (t, c) => {
    for (let y = 0; y < t.h; y += 9) for (let x = (y / 9) % 2 ? 4 : 0; x < t.w; x += 9) {
      const s = 1 + Math.floor(t.r.next() * 2);
      R(t, pesca(t, [c.b, P.pietraChiara, P.pietraChiara, P.pietraScura, P.pietraScura, c.k]), x + Math.floor(t.r.next() * 3), y + Math.floor(t.r.next() * 3), s + 1, s);
    }
    for (let x = 64; x < t.w; x += 64) R(t, P.sabbia, x, 0, 1, t.h);
    for (let y = 64; y < t.h; y += 64) R(t, P.sabbia, 0, y, t.w, 1);
    const cx = t.w / 2, cy = t.h / 2, rr = Math.min(t.w, t.h) / 4;
    ovale(t, c.a, cx, cy, rr, rr); anello(t, P.sabbia, cx, cy, rr, rr, 1);
    stella(t, c.b, cx, cy, rr - 2, rr / 5, 4, -Math.PI / 4); stella(t, c.k, cx, cy, rr - 2, rr / 5, 4); ovale(t, P.sabbia, cx, cy, 2, 2);
    cornice(t, c.b, 0, 0, t.w, t.h, 4); cornice(t, P.sabbia, 4, 4, t.w - 8, t.h - 8);
    const bx = Math.round(t.w * 0.27), by = Math.round(t.h * 0.71);
    ovale(t, P.acqua, bx, by, 2.5, 2.5); R(t, P.neroCaldo, bx - 1, by - 1, 1, 1); R(t, P.neroCaldo, bx + 1, by, 1, 1);
  },
  // tavolato da taverna: tavole larghe coi chiodi, pozze d'idromele e i cerchi lasciati dai boccali
  tavolato_taverna: (t, c) => {
    assi(t, { x: 0, y: 0, w: t.w, h: t.h, larg: 8, min: 40, max: 72, toni: [c.a, c.a, c.b], fuga: P.ombraCalda, vena: c.b, chiodo: P.neroCaldo });
    for (let n = quante(t.w * t.h, 9000) + 1; n > 0; n--) {
      const x = 20 + t.r.next() * (t.w - 40), y = 20 + t.r.next() * (t.h - 40), r = 5 + t.r.next() * 5;
      ovale(t, P.arancio, x, y, r, r * 0.6); ovale(t, P.arancio, x + r * 0.7, y + 2, r * 0.6, r * 0.4); ovale(t, c.k, x - r * 0.3, y - 1, r * 0.35, r * 0.2);
    }
    for (let n = quante(t.w * t.h, 6000) + 1; n > 0; n--) anello(t, c.b, 16 + t.r.next() * (t.w - 32), 16 + t.r.next() * (t.h - 32), 4, 3, 1);
  },
};
