// Disegni procedurali delle carte da parati e pavimenti (finiture_disegni.ts)
// Motivi a pixel NearestFilter per pareti (16/32 texel/m) e pavimenti.
import type { StanzaFinitura } from '@marea/content';
import { P } from '../render/island_parts.ts';
import { dipingiPavimento } from './finiture_pavimenti.ts';
import { dipingiCartaExtra } from './finiture_carte.ts';

const px = (g: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const fill = (g: CanvasRenderingContext2D, col: string) => { g.fillStyle = col; g.fillRect(0, 0, 32, 32); };

function dipingiCarta(motivo: string, g: CanvasRenderingContext2D, col: string[]): boolean {
  const [a = P.pietraChiara, b = P.pietra, k = P.pietraScura] = col;

  if (motivo === 'muro_arcade_neon') {
    fill(g, a); // mattoni viola scuro / nero caldo
    for (let y = 0; y < 32; y += 4) { px(g, P.ombraCalda, 0, y, 32, 1); const off = (y / 4) % 2 ? 8 : 0; for (let x = off; x < 32; x += 16) px(g, P.ombraCalda, x, y, 1, 4); }
    // joystick neon (stick ciano, palla magenta/viola, base)
    px(g, b, 6, 8, 4, 4); px(g, k, 7, 12, 2, 4); px(g, P.rosaNeon, 5, 16, 6, 2);
    // pianeta con anelli
    px(g, b, 22, 6, 6, 6); px(g, k, 19, 9, 12, 1); px(g, k, 20, 8, 10, 1);
    // stelline neon ciano e giallo
    for (const [sx, sy] of [[14, 4], [4, 22], [26, 20], [16, 26]] as const) { px(g, k, sx, sy, 2, 2); px(g, P.giallo, sx, sy); }
    return true;
  }

  if (motivo === 'damasco_ectoplasmatico') {
    fill(g, a); // viola desaturato
    // motivo damascato verde acido
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      px(g, b, x + 4, y + 2, 8, 2); px(g, b, x + 2, y + 4, 12, 2); px(g, b, x + 6, y + 6, 4, 6);
      px(g, b, x + 4, y + 12, 8, 2);
      // fantasmini sorridenti nascosti che brillano al buio (occhietti e sorriso)
      px(g, P.pietraChiara, x + 6, y + 7, 4, 4);
      px(g, P.neroCaldo, x + 7, y + 8); px(g, P.neroCaldo, x + 9, y + 8); // occhi
      px(g, P.neroCaldo, x + 8, y + 10); // boccuccia sorridente
    }
    // asse di legno scrostata sul bordo
    px(g, k, 0, 0, 2, 32); px(g, P.legnoScuro, 0, 10, 2, 12);
    return true;
  }

  if (motivo === 'parete_policarbonato_viola') {
    fill(g, a); // viola atomic purple
    // piste dorate stile scheda
    for (let x = 4; x < 32; x += 8) { px(g, P.giallo, x, 0, 1, 14); px(g, P.giallo, x, 14, 6, 1); px(g, P.giallo, x + 5, 14, 1, 18); }
    // cavi colorati e microchip
    px(g, P.neroCaldo, 10, 18, 6, 6); px(g, P.pietra, 9, 19, 1, 4); px(g, P.pietra, 16, 19, 1, 4); // chip con piedini
    // piccoli LED accesi
    px(g, k, 8, 6, 2, 2); px(g, P.rosaNeon, 24, 22, 2, 2); px(g, P.verdeNeon, 18, 10, 2, 2);
    // riflesso lucido policarbonato
    px(g, b, 0, 0, 32, 2); px(g, b, 0, 0, 2, 32);
    return true;
  }

  if (motivo === 'muro_disperazione_organizzata') {
    fill(g, a); // intonaco bianco sporco
    // post-it gialli e rosa
    px(g, b, 4, 6, 7, 7); px(g, P.pietraScura, 5, 8, 5, 1); px(g, P.pietraScura, 5, 10, 4, 1); // post-it giallo con righe
    px(g, P.rosaNeon, 18, 4, 6, 6); px(g, P.pietraScura, 19, 6, 4, 1); // post-it rosa
    // calendario scarabocchiato
    px(g, P.pietraChiara, 18, 16, 10, 10); px(g, P.rosso, 18, 16, 10, 2);
    for (let r = 19; r < 25; r += 2) px(g, P.pietraScura, 19, r, 8, 1);
    // poster storto di videogioco
    px(g, P.acquaProfonda, 3, 18, 8, 11); px(g, P.arancio, 5, 20, 4, 4);
    // fili di lana rossa e puntine
    px(g, k, 7, 6, 2, 2); px(g, k, 21, 4, 2, 2); px(g, k, 22, 16, 2, 2); // puntine
    for (let i = 0; i < 14; i++) px(g, k, 8 + i, 6 + Math.floor(i * 0.7), 1, 1); // filo teso
    return true;
  }

  if (motivo === 'parete_bosco_spore') {
    fill(g, a); // foresta notturna / bosco ombra
    // tronchi d'albero con muschio
    px(g, P.legnoScuro, 0, 0, 6, 32); px(g, P.erbaScura, 5, 0, 2, 32);
    // funghi giganti bioluminescenti
    // fungo rosa
    px(g, P.pietraChiara, 12, 18, 2, 8); px(g, k, 8, 15, 10, 4); px(g, P.pietraChiara, 10, 16, 2, 1);
    // fungo azzurro
    px(g, P.pietraChiara, 23, 12, 2, 6); px(g, b, 20, 9, 8, 4); px(g, P.pietraChiara, 22, 10, 2, 1);
    // spore luminose fluttuanti
    for (const [sx, sy] of [[10, 6], [16, 2], [28, 18], [26, 4], [18, 28]] as const) px(g, b, sx, sy);
    return true;
  }

  if (motivo === 'vetrata_temporale_estivo') {
    fill(g, a); // crepuscolo piovoso blu scuro
    // infissi finestra in legno scuro
    px(g, b, 0, 0, 32, 2); px(g, b, 0, 30, 32, 2); px(g, b, 0, 0, 2, 32); px(g, b, 30, 0, 2, 32);
    px(g, b, 15, 0, 2, 32); px(g, b, 0, 15, 32, 2); // croce finestra
    // gocce d'acqua che colano sul vetro
    for (let x = 4; x < 28; x += 6) { px(g, P.acquaBassa, x, 6, 1, 3); px(g, P.acquaBassa, x + 2, 20, 1, 4); }
    // catena di lampadine calde appese in alto
    px(g, P.neroCaldo, 2, 4, 28, 1);
    for (let lx = 6; lx < 28; lx += 8) { px(g, k, lx, 5, 3, 3); px(g, P.giallo, lx + 1, 6, 1, 1); }
    return true;
  }

  if (motivo === 'muro_cialda_glassa') {
    fill(g, a); // cialda wafer
    // texture griglia wafer croccante nella metà bassa
    for (let y = 14; y < 32; y += 4) { px(g, P.legnoChiaro, 0, y, 32, 1); for (let x = 0; x < 32; x += 4) px(g, P.legnoChiaro, x, y, 1, 4); }
    // glassa rosa fragola colante dall'alto
    px(g, b, 0, 0, 32, 10);
    // gocce di glassa che colano
    for (const [dx, dh] of [[4, 6], [12, 9], [20, 5], [26, 8]] as const) { px(g, b, dx, 10, 4, dh); px(g, b, dx + 1, 10 + dh, 2, 2); }
    // codette arcobaleno
    const cod: readonly [number, number, string][] = [[6, 4, k], [16, 6, P.cianoNeon], [24, 3, P.verdeNeon], [10, 12, P.pietraChiara], [22, 11, k]];
    for (const [cx, cy, col] of cod) px(g, col, cx, cy, 2, 1);
    return true;
  }

  if (motivo === 'orizzonte_tropicale') {
    fill(g, a); // cielo tropicale / mare
    // cielo e nuvole bianche
    px(g, P.acquaBassa, 0, 0, 32, 12);
    px(g, P.pietraChiara, 6, 4, 8, 3); px(g, P.pietraChiara, 8, 2, 4, 2); // nuvola
    // mare turchese
    px(g, a, 0, 12, 32, 10);
    // spiaggia dorata in basso
    px(g, P.sabbia, 0, 22, 32, 10); px(g, P.pietraChiara, 0, 21, 32, 1); // risacca
    // palma piegata dal vento
    for (let i = 0; i < 10; i++) px(g, P.legno, 26 - Math.floor(i * 0.4), 28 - i, 2, 1);
    px(g, k, 18, 16, 8, 3); px(g, k, 16, 17, 10, 2); // chioma palma
    return true;
  }

  if (motivo === 'scheda_madre_32bit') {
    fill(g, a); // verde smeraldo PCB
    // piste di rame dorate
    for (let y = 4; y < 32; y += 6) { px(g, b, 0, y, 32, 1); px(g, b, (y * 3) % 32, y - 3, 1, 6); }
    // microchip neri stilizzati
    px(g, k, 6, 10, 8, 8); px(g, P.pietra, 5, 11, 1, 6); px(g, P.pietra, 14, 11, 1, 6);
    // condensatori cilindrici e cavo piatto
    px(g, P.cianoNeon, 20, 12, 4, 4); px(g, P.rosso, 26, 12, 3, 4);
    px(g, P.pietra, 18, 0, 6, 8); // ribbon cable
    return true;
  }

  if (motivo === 'muro_palestra_comunale') {
    fill(g, b); // cemento crema
    // finestroni opachi e tabellone spento
    px(g, k, 4, 3, 10, 6); px(g, P.pietraChiara, 5, 4, 8, 4);
    px(g, P.neroCaldo, 18, 3, 10, 5); // tabellone digitale spento
    // materassini imbottiti blu nella metà bassa
    px(g, a, 0, 16, 32, 16);
    for (let x = 0; x < 32; x += 8) px(g, P.abisso, x, 16, 1, 16);
    return true;
  }

  if (motivo === 'pietra_grezza_torce') {
    fill(g, a); // pietra grigia
    // blocchi irregolari di pietra
    for (let y = 0; y < 32; y += 8) { px(g, P.roccia, 0, y, 32, 1); const off = (y / 8) % 2 ? 10 : 0; px(g, P.roccia, off, y, 1, 8); px(g, P.roccia, (off + 16) % 32, y, 1, 8); }
    // trave di legno scuro in alto
    px(g, b, 0, 0, 32, 3);
    // torcia a muro con fiamma accogliente
    px(g, P.neroCaldo, 15, 14, 2, 8); px(g, k, 14, 10, 4, 4); px(g, P.giallo, 15, 11, 2, 2);
    return true;
  }

  if (motivo === 'damasco_canarino_pizzo') {
    fill(g, a); // giallo pastello
    // righe verticali beige alternate
    for (let x = 0; x < 32; x += 8) px(g, b, x, 0, 4, 32);
    // centrino di pizzo bianco in alto
    px(g, k, 0, 0, 32, 3);
    for (let x = 0; x < 32; x += 4) { px(g, k, x + 1, 3, 2, 1); }
    // piattini decorativi appesi
    px(g, k, 10, 10, 5, 5); px(g, P.acquaProfonda, 12, 12);
    px(g, k, 22, 18, 5, 5); px(g, P.acquaProfonda, 24, 20);
    return true;
  }

  if (motivo === 'finestrino_espvresso') {
    fill(g, a); // mogano treno
    // finestrino con paesaggio notturno
    px(g, b, 4, 6, 24, 18);
    // luci sfocate città mosse da velocità
    px(g, P.giallo, 8, 14, 6, 1); px(g, P.giallo, 18, 18, 8, 1); px(g, P.arancio, 10, 20, 5, 1);
    // tendine di velluto rosso raccolte ai lati
    px(g, k, 3, 5, 4, 18); px(g, k, 25, 5, 4, 18);
    px(g, P.giallo, 5, 14, 1, 2); px(g, P.giallo, 26, 14, 1, 2); // fermatende dorati
    return true;
  }

  if (motivo === 'parete_groviera_dop') {
    fill(g, a); // formaggio giallo
    // buchi grandi e piccoli
    for (const [bx, by, br] of [[8, 8, 4], [22, 12, 5], [10, 24, 3], [24, 25, 3]] as const) {
      px(g, b, bx - br, by - br, br * 2, br * 2); px(g, a, bx - br, by - br, 1, 1);
    }
    // topolino curioso che sbuca da uno dei buchi
    px(g, P.pietra, 20, 11, 4, 3); // musetto grigio
    px(g, k, 21, 11); px(g, k, 23, 11); // occhietti neri
    px(g, P.rosaNeon, 22, 13); // nasino rosa
    return true;
  }

  if (motivo === 'panorama_origami') {
    fill(g, a); // cielo azzurro carta
    // colline origami sovrapposte
    for (let x = 0; x < 32; x++) {
      const h1 = Math.floor(Math.abs(16 - x) * 0.7); px(g, b, x, 18 + h1, 1, 14);
      const h2 = Math.floor(Math.abs(8 - (x % 16)) * 0.8); px(g, P.erbaChiara, x, 22 + h2, 1, 10);
    }
    // sole giallo di carta
    px(g, k, 4, 4, 6, 6);
    // nuvole di cartoncino e gru di carta
    px(g, P.pietraChiara, 18, 5, 8, 3);
    px(g, P.pietraChiara, 14, 12, 3, 2); px(g, P.pietraChiara, 15, 10, 1, 2); // gru origami
    return true;
  }

  if (motivo === 'paravento_imperiale') {
    fill(g, a); // legno laccato rosso
    // pannelli e intarsi dorati a nuvola
    px(g, P.legnoScuro, 0, 0, 32, 1); px(g, P.legnoScuro, 16, 0, 1, 32);
    px(g, b, 4, 8, 8, 2); px(g, b, 6, 6, 4, 2); px(g, b, 20, 8, 8, 2);
    // canne di bambù verdi
    px(g, k, 8, 12, 2, 20); px(g, k, 24, 10, 2, 22);
    for (let y = 14; y < 30; y += 6) { px(g, P.erbaChiara, 7, y, 4, 1); px(g, P.erbaChiara, 23, y, 4, 1); }
    // lanterne rosse appese
    px(g, P.rosso, 11, 2, 4, 5); px(g, b, 12, 4, 2, 2);
    return true;
  }

  if (motivo === 'staccionata_onsen') {
    fill(g, a); // cielo notturno invernale
    // rocce vulcaniche innevate
    px(g, P.roccia, 4, 10, 14, 8); px(g, b, 4, 10, 14, 2); // neve sopra
    // pino innevato
    px(g, P.boscoOmbra, 22, 6, 8, 12); px(g, b, 23, 6, 6, 2);
    // staccionata di bambù bassa con corde nere
    px(g, k, 0, 22, 32, 2); px(g, k, 0, 28, 32, 2);
    for (let x = 2; x < 32; x += 6) { px(g, k, x, 20, 2, 12); px(g, P.neroCaldo, x, 22, 2, 2); px(g, P.neroCaldo, x, 28, 2, 2); }
    // vapore bianco leggero
    for (const [vx, vy] of [[8, 18], [16, 16], [24, 19]] as const) px(g, b, vx, vy, 4, 1);
    return true;
  }

  if (motivo === 'parete_alto_voltaggio') {
    fill(g, a); // piastrelle bianche laboratorio
    for (let y = 0; y < 32; y += 8) { px(g, P.pietra, 0, y, 32, 1); const off = (y / 8) % 2 ? 8 : 0; px(g, P.pietra, off, y, 1, 8); px(g, P.pietra, (off + 16) % 32, y, 1, 8); }
    // tubi di vetro verticali con liquidi fluo
    px(g, P.pietraScura, 8, 4, 4, 24); px(g, b, 9, 6, 2, 20); // liquido verde
    px(g, P.pietraChiara, 9, 12, 1, 1); // bollicine
    px(g, P.pietraScura, 20, 4, 4, 24); px(g, k, 21, 6, 2, 20); // liquido viola
    // manometro e scintille
    px(g, P.ambraNeon, 13, 8, 5, 5); px(g, P.pietraChiara, 14, 9, 3, 3); px(g, P.rosso, 15, 10, 2, 1);
    px(g, P.cianoNeon, 25, 4, 2, 1); px(g, P.cianoNeon, 26, 6, 1, 2); // scintille Tesla
    return true;
  }

  return dipingiCartaExtra(motivo, g, col);
}

/** Disegna una finitura direttamente sul canvas 32×32 fornito. */
export function disegnaFinituraSuCanvas(c: HTMLCanvasElement, f: StanzaFinitura): void {
  c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  const [a = P.pietraChiara, b = P.pietra, k = P.pietraScura] = f.colori;
  const motivo = f.motivo ?? f.id;

  // 1. Prova carte da parati custom
  if (dipingiCarta(motivo, g, f.colori)) return;

  // 2. Prova pavimenti custom
  if (dipingiPavimento(motivo, g, f.colori)) return;

  // 3. Motivi storici MAREA (16×16 ingranditi a 32×32)
  if (motivo === 'rombi') {
    fill(g, a);
    for (let y = 0; y < 32; y++) { const d = Math.abs(16 - y); px(g, b, d, y, 32 - 2 * d, 1); }
    for (let y = 0; y < 32; y++) { const d = Math.abs(16 - y); px(g, k, d, y, 2, 1); px(g, k, 30 - d, y, 2, 1); }
  } else if (f.motivo === 'listelli') {
    fill(g, a);
    for (let y = 0; y < 32; y += 8) { px(g, k, 0, y, 32, 2); px(g, b, 0, y + 4, 32, 2); const o = (y / 8) % 2 ? 8 : 24; px(g, k, o, y, 2, 8); px(g, k, (o + 16) % 32, y, 2, 8); }
  } else if (f.motivo === 'stuoia') {
    fill(g, a);
    for (let x = 0; x < 32; x += 4) px(g, x % 8 ? b : a, x, 0, 2, 32);
    for (let x = 0; x < 32; x += 8) px(g, k, x, 0, 2, 32);
    px(g, k, 0, 10, 32, 2); px(g, k, 0, 26, 32, 2);
  } else if (f.motivo === 'lastre') {
    fill(g, a); px(g, b, 18, 2, 12, 12); px(g, b, 2, 20, 10, 10);
    px(g, k, 0, 0, 32, 2); px(g, k, 0, 0, 2, 32); px(g, k, 16, 0, 2, 18); px(g, k, 0, 16, 32, 2); px(g, k, 14, 16, 2, 16);
  } else if (f.motivo === 'righe') {
    fill(g, a); px(g, b, 8, 0, 8, 32); px(g, b, 24, 0, 8, 32); px(g, k, 16, 0, 2, 32); px(g, k, 0, 0, 2, 32);
  } else if (f.motivo === 'mattoni') {
    fill(g, a);
    for (let y = 0; y < 32; y += 8) { px(g, k, 0, y + 6, 32, 2); const o = (y / 8) % 2 ? 8 : 0; px(g, k, o, y, 2, 6); px(g, k, o + 16, y, 2, 6); px(g, b, o + 2, y, 4, 2); }
  } else if (f.motivo === 'perline') {
    fill(g, a);
    for (let x = 0; x < 32; x += 8) { px(g, k, x, 0, 2, 32); px(g, b, x + 2, 0, 2, 32); }
    px(g, k, 12, 8, 2, 2); px(g, k, 28, 22, 2, 2);
  } else if (f.motivo === 'assi') {
    fill(g, a);
    for (let x = 0; x < 32; x += 8) { px(g, k, x, 0, 2, 32); px(g, b, x + 2, 0, 2, 32); }
    for (const [x, y] of [[4, 6], [12, 22], [20, 10], [28, 26]] as const) px(g, k, x, y, 2, 2);
    px(g, k, 0, 14, 8, 2); px(g, k, 16, 26, 8, 2);
  } else { // 'scacchi'
    fill(g, a); px(g, b, 16, 0, 16, 16); px(g, b, 0, 16, 16, 16);
    px(g, k, 0, 0, 32, 2); px(g, k, 0, 16, 32, 2); px(g, k, 0, 0, 2, 32); px(g, k, 16, 0, 2, 32);
  }
}

/** Disegna un canvas 32×32 o 16×16 per il pavimento o la carta da parati. */
export function disegnaFinitura(f: StanzaFinitura): HTMLCanvasElement {
  const c = document.createElement('canvas');
  disegnaFinituraSuCanvas(c, f);
  return c;
}
