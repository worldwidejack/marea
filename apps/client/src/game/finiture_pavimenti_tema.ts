// I pavimenti a tema disegnati interi (finiture_disegni.ts): ognuno è una scena grande quanto la stanza (la pista da bowling che arriva
// ai birilli, il campo da basket con le aree, la battigia, il laghetto delle carpe). 16 texel/m, una cella = 32; y = 0 il muro di fondo.
import { P, R, anello, assi, bande, cornice, filo, greca, linea, ovale, pesca, quante, retino, rilievo, rombo, stella, trasposta, triangolo, type DisegnoPav, type Tela } from './finiture_kit.ts';

/** Fascia a strisce di pericolo (diagonali) larga s lungo i quattro muri. */
function pericolo(t: Tela, s: number, c1: string, c2: string): void {
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    if (x >= s && y >= s && x < t.w - s && y < t.h - s) { x = t.w - s - 1; continue; }
    R(t, ((x + y) >> 2) & 1 ? c1 : c2, x, y, 1, 1);
  }
}
/** Un tubo del salvaschermo: tratti dritti a gomito, con la luce sopra e la sfera a ogni curva. */
function tubo(t: Tela, col: string, luce: string, x: number, y: number, passi: number): void {
  let d = Math.floor(t.r.next() * 4);
  for (let i = 0; i < passi; i++) {
    const l = 14 + Math.floor(t.r.next() * 40), dx = [1, 0, -1, 0][d]!, dy = [0, 1, 0, -1][d]!;
    const nx = Math.max(6, Math.min(t.w - 6, x + dx * l)), ny = Math.max(6, Math.min(t.h - 6, y + dy * l));
    R(t, col, Math.min(x, nx) - 1, Math.min(y, ny) - 1, Math.abs(nx - x) + 3, Math.abs(ny - y) + 3);
    R(t, luce, Math.min(x, nx) - (dy ? 1 : 0), Math.min(y, ny) - (dx ? 1 : 0), dx ? Math.abs(nx - x) + 1 : 1, dy ? Math.abs(ny - y) + 1 : 1);
    ovale(t, col, nx, ny, 3, 3); R(t, luce, nx - 1, ny - 2, 2, 1);
    x = nx; y = ny; d = (d + (t.r.next() < 0.5 ? 1 : 3)) % 4;
  }
}

export const PAVIMENTI_TEMA: Record<string, DisegnoPav> = {
  // moquette da bowling anni '90 (ghirigori fluo che nascondono le macchie) con una pista vera nel mezzo, dai birilli in fondo alla palla
  moquette_bowling: (t, c) => {
    for (let y = 6; y < t.h; y += 20) for (let x = (y / 20) % 2 ? 16 : 4; x < t.w; x += 24) {
      const qx = x + Math.floor(t.r.next() * 8), qy = y + Math.floor(t.r.next() * 8), f = Math.floor(t.r.next() * 4);
      if (f === 0) for (let i = 0; i < 7; i++) R(t, c.b, qx + i, qy + (i % 2 ? 1 : 0), 1, 2);
      else if (f === 1) triangolo(t, c.k, qx, qy + 5, qx + 6, qy + 5, qx + 2, qy);
      else if (f === 2) anello(t, P.cianoNeon, qx + 3, qy + 3, 3, 3, 1);
      else { R(t, P.verdeNeon, qx, qy + 2, 6, 1); R(t, P.verdeNeon, qx + 2, qy, 1, 6); }
    }
    const lw = t.w >= 160 ? 48 : 32, x0 = Math.round(t.w / 2 - lw / 2);
    R(t, P.neroCaldo, x0 - 6, 0, lw + 12, t.h); R(t, P.roccia, x0 - 5, 0, 4, t.h); R(t, P.roccia, x0 + lw + 1, 0, 4, t.h);
    R(t, P.legnoChiaro, x0, 0, lw, t.h);
    for (let x = x0 + 3; x < x0 + lw; x += 4) R(t, P.sabbia, x, 0, 1, t.h);
    const fl = t.h - 12; R(t, P.rosso, x0, fl, lw, 2);
    for (let i = 0; i < 5; i++) { const ax = x0 + ((i + 1) * lw) / 6, ay = fl - 40 - Math.abs(i - 2) * 4; triangolo(t, P.legnoScuro, ax - 2, ay + 4, ax + 2, ay + 4, ax, ay); R(t, P.legnoScuro, ax, fl - 22, 1, 1); }
    R(t, P.legno, x0, 0, lw, 22);
    for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) { const px = t.w / 2 + (i - r / 2) * 8, py = 4 + (3 - r) * 5; ovale(t, P.pietraChiara, px, py + 1, 2.5, 2.5); R(t, P.rosso, px - 1, py - 2, 3, 1); }
    ovale(t, P.violaNeon, t.w / 2 + 6, fl - 60, 6, 6); ovale(t, P.viola, t.w / 2 + 8, fl - 58, 3, 3);
    for (const [dx, dy] of [[-2, -2], [1, -3], [-1, 1]] as const) R(t, P.neroCaldo, t.w / 2 + 6 + dx, fl - 60 + dy, 2, 2);
  },
  // tavole vecchie e scure che scricchiolano: due assi saltate (qualcosa ti guarda dal buio), ragnatele negli angoli, un'asse schiodata
  parquet_scricchiolante: (t, c) => {
    assi(t, { x: 0, y: 0, w: t.w, h: t.h, larg: 6, min: 30, max: 70, toni: [c.a, c.a, c.a, P.legno], fuga: c.b, chiodo: P.neroCaldo });
    for (let n = quante(t.w * t.h, 16000) + 1, i = 0; i < n; i++) {
      const x = 24 + Math.floor(t.r.next() * (t.w - 60)), y = 12 + 6 * Math.floor(t.r.next() * (t.h / 6 - 4)), l = 16 + Math.floor(t.r.next() * 10);
      R(t, P.neroCaldo, x, y, l, 6); R(t, c.b, x, y, l, 1); triangolo(t, c.a, x + l, y, x + l, y + 6, x + l - 4, y + 3);
      if (i === 0) { R(t, P.giallo, x + l / 2 - 3, y + 2, 2, 2); R(t, P.giallo, x + l / 2 + 2, y + 2, 2, 2); }
    }
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [t.w, 0, -1, 1], [0, t.h, 1, -1], [t.w, t.h, -1, -1]] as const) {
      for (const a of [0, 0.4, 0.8, 1.2, Math.PI / 2]) linea(t, c.k, cx, cy, cx + sx * Math.cos(a) * 22, cy + sy * Math.sin(a) * 22);
      for (const r of [7, 13, 19]) for (let i = 0; i < 4; i++) {
        const a0 = [0, 0.4, 0.8, 1.2][i]!, a1 = i < 3 ? a0 + 0.4 : Math.PI / 2;
        filo(t, P.pietraScura, cx + sx * Math.cos(a0) * r, cy + sy * Math.sin(a0) * r, cx + sx * Math.cos(a1) * r, cy + sy * Math.sin(a1) * r, sy * -1.5);
      }
    }
    const sx = Math.round(t.w * 0.62), sy = 6 * Math.round(t.h * 0.55 / 6);
    R(t, P.legno, sx, sy - 1, 30, 6); R(t, c.b, sx, sy + 5, 30, 1); R(t, P.pietra, sx + 27, sy, 2, 2);
  },
  // dentro un vecchio PC: griglia al neon che fugge verso il fondo, i tubi del salvaschermo che girano a gomito
  griglia_salvaschermo_3d: (t, c) => {
    const vx = t.w / 2, vy = -t.h * 0.7;
    for (let i = -quante(t.w, 16) * 2; i <= quante(t.w, 16) * 2; i++) { const xb = t.w / 2 + i * 16; linea(t, c.b, xb, t.h, vx + (xb - vx) * ((0 - vy) / (t.h - vy)), 0); }
    for (let i = 1, n = quante(t.h, 12); i <= n; i++) R(t, c.k, 0, Math.round(t.h * Math.pow(i / n, 1.5)) - 1, t.w, 1);
    for (const col of [[P.rosaNeon, P.pietraChiara], [P.ambraNeon, P.giallo], [P.violaNeon, P.cianoNeon]] as const) tubo(t, col[0], col[1], 20 + t.r.next() * (t.w - 40), 20 + t.r.next() * (t.h - 40), 6 + quante(t.w, 60));
    cornice(t, c.k, 0, 0, t.w, t.h, 2);
  },
  // linoleum anni '70: piastrelle coi cerchi arancio, al centro un riquadro a colori rovesciati; e le prove del «lo passo domani»
  linoleum_straccio_domani: (t, c) => {
    const L = 32, ni = t.w / L, nj = t.h / L;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const x = i * L, y = j * L, dentro = Math.abs(i + 0.5 - ni / 2) < ni / 4 && Math.abs(j + 0.5 - nj / 2) < nj / 4, f = dentro ? c.b : c.a, s = dentro ? c.a : c.b;
      R(t, f, x, y, L, L);
      for (const [qx, qy] of [[0, 0], [L, 0], [0, L], [L, L]] as const) ovale(t, P.legnoChiaro, x + qx, y + qy, 7, 7);
      ovale(t, s, x + L / 2, y + L / 2, 11, 11); ovale(t, f, x + L / 2, y + L / 2, 7, 7); ovale(t, s, x + L / 2, y + L / 2, 3, 3);
    }
    for (let x = 0; x <= t.w; x += L) R(t, c.k, x, 0, 1, t.h);
    for (let y = 0; y <= t.h; y += L) R(t, c.k, 0, y, t.w, 1);
    const p = (fx: number, fy: number) => [Math.round(t.w * fx), Math.round(t.h * fy)] as const;
    { const [x, y] = p(0.8, 0.78); R(t, P.rosso, x, y, 7, 3); R(t, P.rosso, x + 4, y + 3, 3, 4); R(t, P.pietraChiara, x, y, 2, 3); }
    { const [x, y] = p(0.14, 0.82); ovale(t, P.pietraChiara, x, y, 4, 3); linea(t, c.k, x - 3, y, x + 2, y - 2); linea(t, c.k, x - 1, y + 2, x + 3, y); }
    { const [x, y] = p(0.33, 0.4); ovale(t, P.legno, x, y, 6, 3); ovale(t, P.legnoChiaro, x + 1, y - 1, 3, 1.5); }
    { const [x, y] = p(0.66, 0.24); R(t, P.giallo, x, y, 8, 2); R(t, P.giallo, x - 2, y + 2, 3, 3); R(t, P.giallo, x + 8, y + 2, 3, 3); R(t, P.legnoScuro, x + 3, y, 2, 2); }
  },
  // muschio soffice a cuscini, sassi piatti che portano dalla porta in fondo, trifogli, fiorellini bianchi e la ghianda dello scoiattolo
  tappeto_muschio_soffice: (t, c) => {
    for (let n = quante(t.w * t.h, 500); n > 0; n--) ovale(t, pesca(t, [c.b, c.b, P.bosco]), t.r.next() * t.w, t.r.next() * t.h, 5 + t.r.next() * 9, 3 + t.r.next() * 6);
    for (let n = quante(t.w * t.h, 900); n > 0; n--) ovale(t, c.a, t.r.next() * t.w, t.r.next() * t.h, 3 + t.r.next() * 5, 2 + t.r.next() * 3);
    let x = t.w / 2, y = t.h - 10;
    while (y > 12) { const rx = 6 + t.r.next() * 3; ovale(t, P.pietraScura, x + 1, y + 2, rx, rx * 0.6); ovale(t, P.pietra, x, y, rx, rx * 0.6); ovale(t, P.pietraChiara, x - 1, y - 1, rx * 0.5, rx * 0.25); x += Math.sin(y / 18) * 10; y -= 16; }
    for (let n = quante(t.w * t.h, 2500); n > 0; n--) {
      const qx = t.r.next() * t.w, qy = t.r.next() * t.h;
      if (t.r.next() < 0.5) for (const [dx, dy] of [[0, -2], [-2, 1], [2, 1]] as const) ovale(t, P.erbaChiara, qx + dx, qy + dy, 1.5, 1.5);
      else { R(t, P.pietraChiara, qx, qy - 1, 1, 3); R(t, P.pietraChiara, qx - 1, qy, 3, 1); R(t, P.giallo, qx, qy, 1, 1); }
    }
    for (const [fx, fy] of [[0.07, 0.1], [0.93, 0.12]] as const) for (let i = 0; i < 3; i++) { const qx = t.w * fx + i * 4 - 4, qy = t.h * fy + (i % 2) * 4; R(t, P.pietraChiara, qx, qy, 1, 3); ovale(t, c.k, qx, qy, 2, 1.5); }
    const gx = Math.round(t.w * 0.7), gy = Math.round(t.h * 0.6); ovale(t, P.legno, gx, gy + 1, 2.5, 3); R(t, P.legnoScuro, gx - 3, gy - 2, 6, 2); R(t, P.legnoScuro, gx, gy - 3, 1, 1);
  },
  // scacchiera di cioccolato (quadretti di tavoletta) e vaniglia (biscotto coi buchini), cornice di tavolette... con un morso
  scacchiera_cioccolato_vaniglia: (t, c) => {
    const L = 32, B = 8;
    for (let y = B; y < t.h - B; y += L / 2) for (let x = B; x < t.w - B; x += L / 2) {
      const s = L / 2, cioc = (((x - B) / s) + ((y - B) / s)) % 2 === 0;
      if (cioc) { R(t, c.k, x, y, s, s); rilievo(t, P.legno, c.a, x + 1, y + 1, s - 2, s - 2); R(t, c.a, x + s / 2, y + 1, 1, s - 2); R(t, c.a, x + 1, y + s / 2, s - 2, 1); }
      else { R(t, c.b, x, y, s, s); cornice(t, P.sabbia, x + 1, y + 1, s - 2, s - 2); for (const [dx, dy] of [[4, 4], [11, 4], [4, 11], [11, 11], [7, 7]] as const) R(t, P.sabbia, x + dx, y + dy, 1, 1); }
    }
    for (const [x, y, w, h] of [[0, 0, t.w, B], [0, t.h - B, t.w, B], [0, B, B, t.h - 2 * B], [t.w - B, B, B, t.h - 2 * B]] as const) {
      R(t, c.k, x, y, w, h);
      if (w > h) for (let i = x; i < x + w; i += 12) { rilievo(t, P.legno, c.a, i + 1, y + 1, 10, h - 2); } else for (let j = y; j < y + h; j += 12) rilievo(t, P.legno, c.a, x + 1, j + 1, w - 2, 10);
    }
    ovale(t, c.a, t.w, t.h, 14, 12); for (let i = 0; i < 4; i++) ovale(t, c.a, t.w - 14 + i * 3, t.h - 12 - (i % 2) * 2, 3, 3);
    for (const [dx, dy] of [[-20, -6], [-17, -15], [-24, -10]] as const) R(t, c.k, t.w + dx, t.h + dy, 2, 2);
  },
  // la battigia: mare in fondo a bande (alto, medio, basso), la schiuma che fa l'onda, sabbia bagnata; conchiglie, stelle, un granchio e le impronte
  battigia_bagnata: (t, c) => {
    const riva = (x: number) => t.h * 0.34 + Math.sin(x / 23) * 4 + Math.sin(x / 9 + 1) * 1.5;
    for (let x = 0; x < t.w; x++) {
      const r = riva(x); R(t, P.acquaProfonda, x, 0, 1, r * 0.35); R(t, P.acqua, x, r * 0.35, 1, r * 0.4); R(t, c.b, x, r * 0.75, 1, r * 0.25);
      R(t, P.pietraChiara, x, r - 1, 1, 2 + (Math.sin(x / 5) > 0.6 ? 1 : 0)); retino(t, P.legnoChiaro, x, r + 2, 1, 10 + Math.sin(x / 13) * 3, x);
      if (Math.sin(x / 11) > 0.7) R(t, P.acquaBassa, x, r * 0.5, 1, 1);
    }
    for (let n = quante(t.w * t.h, 2200); n > 0; n--) {
      const x = 10 + t.r.next() * (t.w - 20), y = t.h * 0.5 + t.r.next() * (t.h * 0.45), f = Math.floor(t.r.next() * 3);
      if (f === 0) stella(t, c.k, x, y, 4, 1.5, 5); else if (f === 1) { ovale(t, P.rosaNeon, x, y, 3, 2); R(t, P.pietraChiara, x - 1, y - 2, 1, 3); R(t, P.pietraChiara, x + 1, y - 2, 1, 3); }
      else { ovale(t, P.pietraChiara, x, y, 2, 1.5); R(t, P.pietra, x - 1, y, 3, 1); }
    }
    const gx = t.w * 0.78, gy = t.h * 0.72; ovale(t, P.rosso, gx, gy, 4, 3); for (const s of [-1, 1]) { R(t, P.rosso, gx + s * 5 - 1, gy - 4, 2, 2); linea(t, P.rosso, gx + s * 3, gy + 2, gx + s * 6, gy + 4); } R(t, P.neroCaldo, gx - 2, gy - 2, 1, 1); R(t, P.neroCaldo, gx + 1, gy - 2, 1, 1);
    for (let i = 0, x = t.w * 0.15, y = t.h - 6; i < 10 && y > t.h * 0.42; i++) { ovale(t, P.legnoChiaro, x + (i % 2 ? 3 : -3), y, 1.5, 2.5); x += 7; y -= 6; }
  },
  // dentro un dissipatore: alette di rame lungo la stanza, ventole grandi in griglia con le pale e il LED, una striscia LED lungo i muri
  dissipatore_rame_ventole: (t, c) => {
    for (let y = 0; y < t.h; y += 4) { R(t, c.a, 0, y, t.w, 3); R(t, P.legno, 0, y + 3, t.w, 1); R(t, P.sabbia, 0, y, t.w, 1); }
    const nx = quante(t.w, 72), ny = quante(t.h, 72), rr = Math.min(t.w / nx, t.h / ny) * 0.36;
    for (const y of Array.from({ length: ny }, (_, j) => ((j + 0.5) * t.h) / ny)) for (const x of Array.from({ length: nx }, (_, i) => ((i + 0.5) * t.w) / nx)) {
      R(t, P.roccia, x - rr - 4, y - rr - 4, 2 * rr + 8, 2 * rr + 8); cornice(t, c.b, x - rr - 4, y - rr - 4, 2 * rr + 8, 2 * rr + 8);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) ovale(t, P.pietra, x + dx * (rr + 1), y + dy * (rr + 1), 1.5, 1.5);
      ovale(t, c.b, x, y, rr, rr);
      for (let i = 0; i < 7; i++) { const a = (i * 2 * Math.PI) / 7, b2 = a + 0.6; triangolo(t, i % 2 ? P.pietraScura : P.pietra, x, y, x + Math.cos(a) * (rr - 1), y + Math.sin(a) * (rr - 1), x + Math.cos(b2) * (rr - 2), y + Math.sin(b2) * (rr - 2)); }
      anello(t, c.k, x, y, rr * 0.35, rr * 0.35, 1); ovale(t, c.b, x, y, rr * 0.25, rr * 0.25);
    }
    cornice(t, c.b, 0, 0, t.w, t.h, 3); for (let x = 2; x < t.w; x += 6) { R(t, c.k, x, 1, 2, 1); R(t, c.k, x, t.h - 2, 2, 1); }
  },
  // campo da basket lucidato: listoni chiari, linee bianche (metà campo, cerchio, aree dipinte coi tiri liberi, archi da tre)
  parquet_tiro_libero: (t, c) => {
    assi(t, { x: 0, y: 0, w: t.w, h: t.h, larg: 3, min: 40, max: 80, toni: [c.a, c.a, P.sabbia], fuga: P.legno });
    const m = 6, cy = t.h / 2, rr = Math.round(t.h * 0.14), kw = Math.round(Math.min(t.w * 0.18, 48)), kh = Math.round(t.h * 0.34);
    ovale(t, c.b, t.w / 2, cy, rr, rr); anello(t, c.k, t.w / 2, cy, rr, rr, 1); ovale(t, P.arancio, t.w / 2, cy, rr * 0.45, rr * 0.45); linea(t, P.legnoScuro, t.w / 2 - rr * 0.45, cy, t.w / 2 + rr * 0.45, cy); linea(t, P.legnoScuro, t.w / 2, cy - rr * 0.45, t.w / 2, cy + rr * 0.45);
    R(t, c.k, t.w / 2, m, 1, t.h - 2 * m);
    for (const s of [0, 1]) {
      const x = s ? t.w - m - kw : m, fx = s ? t.w - m - kw : m + kw, t3 = Math.round(t.h * 0.42);
      t.g.save(); t.g.beginPath(); t.g.rect(s ? t.w / 2 : m + kw, 0, t.w / 2 - kw - m, t.h); t.g.clip(); anello(t, c.k, s ? t.w - m : m, cy, t3 + kw * 0.6, t3, 1); t.g.restore();
      R(t, c.b, x, cy - kh / 2, kw, kh); cornice(t, c.k, x, cy - kh / 2, kw, kh);
      anello(t, c.k, fx, cy, kh / 2 - 2, kh / 2 - 2, 1);
      R(t, c.k, s ? t.w - m - 3 : m + 2, cy - 6, 1, 12); anello(t, P.arancio, s ? t.w - m - 6 : m + 5, cy, 2.5, 2.5, 1);
    }
    cornice(t, c.k, m, m, t.w - 2 * m, t.h - 2 * m);
    R(t, c.b, 0, 0, t.w, m - 1); R(t, c.b, 0, t.h - m + 1, t.w, m - 1); R(t, c.b, 0, 0, m - 1, t.h); R(t, c.b, t.w - m + 1, 0, m - 1, t.h);
  },
  // tavole scure da teatro, la corsia di velluto rosso dalla porta al fondo coi gigli d'oro, colonnine d'ottone e cordoni ai lati
  corsia_velluto_rosso: (t, c) => {
    trasposta(t, (u) => assi(u, { x: 0, y: 0, w: u.w, h: u.h, larg: 6, min: 40, max: 80, toni: [c.a, c.a, P.legno], fuga: P.ombraCalda }));
    const lw = Math.round(Math.max(40, t.w * 0.26) / 2) * 2, x0 = t.w / 2 - lw / 2;
    R(t, P.ombraCalda, x0 + 2, 2, lw, t.h); R(t, c.b, x0, 0, lw, t.h);
    R(t, c.k, x0 + 2, 0, 2, t.h); R(t, c.k, x0 + lw - 4, 0, 2, t.h); R(t, P.rossoNeon, x0 + 6, 0, 1, t.h); R(t, P.rossoNeon, x0 + lw - 7, 0, 1, t.h);
    for (let y = 14; y < t.h - 8; y += 24) { rombo(t, c.k, t.w / 2, y, 4, 6); rombo(t, c.b, t.w / 2, y, 2, 3); R(t, c.k, t.w / 2 - 6, y, 3, 1); R(t, c.k, t.w / 2 + 4, y, 3, 1); }
    for (let x = x0 + 1; x < x0 + lw; x += 2) R(t, c.k, x, 0, 1, 3);
    const pali = quante(t.h - 30, 40) + 1;
    for (const px of [x0 - 8, x0 + lw + 8]) {
      const ys = Array.from({ length: pali }, (_, i) => 16 + (i * (t.h - 40)) / (pali - 1));
      ys.slice(1).forEach((y, i) => filo(t, P.rosso, px, ys[i]!, px, y, px < t.w / 2 ? -5 : 5, 2));
      for (const y of ys) { ovale(t, P.ombraCalda, px + 1, y + 2, 4, 3); ovale(t, c.k, px, y, 3.5, 3.5); ovale(t, P.sabbiaChiara, px - 1, y - 1, 1.5, 1.5); }
    }
  },
  // cracker salati in fila come lastre, coi buchini e il sale, un giro di grissini lungo i muri, i tondi al centro e uno morsicato
  lastricato_cracker_salati: (t, c) => {
    const B = 8; R(t, c.b, 0, 0, t.w, t.h);
    const n = quante(t.w - 2 * B, 26), m = quante(t.h - 2 * B, 26), sw = (t.w - 2 * B) / n, sh = (t.h - 2 * B) / m;
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const x = Math.round(B + i * sw + 1), y = Math.round(B + j * sh + 1), w = Math.round(sw - 2), h = Math.round(sh - 2);
      R(t, c.a, x, y, w, h); rilievo(t, P.sabbiaChiara, c.b, x, y, w, h);
      for (let q = 1; q <= 3; q++) for (let p = 1; p <= 3; p++) R(t, c.b, x + Math.round((p * w) / 4), y + Math.round((q * h) / 4), 1, 1);
      for (let s = 0; s < 3; s++) R(t, c.k, x + 2 + Math.floor(t.r.next() * (w - 4)), y + 2 + Math.floor(t.r.next() * (h - 4)), 1, 1);
    }
    const cx = t.w / 2, cy = t.h / 2;
    for (const dx of [-1, 1]) { const x = cx + dx * 13; for (let a = 0; a < 16; a++) ovale(t, P.legnoChiaro, x + Math.cos(a / 2.55) * 11, cy + Math.sin(a / 2.55) * 11, 2, 2); ovale(t, P.arancio, x, cy, 11, 11); ovale(t, P.legnoChiaro, x, cy, 7, 7); ovale(t, P.arancio, x, cy, 6, 6); for (const [px, py] of [[-3, -2], [2, -3], [0, 2], [3, 2]] as const) R(t, c.b, x + px, cy + py, 1, 1); }
    const bx = Math.round(B + sw * (n - 1) + 1), by = Math.round(B + 1); ovale(t, c.b, bx + sw - 2, by, 8, 8); for (const [dx, dy] of [[-12, 4], [-9, 9], [-14, 10]] as const) R(t, c.a, bx + sw + dx, by + dy, 2, 2);
    for (const [x, y, w, h] of [[0, 0, t.w, B], [0, t.h - B, t.w, B], [0, B, B, t.h - 2 * B], [t.w - B, B, B, t.h - 2 * B]] as const) {
      R(t, P.legno, x, y, w, h);
      if (w > h) for (let i = x; i < x + w; i += 40) { R(t, P.legnoChiaro, i + 1, y + 1, 38, h - 3); R(t, c.k, i + 3, y + 2, 34, 1); for (let s = i + 6; s < i + 36; s += 7) R(t, c.k, s, y + 4, 1, 1); }
      else for (let j = y; j < y + h; j += 40) { R(t, P.legnoChiaro, x + 1, j + 1, w - 3, 38); R(t, c.k, x + 2, j + 3, 1, 34); }
    }
  },
  // prato di cartone verde a strisce di tosaerba con le onde del cartone, bordo strappato, nastro adesivo sui giunti, aiuola ritagliata e una pozza
  prato_cartone_ondulato: (t, c) => {
    const n = quante(t.w, 40);
    for (let i = 0; i < n; i++) { const x = Math.round((i * t.w) / n), w = Math.round(((i + 1) * t.w) / n) - x; R(t, i % 2 ? P.erba : c.a, x, 0, w, t.h); for (let y = 2; y < t.h; y += 4) R(t, i % 2 ? P.erbaScura : P.erbaChiara, x, y, w, 1); }
    for (let y = 64; y < t.h - 16; y += 64) { retino(t, P.sabbia, 0, y - 3, t.w, 6); R(t, P.sabbia, 0, y - 3, t.w, 1); }
    for (let x = 0; x < t.w; x++) { const d = 5 + Math.round(Math.sin(x / 3.3) + Math.sin(x / 7.1)); R(t, c.b, x, 0, 1, d); R(t, c.b, x, t.h - d, 1, d); R(t, c.k, x, 2 + (x % 4 < 2 ? 0 : 1), 1, 1); }
    for (let y = 0; y < t.h; y++) { const d = 5 + Math.round(Math.sin(y / 3.1) + Math.sin(y / 6.7)); R(t, c.b, 0, y, d, 1); R(t, c.b, t.w - d, y, d, 1); }
    const fx = Math.round(t.w * 0.22), fy = Math.round(t.h * 0.3);
    ovale(t, P.legnoChiaro, fx, fy, 16, 9); ovale(t, P.legno, fx, fy + 1, 14, 7);
    for (const [dx, dy, col] of [[-8, -1, P.rosso], [0, -3, P.giallo], [7, 0, P.rosaNeon], [-3, 3, P.giallo], [5, 4, P.rosso]] as const) { R(t, P.erbaScura, fx + dx, fy + dy, 1, 4); rombo(t, col, fx + dx, fy + dy - 1, 2, 2); }
    const px = Math.round(t.w * 0.72), py = Math.round(t.h * 0.68); ovale(t, P.erbaScura, px, py, 13, 7); ovale(t, P.acqua, px, py, 10, 5); R(t, P.acquaBassa, px - 4, py - 2, 5, 1);
  },
  // piastrelle di giada lucida e, sotto lo smalto, il laghetto delle carpe: due koi che si rincorrono tra le ninfee; greca d'oro sul bordo
  piastrelle_giada_carpe: (t, c) => {
    const cx = t.w / 2, cy = t.h / 2, rr = Math.min(t.w, t.h) * 0.36;
    ovale(t, c.b, cx, cy, rr + 4, rr + 4); ovale(t, P.acqua, cx, cy, rr, rr); ovale(t, P.acquaProfonda, cx, cy, rr * 0.55, rr * 0.55);
    for (const s of [0, 1]) {
      const a0 = s * Math.PI, r = rr * 0.62, fondo = s ? P.pietraChiara : c.k, macchia = s ? P.rosso : P.pietraChiara, punto = (i: number) => [cx + Math.cos(a0 - i * 0.075) * r, cy + Math.sin(a0 - i * 0.075) * r] as const;
      const [ox, oy] = punto(16), [px, py] = punto(13), fa = a0 - 16 * 0.075 - Math.PI / 2;
      triangolo(t, fondo, px, py, ox + Math.cos(fa - 0.9) * 8, oy + Math.sin(fa - 0.9) * 8, ox + Math.cos(fa + 0.9) * 8, oy + Math.sin(fa + 0.9) * 8);
      for (const d of [-1, 1]) { const [fx, fy] = punto(4), na = a0 - 4 * 0.075; ovale(t, fondo, fx + Math.cos(na) * d * 6, fy + Math.sin(na) * d * 6, 2.5, 2.5); }
      for (let i = 14; i >= 0; i--) { const [x, y] = punto(i), w = i < 3 ? 4 + i * 0.5 : Math.max(1.5, 5.5 - (i - 3) * 0.35); ovale(t, (i > 4 && i < 8) || (i > 10 && i < 13) ? macchia : fondo, x, y, w, w); }
      const [hx, hy] = punto(0), na = a0 + Math.PI / 2; for (const d of [-1, 1]) R(t, P.neroCaldo, hx + Math.cos(a0) * d * 2.5 + Math.cos(na) * 1.5, hy + Math.sin(a0) * d * 2.5 + Math.sin(na) * 1.5, 1, 1);
    }
    for (const [fx, fy, r] of [[0.68, 0.3, 6], [0.28, 0.66, 5], [0.62, 0.74, 4]] as const) { const x = cx + (fx - 0.5) * rr * 2, y = cy + (fy - 0.5) * rr * 2; ovale(t, P.erbaScura, x, y, r, r * 0.8); triangolo(t, P.acqua, x, y, x + r, y - 2, x + r, y + 2); if (r > 5) ovale(t, P.rosaNeon, x - 2, y - 1, 2, 2); }
    for (let x = 0; x < t.w; x += 16) R(t, c.b, x, 0, 1, t.h);
    for (let y = 0; y < t.h; y += 16) R(t, c.b, 0, y, t.w, 1);
    for (let y = 16, k = 0; y < t.h - 16; y += 16) for (let x = 16; x < t.w - 16; x += 16, k++) if (k % 5 === 2) linea(t, P.pietraChiara, x + 3, y + 6, x + 6, y + 3);
    R(t, c.b, 0, 0, t.w, 10); R(t, c.b, 0, t.h - 10, t.w, 10); R(t, c.b, 0, 0, 10, t.h); R(t, c.b, t.w - 10, 0, 10, t.h);
    greca(t, c.k, 10, 1, t.w - 20, 8); greca(t, c.k, 10, t.h - 9, t.w - 20, 8);
    trasposta(t, (u) => { greca(u, c.k, 10, 1, u.w - 20, 8); greca(u, c.k, 10, u.h - 9, u.w - 20, 8); });
  },
  // area benessere: bordo di ciottoli, la vasca termale con i cerchi dell'acqua, una passerella di legno dalla porta al fondo, la paperella
  acqua_termale_ciottoli: (t, c) => {
    const B = 18; R(t, P.roccia, 0, 0, t.w, t.h);
    for (let y = 2; y < t.h; y += 5) for (let x = (y % 10) ? 4 : 1; x < t.w; x += 6) { const r = 2 + t.r.next() * 1.8, col = pesca(t, [c.b, P.pietra, P.pietraChiara, P.pietraScura]); ovale(t, P.roccia, x + 1, y + 1, r, r * 0.8); ovale(t, col, x, y, r, r * 0.8); }
    const x0 = B, y0 = B, w = t.w - 2 * B, h = t.h - 2 * B, rr = 10;
    const vasca = (col: string, d: number) => {
      R(t, col, x0 - d, y0 + rr, w + 2 * d, h - 2 * rr); R(t, col, x0 + rr, y0 - d, w - 2 * rr, h + 2 * d);
      for (const [qx, qy] of [[x0 + rr, y0 + rr], [x0 + w - rr, y0 + rr], [x0 + rr, y0 + h - rr], [x0 + w - rr, y0 + h - rr]] as const) ovale(t, col, qx, qy, rr + d, rr + d);
    };
    vasca(P.roccia, 2); vasca(c.a, 0);
    bande(t, [c.a, P.acquaProfonda], x0 + 6, y0 + 6, w - 12, y0 + 10);
    for (let n = quante(w * h, 2500) + 1; n > 0; n--) { const x = x0 + 14 + t.r.next() * (w - 28), y = y0 + 12 + t.r.next() * (h - 24); anello(t, P.acquaBassa, x, y, 7, 4, 1); anello(t, P.acquaBassa, x, y, 3, 2, 1); }
    const pw = 16, px = Math.round(t.w / 2 - pw / 2);
    R(t, P.ombraCalda, px + 2, y0 - 2, pw, t.h - y0 + 2); for (let y = t.h - 4; y > y0 - 4; y -= 5) { R(t, c.k, px, y, pw, 4); R(t, P.legno, px, y + 3, pw, 1); }
    const dx = Math.round(x0 + w * 0.25), dy = Math.round(y0 + h * 0.6); ovale(t, P.giallo, dx, dy, 4, 3); ovale(t, P.giallo, dx + 3, dy - 3, 2.5, 2.5); R(t, P.arancio, dx + 5, dy - 3, 2, 1); R(t, P.neroCaldo, dx + 3, dy - 4, 1, 1);
  },
  // grigliato da laboratorio: pannelli a barre imbullonati, strisce di pericolo lungo i muri, al centro il cerchio di contenimento (e cosa è scappato)
  griglia_contenimento: (t, c) => {
    const L = 32;
    for (let y = 0; y < t.h; y += L) for (let x = 0; x < t.w; x += L) {
      for (let s = 2; s < L - 1; s += 3) if (((x + y) / L) % 2) R(t, P.neroCaldo, x + 2, y + s, L - 4, 1); else R(t, P.neroCaldo, x + s, y + 2, 1, L - 4);
      cornice(t, P.pietraScura, x, y, L, L, 2); rilievo(t, P.pietra, P.neroCaldo, x, y, L, L);
      for (const [dx, dy] of [[3, 3], [L - 4, 3], [3, L - 4], [L - 4, L - 4]] as const) R(t, P.pietra, x + dx, y + dy, 1, 1);
    }
    pericolo(t, 6, c.b, P.neroCaldo);
    const cx = t.w / 2, cy = t.h / 2, rr = Math.min(t.w, t.h) * 0.24;
    ovale(t, P.neroCaldo, cx, cy, rr + 3, rr + 3); anello(t, c.k, cx, cy, rr, rr, 2); anello(t, c.b, cx, cy, rr - 5, rr - 5, 1);
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; R(t, c.b, cx + Math.cos(a) * (rr - 8) - 1, cy + Math.sin(a) * (rr - 8) - 1, 3, 3); }
    triangolo(t, c.b, cx - 9, cy + 6, cx + 9, cy + 6, cx, cy - 10); triangolo(t, P.neroCaldo, cx - 5, cy + 4, cx + 5, cy + 4, cx, cy - 5); R(t, c.b, cx - 0.5, cy - 2, 1, 3); R(t, c.b, cx - 0.5, cy + 2, 1, 1);
    for (const [a, d, r] of [[0.3, 1.25, 5], [2.4, 1.4, 4], [4.1, 1.2, 6], [5.3, 1.6, 3]] as const) { const x = cx + Math.cos(a) * rr * d, y = cy + Math.sin(a) * rr * d * 0.8; ovale(t, c.k, x, y, r, r * 0.7); ovale(t, c.k, x + r, y + 2, r * 0.4, r * 0.4); R(t, P.erbaChiara, x - 1, y - 1, 2, 1); }
  },
};
