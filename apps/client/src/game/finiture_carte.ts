// Carte da parati extra (stile classico / nordico / realistico, set 19-28)
import { P } from '../render/island_parts.ts';

const px = (g: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const fill = (g: CanvasRenderingContext2D, col: string) => { g.fillStyle = col; g.fillRect(0, 0, 32, 32); };

export function dipingiCartaExtra(motivo: string, g: CanvasRenderingContext2D, col: string[]): boolean {
  const [a = P.pietraChiara, b = P.pietra, k = P.pietraScura] = col;

  if (motivo === 'parete_salvia_boiserie') {
    fill(g, a); // verde salvia metà superiore
    px(g, b, 0, 16, 32, 16); // boiserie bianca laccata metà inferiore
    px(g, k, 0, 15, 32, 2); // listello separatore
    for (let x = 0; x < 32; x += 4) px(g, k, x, 17, 1, 15); // scanalature verticali
    return true;
  }

  if (motivo === 'mattoni_vista_stuccati') {
    fill(g, a); // mattone rosso terracotta
    for (let y = 0; y < 32; y += 6) {
      px(g, k, 0, y, 32, 1); const off = (y / 6) % 2 ? 8 : 0;
      for (let x = off; x < 32; x += 16) px(g, k, x, y, 1, 6);
    }
    // passate irregolari intonaco bianco gessoso (effetto shabby)
    px(g, b, 4, 8, 14, 8); px(g, b, 2, 10, 18, 4); px(g, b, 16, 20, 12, 6);
    return true;
  }

  if (motivo === 'intonaco_caldo_maioliche') {
    fill(g, a); // intonaco crema caldo
    // fascia decorativa di maioliche a metà altezza (y da 12 a 20)
    px(g, P.pietraChiara, 0, 12, 32, 8);
    for (let x = 0; x < 32; x += 8) {
      px(g, b, x + 1, 13, 6, 6); px(g, k, x + 3, 15, 2, 2); // rombi blu cobalto e giallo
      px(g, P.pietraScura, x, 12, 1, 8);
    }
    px(g, P.legnoChiaro, 0, 11, 32, 1); px(g, P.legnoChiaro, 0, 20, 32, 1);
    return true;
  }

  if (motivo === 'carta_botanica_tenue') {
    fill(g, a); // avorio
    // ramoscelli d'ulivo ed eucalipto stilizzati
    for (let y = 0; y < 24; y += 12) for (let x = 0; x < 32; x += 16) {
      const off = y === 0 ? 0 : 8;
      px(g, b, x + off + 3, y + 2, 1, 8);
      px(g, b, x + off + 1, y + 4, 2, 1); px(g, k, x + off + 4, y + 6, 2, 1);
      px(g, k, x + off + 1, y + 8, 2, 1);
    }
    px(g, P.pietraChiara, 0, 26, 32, 6); px(g, P.pietra, 0, 26, 32, 1); // battiscopa
    return true;
  }

  if (motivo === 'perline_abete_naturale') {
    fill(g, a); // abete chiaro / miele
    for (let x = 0; x < 32; x += 4) { px(g, k, x, 0, 1, 32); px(g, b, x + 1, 0, 1, 32); }
    px(g, k, 6, 12, 2, 3); px(g, k, 18, 22, 2, 3); px(g, k, 26, 6, 2, 2); // nodi
    return true;
  }

  if (motivo === 'parete_cornici_gesso') {
    fill(g, a); // tortora chiaro opaco
    // cornici rettangolari in rilievo di gesso bianco
    for (const cx of [2, 18]) {
      px(g, b, cx, 4, 12, 18); px(g, a, cx + 1, 5, 10, 16);
      px(g, k, cx + 11, 5, 1, 16); px(g, k, cx + 1, 20, 10, 1);
    }
    px(g, b, 0, 26, 32, 6); px(g, k, 0, 26, 32, 1); // battiscopa
    return true;
  }

  if (motivo === 'parete_shoji_carta_riso') {
    fill(g, a); // carta di riso bianca semitrasparente
    for (let y = 0; y < 26; y += 6) px(g, b, 0, y, 32, 1);
    for (let x = 0; x < 32; x += 8) px(g, b, x, 0, 1, 26);
    px(g, k, 0, 26, 32, 6); px(g, b, 0, 25, 32, 1); // zoccolo intonaco sabbia
    return true;
  }

  if (motivo === 'carta_righe_mogano') {
    fill(g, a); // verde bosco
    for (let x = 0; x < 32; x += 8) px(g, b, x, 0, 4, 18);
    // boiserie inferiore mogano scuro lucido
    px(g, k, 0, 18, 32, 14); px(g, P.legno, 0, 18, 32, 2);
    for (let x = 0; x < 32; x += 16) { px(g, P.ombraCalda, x, 20, 1, 12); px(g, P.legno, x + 2, 21, 12, 10); }
    return true;
  }

  if (motivo === 'piastrelle_diamantate_bianche') {
    fill(g, b); // azzurro carta da zucchero
    px(g, a, 0, 14, 32, 18);
    for (let y = 14; y < 32; y += 6) {
      const off = (y / 6) % 2 ? 8 : 0;
      px(g, k, 0, y, 32, 1);
      for (let x = off; x < 32; x += 16) { px(g, k, x, y, 1, 6); px(g, P.pietraChiara, x + 2, y + 2, 12, 2); }
    }
    return true;
  }

  if (motivo === 'muretto_pietra_vetrate') {
    fill(g, a); // base pietra calcarea
    px(g, P.acquaBassa, 0, 0, 32, 18); // vetro
    px(g, k, 0, 8, 32, 10); // siepe fuori
    px(g, b, 0, 0, 32, 2); px(g, b, 0, 17, 32, 2); px(g, b, 0, 0, 2, 18); px(g, b, 15, 0, 2, 18); px(g, b, 30, 0, 2, 18);
    for (let y = 19; y < 32; y += 4) { px(g, P.pietra, 0, y, 32, 1); const off = (y / 4) % 2 ? 6 : 0; px(g, P.pietra, off, y, 1, 4); px(g, P.pietra, (off + 12) % 32, y, 1, 4); }
    return true;
  }

  return false;
}
