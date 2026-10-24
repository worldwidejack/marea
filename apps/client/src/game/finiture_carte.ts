// Le carte da parati classiche disegnate intere (finiture_disegni.ts): una parete per volta, 32 texel/m (una parete di 3,2 m è alta 102),
// in basso 8 texel li copre il battiscopa. I motivi a passo fisso partono dal giro delle tre pareti (`inizio`) e girano l'angolo senza
// salti; pannelli, oblò, finestre e torce si distribuiscono pari sulla lunghezza (`posti`), così stanno bene anche quando la casa cresce.
import { P, R, TEX_MURO, anello, centri, assi, cornice, filo, inizio, lastre, linea, ovale, pannelli, pesca, posti, quante, retino, rilievo, rombo, stella, triangolo, type DisegnoMuro, type Muro, type Tela } from './finiture_kit.ts';

/** Ornamento da damasco centrato in (cx, cy), alto circa 2·s: rombo al centro, volute ai lati, foglia sopra, gambo sotto. */
export function damasco(t: Tela, col: string, cx: number, cy: number, s: number): void {
  rombo(t, col, cx, cy, s * 0.35, s * 0.55); triangolo(t, col, cx - s * 0.25, cy - s * 0.5, cx + s * 0.25, cy - s * 0.5, cx, cy - s);
  for (const d of [-1, 1]) { ovale(t, col, cx + d * s * 0.55, cy - s * 0.15, s * 0.22, s * 0.3); ovale(t, col, cx + d * s * 0.7, cy + s * 0.35, s * 0.15, s * 0.15); linea(t, col, cx + d * s * 0.2, cy + s * 0.4, cx + d * s * 0.6, cy + s * 0.75); }
  R(t, col, cx - 0.5, cy + s * 0.5, 1, s * 0.5);
}
/** Cornice di stucco in alto (a gradini) larga h. */
function cimasa(t: Tela, h: number, base: string, luce: string, ombra: string): void {
  R(t, base, 0, 0, t.w, h); R(t, luce, 0, h - 3, t.w, 1); R(t, ombra, 0, h - 1, t.w, 1); R(t, ombra, 0, Math.round(h / 3), t.w, 1);
}
/** Pietre a corsi irregolari tra y0 e y1 (le più grosse in basso). */
function pietre(t: Tela, s: Muro, y0: number, y1: number, toni: readonly string[], malta: string, luce: string): void {
  R(t, malta, 0, y0, t.w, y1 - y0);
  for (let y = y1; y > y0;) {
    const hh = Math.min(y - y0, 8 + Math.floor(t.r.next() * 6) + (y > y1 - 30 ? 3 : 0));
    for (let x = inizio(s, 7) - Math.floor(t.r.next() * 20); x < t.w;) {
      const l = 14 + Math.floor(t.r.next() * 22), col = pesca(t, toni);
      R(t, col, x + 1, y - hh + 1, l - 2, hh - 2); R(t, luce, x + 2, y - hh + 1, l - 4, 1); R(t, malta, x + l - 3, y - 3, 1, 1);
      x += l;
    }
    y -= hh;
  }
}

export const CARTE: Record<string, DisegnoMuro> = {
  // arlecchino a rombi verdi col filo d'oro agli incroci, fregio in alto, boiserie verde scuro sotto il corrimano
  rombi: (t, c, s) => {
    const y1 = t.h - 34;
    for (let y = 0; y < y1 + 12; y += 24) for (let x = inizio(s, 16); x < t.w + 16; x += 16) { rombo(t, c.b, x, y, 8, 12); rombo(t, c.k, x, y - 12, 1.5, 1.5); rombo(t, c.k, x + 8, y, 1.5, 1.5); }
    R(t, c.b, 0, 0, t.w, 9); for (let x = inizio(s, 8); x < t.w; x += 8) ovale(t, c.a, x + 4, 9, 3, 2.5); R(t, c.k, 0, 8, t.w, 1);
    R(t, c.b, 0, y1, t.w, t.h - y1); pannelli(t, s, y1 + 6, t.h - 12, 1.6, c.a, P.boscoOmbra);
    R(t, c.k, 0, y1, t.w, 2); R(t, P.legno, 0, y1 + 2, t.w, 1);
  },
  // righe bianche e azzurre, cima intrecciata in alto, zoccolo blu notte con l'onda, oblò d'ottone col mare (in fondo, il salvagente)
  righe: (t, c, s) => {
    for (let x = inizio(s, 24); x < t.w; x += 24) R(t, c.k, x, 0, 12, t.h);
    for (let x = inizio(s, 24) + 12; x < t.w; x += 24) R(t, c.b, x, 0, 2, t.h);
    R(t, P.legnoChiaro, 0, 2, t.w, 6); for (let x = inizio(s, 4); x < t.w; x += 4) linea(t, P.legno, x, 7, x + 3, 2);
    const z = t.h - 30; R(t, P.acquaProfonda, 0, z, t.w, t.h - z); R(t, c.k, 0, z, t.w, 2);
    for (let x = 0; x < t.w; x++) R(t, P.acqua, x, z + 10 + Math.round(Math.sin((x + inizio(s, 1000)) / 5) * 2), 1, 2);
    const ps = posti(s, 3.4), mezzo = s.lato === 'fondo' ? Math.floor(ps.length / 2) : -1;
    ps.forEach((x, i) => {
      const y = t.h * 0.42;
      if (i === mezzo) { filo(t, P.legnoChiaro, x - 18, y - 14, x + 18, y - 14, -12, 1); anello(t, P.roccia, x, y, 15, 15, 1); anello(t, P.pietraChiara, x, y, 14, 14, 6); anello(t, P.roccia, x, y, 8, 8, 1); for (const a of [0.4, 2, 3.6, 5.2]) ovale(t, P.rosso, x + Math.cos(a) * 11, y + Math.sin(a) * 11, 3.5, 3.5); return; }
      ovale(t, P.arancio, x, y, 13, 13); ovale(t, P.legno, x + 1, y + 1, 10, 10); ovale(t, P.acquaBassa, x, y, 9, 9); R(t, P.acqua, x - 9, y + 1, 18, 8); ovale(t, P.arancio, x, y, 9, 9);
      t.g.save(); t.g.beginPath(); t.g.arc(Math.round(x), Math.round(y), 8.5, 0, Math.PI * 2); t.g.clip();
      R(t, P.acquaBassa, x - 9, y - 9, 18, 10); R(t, P.acqua, x - 9, y + 1, 18, 9); R(t, P.pietraChiara, x - 9, y, 18, 1); triangolo(t, P.pietraChiara, x + 1, y - 1, x + 5, y - 1, x + 3, y - 7); R(t, P.legno, x, y - 1, 6, 1);
      t.g.restore();
      for (const a of [0, 1.57, 3.14, 4.71]) R(t, P.legnoScuro, x + Math.cos(a) * 11 - 0.5, y + Math.sin(a) * 11 - 0.5, 1, 1);
    });
  },
  // muro di pietra a corsi irregolari (le più grosse giù), cantonali chiari agli spigoli, trave in alto
  mattoni: (t, c, s) => {
    pietre(t, s, 6, t.h, [c.a, c.a, P.pietraScura, c.k], c.b, c.k);
    for (const x of [s.x0, s.x1 - 22]) for (let y = 6, i = 0; y < t.h; y += 14, i++) { const w = i % 2 ? 14 : 22, xx = x === s.x0 ? x : s.x1 - w; R(t, c.k, xx, y, w, 13); R(t, P.pietraChiara, xx + 1, y + 1, w - 2, 1); R(t, c.b, xx, y + 13, w, 1); }
    R(t, P.legnoScuro, 0, 0, t.w, 6); R(t, P.legno, 0, 0, t.w, 1); R(t, P.ombraCalda, 0, 6, t.w, 1);
  },
  // doghe verticali di legno di larghezze diverse con i nodi, mantovana intagliata in alto e un corrimano
  perline: (t, c, s) => {
    for (let x = inizio(s, 64) - 64; x < t.w;) {
      const w = pesca(t, [8, 10, 12]), col = pesca(t, [c.a, c.a, c.b]);
      R(t, col, x, 0, w, t.h); R(t, c.k, x + w - 1, 0, 1, t.h); R(t, col === c.a ? P.sabbia : c.a, x, 0, 1, t.h);
      if (t.r.next() < 0.35) { const ny = 20 + t.r.next() * 60; ovale(t, c.k, x + w / 2, ny, 1.5, 2); }
      x += w;
    }
    R(t, c.k, 0, 0, t.w, 10); for (let x = inizio(s, 10); x < t.w; x += 10) { triangolo(t, c.k, x, 10, x + 10, 10, x + 5, 15); R(t, c.a, x + 4, 4, 2, 2); }
    R(t, c.b, 0, t.h - 36, t.w, 3); R(t, P.sabbia, 0, t.h - 36, t.w, 1); R(t, c.k, 0, t.h - 33, t.w, 1);
  },
  // damasco giallo canarino a mezza goccia, merletto bianco in alto e sopra la boiserie bianca
  damasco_canarino_pizzo: (t, c, s) => {
    const y1 = t.h - 36;
    for (let y = 22, j = 0; y < y1; y += 24, j++) for (let x = inizio(s, 32) + (j % 2 ? 16 : 0); x < t.w + 16; x += 32) damasco(t, P.arancio, x, y, 9);
    const pizzo = (y: number, giu: boolean) => { R(t, c.k, 0, giu ? y : y - 4, t.w, 4); for (let x = inizio(s, 8); x < t.w; x += 8) { ovale(t, c.k, x + 4, y + (giu ? 4 : -4), 4, 3); R(t, c.a, x + 3, y + (giu ? 4 : -5), 2, 1); R(t, P.pietraChiara, x + 4, giu ? y + 1 : y - 2, 1, 1); } };
    R(t, c.b, 0, y1, t.w, t.h - y1); pannelli(t, s, y1 + 6, t.h - 12, 1.5, P.pietraChiara, P.pietra);
    pizzo(0, true); pizzo(y1, false); R(t, P.pietra, 0, y1, t.w, 1);
  },
  // verde salvia sopra, boiserie bianca laccata sotto, cornici alte allineate ai pannelli, cimasa di stucco
  parete_salvia_boiserie: (t, c, s) => {
    const y1 = Math.round(t.h * 0.55);
    cimasa(t, 8, c.b, P.pietraChiara, c.k);
    const n = posti(s, 1.6), w = (s.x1 - s.x0) / n.length;
    for (const x of n) cornice(t, P.erbaChiara, x - w / 2 + 8, 14, w - 16, y1 - 22);
    R(t, c.b, 0, y1, t.w, t.h - y1); pannelli(t, s, y1 + 8, t.h - 12, 1.6, P.pietraChiara, c.k);
    R(t, P.pietraChiara, 0, y1, t.w, 3); R(t, c.k, 0, y1 + 3, t.w, 1);
  },
  // mattoni a vista a corsi sfalsati, con grandi passate di intonaco bianco qua e là da cui i mattoni affiorano
  mattoni_vista_stuccati: (t, c, s) => {
    R(t, P.pietra, 0, 0, t.w, t.h);
    for (let y = 0, j = 0; y < t.h; y += 6, j++) for (let x = inizio(s, 16) + (j % 2 ? 8 : 0) - 16; x < t.w; x += 16) { const col = pesca(t, [c.a, c.a, P.legnoChiaro, c.k]); R(t, col, x, y, 15, 5); R(t, col === c.k ? c.a : P.legnoChiaro, x, y, 15, 1); }
    for (let n = Math.max(1, Math.round((s.x1 - s.x0) / 140)); n > 0; n--) {
      const x = s.x0 + 20 + t.r.next() * (s.x1 - s.x0 - 40), y = 18 + t.r.next() * (t.h - 50);
      for (let i = 0; i < 9; i++) { const ox = x + (t.r.next() - 0.5) * 60, oy = y + (t.r.next() - 0.5) * 16, rx = 10 + t.r.next() * 12, ry = 4 + t.r.next() * 4; ovale(t, P.pietra, ox, oy + 1, rx, ry); ovale(t, c.b, ox, oy, rx, ry); }
    }
  },
  // intonaco caldo, fascia di maioliche blu e gialle a metà, e in fondo il pannello coi limoni sopra la fascia; zoccolo di cotto
  intonaco_caldo_maioliche: (t, c, s) => {
    const z0 = t.h - 46, L = 16;
    const piastrella = (x: number, y: number) => { R(t, P.pietraChiara, x, y, L, L); for (const [dx, dy] of [[0, 0], [L, 0], [0, L], [L, L]] as const) ovale(t, c.b, x + dx, y + dy, 4, 4); rombo(t, c.b, x + L / 2, y + L / 2, 5, 5); rombo(t, c.k, x + L / 2, y + L / 2, 2, 2); cornice(t, P.pietra, x, y, L + 1, L + 1); };
    for (let x = inizio(s, L); x < t.w; x += L) { piastrella(x, z0); piastrella(x, z0 + L); }
    R(t, P.legnoChiaro, 0, z0 - 2, t.w, 2); R(t, P.legnoChiaro, 0, z0 + 2 * L, t.w, 2);
    R(t, P.arancio, 0, z0 + 2 * L + 2, t.w, t.h - z0 - 2 * L - 2); for (let x = inizio(s, 20); x < t.w; x += 20) R(t, P.legnoChiaro, x, z0 + 2 * L + 2, 1, t.h);
    if (s.lato === 'fondo') {
      const cx = (s.x0 + s.x1) / 2, w = 64, y = z0 - 42;
      R(t, P.pietraChiara, cx - w / 2, y, w, 40); cornice(t, c.b, cx - w / 2, y, w, 40, 2);
      linea(t, P.legno, cx - 18, y + 30, cx + 16, y + 10, 2);
      for (const [dx, dy] of [[-12, 14], [6, 22], [14, 8], [-2, 6]] as const) { ovale(t, P.erbaScura, cx + dx - 4, y + dy - 3, 4, 2); ovale(t, c.k, cx + dx, y + dy, 4, 3); R(t, P.pietraChiara, cx + dx - 1, y + dy - 2, 1, 1); }
    }
  },
  // carta avorio coi rametti d'ulivo e d'eucalipto a mezza goccia, e un rampicante che sale dagli angoli
  carta_botanica_tenue: (t, c, s) => {
    const rametto = (x: number, y: number, eu: boolean) => {
      linea(t, P.legno, x, y + 9, x + 2, y - 9);
      for (let i = -2; i <= 2; i++) { const yy = y + i * 4, xx = x + 1 - i * 0.25; if (eu) { ovale(t, c.k, xx - 3, yy, 2, 2); ovale(t, c.k, xx + 3, yy - 1, 2, 2); } else { ovale(t, c.b, xx - 3, yy - 1, 2.5, 1); ovale(t, P.erba, xx + 3, yy, 2.5, 1); } }
    };
    for (let y = 16, j = 0; y < t.h - 16; y += 28, j++) for (let x = inizio(s, 36) + (j % 2 ? 18 : 0); x < t.w + 18; x += 36) rametto(x, y, (x + y + j) % 3 === 0);
    for (const [x0, d] of [[s.x0 + 6, 1], [s.x1 - 6, -1]] as const) {
      let x = x0, y = t.h - 8;
      for (let i = 0; i < 26; i++) { const nx = x + d * Math.sin(i / 3) * 3, ny = y - 3.2; linea(t, P.bosco, x, y, nx, ny); if (i % 3 === 0) ovale(t, i % 2 ? c.b : P.erba, nx + d * 4, ny, 3, 2); x = nx; y = ny; }
    }
    R(t, P.sabbia, 0, 0, t.w, 2); R(t, c.b, 0, 3, t.w, 1);
  },
  // baita: perline orizzontali d'abete coi nodi, pali tondi agli spigoli, trave in alto
  perline_abete_naturale: (t, c, s) => {
    assi(t, { x: 0, y: 8, w: t.w, h: t.h - 8, larg: 7, min: 60, max: 160, toni: [c.a, c.a, c.b], fuga: c.k, vena: c.k });
    for (let n = Math.round(t.w / 50); n > 0; n--) { const x = t.r.next() * t.w, y = 12 + 7 * Math.floor(t.r.next() * 12); ovale(t, c.k, x, y + 3, 2.5, 2); anello(t, P.legno, x, y + 3, 3.5, 2.5, 1); }
    for (const x of [s.x0, s.x1 - 10]) { R(t, P.legno, x, 0, 10, t.h); R(t, c.a, x + 2, 0, 2, t.h); R(t, c.k, x + 9, 0, 1, t.h); for (let y = 14; y < t.h; y += 22) R(t, c.k, x + 1, y, 8, 1); }
    R(t, P.legno, 0, 0, t.w, 8); R(t, c.a, 0, 1, t.w, 1); R(t, c.k, 0, 7, t.w, 1);
  },
  // stucco grigio perla con cornici di gesso bianco: grandi riquadri sopra, piccoli sotto il corrimano; in fondo un medaglione ovale al centro
  parete_cornici_gesso: (t, c, s) => {
    cimasa(t, 10, c.b, P.pietraChiara, c.k);
    const y1 = t.h - 34, n = centri(s.x0, s.x1, quante((s.x1 - s.x0) / TEX_MURO, 1.8) | 1), w = (s.x1 - s.x0) / n.length, mezzo = s.lato === 'fondo' ? (n.length - 1) / 2 : -1;
    n.forEach((x, i) => {
      if (i === mezzo) { anello(t, c.b, x, (14 + y1 - 6) / 2, w / 2 - 10, (y1 - 26) / 2, 2); anello(t, c.k, x, (14 + y1 - 6) / 2 + 1, w / 2 - 13, (y1 - 26) / 2 - 3, 1); stella(t, c.b, x, (14 + y1 - 6) / 2, 6, 2, 8); }
      else { rilievo(t, c.b, c.k, x - w / 2 + 8, 16, w - 16, y1 - 24, 2); rilievo(t, c.k, c.b, x - w / 2 + 12, 20, w - 24, y1 - 32); }
      rilievo(t, c.b, c.k, x - w / 2 + 8, y1 + 6, w - 16, t.h - y1 - 18);
    });
    R(t, c.b, 0, y1, t.w, 3); R(t, c.k, 0, y1 + 3, t.w, 1);
  },
  // shoji: telai di legno a pannelli scorrevoli, la griglia kumiko sulla carta di riso, zoccolo pieno, sopraluce traforato; l'ombra di un bambù
  parete_shoji_carta_riso: (t, c, s) => {
    const n = posti(s, 1.8), w = (s.x1 - s.x0) / n.length, y0 = 18, y1 = t.h - 22;
    R(t, P.legno, 0, 0, t.w, 18); for (let x = inizio(s, 12); x < t.w; x += 12) { ovale(t, c.k, x + 6, 9, 4, 3); ovale(t, P.legno, x + 6, 10, 3, 2); }
    R(t, c.b, 0, y1, t.w, t.h - y1); R(t, P.legno, 0, y1, t.w, 2);
    if (s.lato === 'fondo') { const bx = (s.x0 + s.x1) / 2 + w * 0.3; for (let i = 0; i < 5; i++) { R(t, c.k, bx + i, y0 + i * 16, 3, 15); R(t, c.a, bx + i, y0 + i * 16 + 15, 3, 1); } for (const [dx, dy, d] of [[3, 20, 1], [5, 40, -1], [7, 56, 1], [2, 34, -1]] as const) triangolo(t, c.k, bx + dx, y0 + dy, bx + dx + d * 18, y0 + dy - 4, bx + dx + d * 16, y0 + dy + 1); }
    for (const cx of n) {
      const x0 = cx - w / 2;
      for (let x = x0 + 12; x < x0 + w - 4; x += 12) R(t, c.b, x, y0, 1, y1 - y0);
      for (let y = y0 + 14; y < y1; y += 14) R(t, c.b, x0, y, w, 1);
      R(t, P.legno, x0, y0, 3, y1 - y0); R(t, P.legno, x0 + w - 3, y0, 3, y1 - y0); R(t, P.legno, x0, y0, w, 2);
      R(t, P.legnoScuro, cx - 1, y1 - 30, 2, 8);
    }
  },
  // righe regency verdi e crema, boiserie di mogano coi pannelli in rilievo sotto il corrimano, cimasa scura
  carta_righe_mogano: (t, c, s) => {
    const y1 = t.h - 40;
    for (let x = inizio(s, 20); x < t.w; x += 20) { R(t, c.b, x, 0, 6, y1); R(t, P.bosco, x + 2, 0, 2, y1); R(t, P.boscoOmbra, x + 10, 0, 1, y1); }
    R(t, c.k, 0, 0, t.w, 7); R(t, P.legno, 0, 5, t.w, 1);
    R(t, c.k, 0, y1, t.w, t.h - y1); pannelli(t, s, y1 + 7, t.h - 12, 1.2, P.legno, P.ombraCalda, P.legnoScuro);
    R(t, P.legno, 0, y1, t.w, 4); R(t, P.legnoChiaro, 0, y1, t.w, 1); R(t, P.ombraCalda, 0, y1 + 4, t.w, 1);
  },
  // piastrelle diamantate bianche a correre fino al soffitto, una fascia d'azzurro a due terzi e una in basso
  piastrelle_diamantate_bianche: (t, c, s) => {
    for (let y = 0, j = 0; y < t.h; y += 8, j++) for (let x = inizio(s, 16) + (j % 2 ? 8 : 0) - 16; x < t.w; x += 16) {
      const fascia = y === 32 || y >= t.h - 24 && y < t.h - 16, col = fascia ? c.b : c.a;
      R(t, col, x, y, 16, 8); rilievo(t, fascia ? P.acquaBassa : P.sabbiaChiara, fascia ? P.acquaProfonda : c.k, x, y, 16, 8);
    }
    R(t, c.b, 0, 30, t.w, 1); R(t, c.b, 0, 41, t.w, 1);
  },
  // muretto di pietra fino al davanzale, sopra grandi vetrate di ferro verde sul giardino (il giardino continua da una parete all'altra)
  muretto_pietra_vetrate: (t, c, s) => {
    const y1 = t.h - 38, gx = inizio(s, 100000);
    const n = posti(s, 2.2), w = (s.x1 - s.x0) / n.length;
    for (let x = 0; x < t.w; x++) {
      const u = x - gx, coll = 34 + Math.round(Math.sin(u / 37) * 6 + Math.sin(u / 13) * 2), siepe = y1 - 14 + Math.round(Math.sin(u / 7) * 2);
      R(t, P.acquaBassa, x, 0, 1, coll); R(t, c.k, x, coll, 1, siepe - coll); R(t, P.bosco, x, siepe, 1, y1 - siepe);
      if ((u % 29 + 29) % 29 < 1) R(t, P.erbaScura, x, coll - 4, 1, siepe - coll + 4);
    }
    for (let x = gx; x < t.w; x += 1) { const u = x - gx; if (u % 60 === 20) { ovale(t, P.erbaScura, x, 30, 9, 8); ovale(t, c.k, x - 2, 28, 6, 5); R(t, P.legno, x, 36, 2, 10); } if (u % 23 === 5) { R(t, pesca(t, [P.rosso, P.giallo, P.rosaNeon, P.pietraChiara]), x, y1 - 12 + (u % 3), 2, 2); } }
    for (const cx of n) {
      R(t, c.a, cx - w / 2, 0, 6, y1); R(t, c.a, cx + w / 2 - 6, 0, 6, y1);
      cornice(t, c.b, cx - w / 2 + 6, 4, w - 12, y1 - 4, 2); R(t, c.b, cx - 1, 4, 2, y1 - 4); R(t, c.b, cx - w / 2 + 6, (y1 + 4) / 2, w - 12, 2);
      for (let k = 0; k < 2; k++) { const lx = cx - w / 2 + 12 + k * (w / 2 - 2); linea(t, P.pietraChiara, lx, 14, lx + 5, 9); }
    }
    R(t, c.a, 0, 0, t.w, 4);
    pietre(t, s, y1, t.h, [P.pietra, P.pietra, P.pietraScura, P.pietraChiara], P.roccia, P.pietraChiara);
    R(t, P.pietraChiara, 0, y1, t.w, 3); R(t, P.pietraScura, 0, y1 + 3, t.w, 1);
  },
  // pietra grezza, travi in alto, torce sui ferri con l'alone di luce; in fondo la bacheca delle missioni con il punto esclamativo
  pietra_grezza_torce: (t, c, s) => {
    lastre(t, 0, 10, t.w, t.h - 10, 8, 22, (x, y, w, h) => { const col = pesca(t, [c.a, c.a, P.roccia, P.pietraScura]); R(t, col, x, y, w, h); R(t, P.pietra, x + 1, y + 1, w - 3, 1); R(t, P.neroCaldo, x + w - 1, y, 1, h); R(t, P.neroCaldo, x, y + h - 1, w, 1); });
    R(t, c.b, 0, 0, t.w, 10); R(t, P.legno, 0, 1, t.w, 1); R(t, P.ombraCalda, 0, 9, t.w, 1); for (let x = inizio(s, 64) + 30; x < t.w; x += 64) { R(t, P.ombraCalda, x, 0, 1, 10); R(t, P.neroCaldo, x + 3, 4, 2, 2); }
    const ps = posti(s, 3), mezzo = s.lato === 'fondo' && ps.length >= 3 ? Math.floor(ps.length / 2) : -1;
    ps.forEach((x, i) => {
      const y = 46;
      if (i === mezzo) {
        R(t, c.b, x - 20, y - 22, 40, 34); cornice(t, P.ombraCalda, x - 20, y - 22, 40, 34, 2); R(t, P.sabbiaChiara, x - 14, y - 16, 14, 18); R(t, P.sabbia, x + 2, y - 12, 12, 14);
        for (let r = 0; r < 4; r++) R(t, P.legno, x - 12, y - 12 + r * 4, 10, 1);
        R(t, P.giallo, x - 2, y - 34, 4, 9); R(t, P.giallo, x - 2, y - 23, 4, 3); R(t, P.ombraCalda, x + 2, y - 34, 1, 9); R(t, P.ombraCalda, x + 2, y - 23, 1, 3); return;
      }
      for (const [r, f] of [[22, 0], [16, 1]] as const) { t.g.save(); t.g.beginPath(); t.g.ellipse(Math.round(x), y - 10, r, r, 0, 0, Math.PI * 2); t.g.clip(); retino(t, f ? P.arancio : P.legnoChiaro, x - r, y - 10 - r, 2 * r, 2 * r, f); t.g.restore(); }
      R(t, P.neroCaldo, x - 4, y + 8, 8, 2); R(t, P.neroCaldo, x - 1, y + 2, 2, 8); R(t, c.b, x - 2, y - 4, 4, 10); R(t, P.neroCaldo, x - 3, y - 6, 6, 3);
      ovale(t, P.rosso, x, y - 12, 4, 6); ovale(t, c.k, x, y - 11, 3, 4); ovale(t, P.giallo, x, y - 10, 1.5, 2); R(t, P.rosso, x - 1, y - 20, 2, 3);
    });
  },
};
