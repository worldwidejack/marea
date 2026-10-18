// Disegni procedurali per i pavimenti della stanza (finiture_pavimenti.ts)
// Motivi 32×32 pixel per cella (2 m), ripetuti con NearestFilter. Colori della palette (P).
import { P } from '../render/island_parts.ts';

const fill = (g: CanvasRenderingContext2D, col: string) => { g.fillStyle = col; g.fillRect(0, 0, 32, 32); };
const px = (g: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

/** Dipinge il pavimento specificato su un canvas 32×32. Ritorna true se il motivo è gestito qui. */
export function dipingiPavimento(motivo: string, g: CanvasRenderingContext2D, col: string[]): boolean {
  const [a = P.pietraChiara, b = P.pietra, k = P.pietraScura] = col;

  if (motivo === 'moquette_bowling') {
    fill(g, a); // abisso
    // ghirigori, triangoli e coriandoli fluo anni 90
    for (const [x, y] of [[4, 4], [20, 18], [12, 26], [26, 6]] as const) {
      px(g, b, x, y, 3, 1); px(g, b, x + 1, y - 1, 1, 3); // rosa neon croce/stella
      px(g, P.cianoNeon, (x + 8) % 32, (y + 10) % 32, 2, 2); // ciano coriandolo
      px(g, k, (x + 14) % 32, (y + 4) % 32, 3, 2); // giallo triangolo
      px(g, k, (x + 15) % 32, (y + 3) % 32, 1, 1);
    }
    // serpentina/ghirigoro
    for (let i = 0; i < 8; i++) { px(g, b, 2 + i, 14 + (i % 2), 1, 1); px(g, P.verdeNeon, 18 + i, 28 - (i % 2), 1, 1); }
    return true;
  }

  if (motivo === 'parquet_scricchiolante') {
    fill(g, a); // legno scuro
    for (let y = 0; y < 32; y += 8) {
      px(g, b, 0, y, 32, 1); // fessura scura
      const off = (y / 8) % 2 ? 8 : 24;
      px(g, b, off, y, 1, 8); px(g, b, (off + 16) % 32, y, 1, 8);
      // venature e assi storte
      px(g, P.legno, 2, y + 3, 12, 1); px(g, P.legno, 18, y + 5, 10, 1);
    }
    // ragnatele viola pastello negli angoli
    for (let d = 0; d < 4; d++) { px(g, k, d, d); px(g, k, d, 0); px(g, k, 0, d); px(g, k, 31 - d, d); px(g, k, 31 - d, 0); }
    return true;
  }

  if (motivo === 'griglia_salvaschermo_3d') {
    fill(g, a); // nero caldo
    // tubi colorati sotto il vetro
    for (let x = 0; x < 32; x++) {
      px(g, P.violaNeon, x, (Math.floor(x * 0.7) + 8) % 32, 2, 2);
      px(g, P.rosaNeon, x, (32 - Math.floor(x * 0.5)) % 32, 2, 2);
    }
    // griglia prospettica verde e azzurra
    for (let i = 0; i < 32; i += 8) { px(g, b, 0, i, 32, 1); px(g, k, i, 0, 1, 32); }
    for (let i = 4; i < 32; i += 8) { px(g, b, i, i, 2, 2); }
    return true;
  }

  if (motivo === 'linoleum_straccio_domani') {
    fill(g, a); // crema anni 70
    // motivo geometrico arancio
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      px(g, b, x + 2, y + 2, 12, 12);
      px(g, a, x + 5, y + 5, 6, 6);
      px(g, b, x + 7, y + 7, 2, 2);
      px(g, k, x, y, 16, 1); px(g, k, x, y, 1, 16); // fessura piastrella
    }
    // graffi, calzino spaiato e foglio appallottolato
    px(g, k, 6, 18, 4, 1); px(g, k, 22, 10, 3, 1); // graffi
    px(g, P.rosso, 27, 26, 3, 2); px(g, P.pietraChiara, 28, 28, 2, 2); // calzino spaiato
    px(g, P.pietraChiara, 3, 27, 3, 3); px(g, k, 4, 28, 1, 1); // foglio accartocciato
    return true;
  }

  if (motivo === 'tappeto_muschio_soffice') {
    fill(g, a); // erba scura
    // sfumature di muschio morbido
    for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) if ((x + y * 3) % 5 === 0) px(g, b, x, y, 2, 2);
    // pietre piatte levigate
    for (const [px0, py0] of [[6, 8], [22, 20]] as const) { px(g, P.pietra, px0, py0, 5, 3); px(g, P.pietraScura, px0 + 1, py0 + 3, 4, 1); }
    // trifogli bianchi
    for (const [tx, ty] of [[14, 4], [4, 24], [25, 6], [18, 27]] as const) {
      px(g, P.pietraChiara, tx, ty - 1); px(g, P.pietraChiara, tx - 1, ty); px(g, P.pietraChiara, tx + 1, ty); px(g, P.erbaChiara, tx, ty);
    }
    // polverina azzurra luminosa
    for (const [lx, ly] of [[10, 16], [28, 14], [2, 12], [20, 2]] as const) px(g, k, lx, ly);
    return true;
  }

  if (motivo === 'parquet_chicco_tostato') {
    fill(g, a); // miele
    // spina di pesce alternando miele, caramello, caffè
    for (let y = 0; y < 32; y += 8) {
      for (let x = 0; x < 32; x += 16) {
        const c1 = ((x + y) / 8) % 3 === 0 ? a : ((x + y) / 8) % 3 === 1 ? b : k;
        const c2 = ((x + y) / 8 + 1) % 3 === 0 ? a : ((x + y) / 8 + 1) % 3 === 1 ? b : k;
        px(g, c1, x, y, 8, 4); px(g, c2, x + 8, y + 4, 8, 4);
        px(g, P.ombraCalda, x, y + 3, 8, 1); px(g, P.ombraCalda, x + 8, y + 7, 8, 1);
        px(g, P.ombraCalda, x + 7, y, 1, 4); px(g, P.ombraCalda, x + 15, y + 4, 1, 4);
      }
    }
    return true;
  }

  if (motivo === 'scacchiera_cioccolato_vaniglia') {
    fill(g, a); // cioccolato
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      // quadrati vaniglia con angoli arrotondati
      const ox = (y === 0 ? 0 : 8), oy = (x === 0 ? 0 : 8);
      px(g, b, ox + 1, oy + 1, 6, 6);
      px(g, b, ox + 2, oy, 4, 8); px(g, b, ox, oy + 2, 8, 4); // arrotondato
      // buchini da biscotto
      px(g, a, ox + 2, oy + 2); px(g, a, ox + 5, oy + 2); px(g, a, ox + 2, oy + 5); px(g, a, ox + 5, oy + 5);
      // scanalatura cioccolato
      const cx = (ox + 8) % 16, cy = (oy + 8) % 16;
      px(g, k, cx + 1, cy + 1, 6, 6);
      px(g, a, cx + 2, cy + 2, 4, 4);
    }
    return true;
  }

  if (motivo === 'battigia_bagnata') {
    fill(g, a); // sabbia dorata
    // onde schiuma e acqua turchese
    for (let y = 0; y < 14; y++) px(g, b, 0, y, 32, 1);
    for (let x = 0; x < 32; x++) {
      const ond = Math.sin((x / 32) * Math.PI * 4) * 2;
      px(g, P.pietraChiara, x, Math.floor(13 + ond), 1, 2); // schiuma bianca
      px(g, b, x, Math.floor(11 + ond), 1, 2); // turchese trasparente
    }
    // conchiglia rosa e stella marina rossa
    px(g, P.rosaNeon, 8, 22, 3, 2); px(g, P.pietraChiara, 9, 21, 1, 1); // conchiglia
    // stella marina
    px(g, k, 24, 22, 1, 5); px(g, k, 22, 24, 5, 1); px(g, k, 23, 23, 3, 3);
    return true;
  }

  if (motivo === 'dissipatore_rame_ventole') {
    fill(g, b); // nero ventole
    // griglia dissipatore alettata rame e alluminio
    for (let y = 0; y < 32; y += 4) {
      px(g, a, 0, y, 32, 2); // aletta rame
      px(g, P.pietra, 0, y + 2, 32, 1); // alluminio spazzolato
    }
    // feritoie e LED blu soffusi
    for (let x = 4; x < 32; x += 8) {
      px(g, b, x, 0, 2, 32);
      px(g, k, x, 6, 2, 2); px(g, k, x, 22, 2, 2); // led blu
    }
    return true;
  }

  if (motivo === 'parquet_tiro_libero') {
    fill(g, a); // legno chiaro parquet
    for (let y = 0; y < 32; y += 4) {
      px(g, P.legno, 0, y, 32, 1);
      const o = (y / 4) % 2 ? 10 : 26; px(g, P.legno, o, y, 1, 4);
    }
    // linee campo basket bianche e rosse
    px(g, k, 0, 16, 32, 2); // linea bianca tiro libero
    px(g, b, 14, 0, 4, 32); // linea rossa area
    // segno gomma nera scarpa
    px(g, P.neroCaldo, 6, 24, 3, 1); px(g, P.neroCaldo, 8, 25, 2, 1);
    return true;
  }

  if (motivo === 'tavolato_taverna') {
    fill(g, a); // legno rustico
    for (let y = 0; y < 32; y += 10) {
      px(g, b, 0, y, 32, 2); // fessure larghe
      // chiodi in ferro battuto
      px(g, P.neroCaldo, 2, y + 4, 2, 2); px(g, P.neroCaldo, 28, y + 4, 2, 2);
    }
    // macchie circolari di boccale
    for (const [mx, my] of [[12, 14], [22, 25]] as const) {
      px(g, b, mx + 1, my, 3, 1); px(g, b, mx + 1, my + 4, 3, 1);
      px(g, b, mx, my + 1, 1, 3); px(g, b, mx + 4, my + 1, 1, 3);
    }
    // pagliuzze negli angoli
    px(g, k, 26, 3, 4, 1); px(g, k, 28, 4, 3, 1);
    return true;
  }

  if (motivo === 'graniglia_indistruttibile') {
    fill(g, a); // grigio-verde terrazzo
    // fitti sassolini bianchi, neri, rosso mattone
    for (let y = 0; y < 32; y += 3) for (let x = 0; x < 32; x += 3) {
      const v = (x * 7 + y * 13) % 11;
      if (v === 0) px(g, P.pietraChiara, x, y, 2, 1);
      else if (v === 2) px(g, b, x, y + 1, 1, 2);
      else if (v === 4) px(g, k, x + 1, y, 2, 2);
    }
    // fughe piastrellone 16x16
    px(g, P.pietraScura, 0, 0, 32, 1); px(g, P.pietraScura, 0, 16, 32, 1);
    px(g, P.pietraScura, 0, 0, 1, 32); px(g, P.pietraScura, 16, 0, 1, 32);
    return true;
  }

  if (motivo === 'corsia_velluto_rosso') {
    fill(g, a); // legno scuro ai lati
    // guida centrale velluto rosso (colonne da 6 a 25)
    px(g, b, 6, 0, 20, 32);
    // bordo dorato
    px(g, k, 6, 0, 1, 32); px(g, k, 25, 0, 1, 32);
    px(g, k, 8, 0, 1, 32); px(g, k, 23, 0, 1, 32);
    for (let y = 0; y < 32; y += 4) { px(g, k, 7, y); px(g, k, 24, y); }
    return true;
  }

  if (motivo === 'lastricato_cracker_salati') {
    fill(g, a); // cracker dorato
    // fughe tra i 4 cracker 16x16
    px(g, b, 0, 0, 32, 1); px(g, b, 0, 16, 32, 1);
    px(g, b, 0, 0, 1, 32); px(g, b, 16, 0, 1, 32);
    // buchini classici da cracker
    for (let cy = 0; cy < 32; cy += 16) for (let cx = 0; cx < 32; cx += 16) {
      for (let dy = 4; dy <= 12; dy += 4) for (let dx = 4; dx <= 12; dx += 4) px(g, b, cx + dx, cy + dy, 2, 2);
      // cristallo sale grosso brillante
      px(g, k, cx + 6, cy + 9, 2, 2); px(g, k, cx + 11, cy + 5, 2, 1);
    }
    return true;
  }

  if (motivo === 'prato_cartone_ondulato') {
    fill(g, a); // verde pastello
    // incastri puzzle e coste cartone
    for (let y = 0; y < 32; y += 16) {
      px(g, b, 0, y, 32, 1);
      px(g, b, 16, 0, 1, 32);
      // dente a incastro
      px(g, a, 14, y, 5, 3); px(g, b, 14, y + 3, 5, 1);
    }
    // coste ondulate visibili
    for (let x = 0; x < 32; x += 4) for (let y = 2; y < 32; y += 4) px(g, b, x, y, 2, 1);
    // fiorellini disegnati a cera
    for (const [fx, fy] of [[6, 8], [22, 24]] as const) {
      px(g, k, fx - 1, fy, 3, 1); px(g, k, fx, fy - 1, 1, 3); px(g, P.giallo, fx, fy);
    }
    return true;
  }

  if (motivo === 'piastrelle_giada_carpe') {
    fill(g, a); // giada verde acqua
    // piastrelle esagonali
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) {
      px(g, b, x, y, 8, 1); px(g, b, x, y, 1, 8);
    }
    // sagome carpe Koi arancioni e bianche sotto il lucido
    for (const [kx, ky] of [[8, 12], [22, 22]] as const) {
      px(g, k, kx, ky, 6, 2); px(g, k, kx + 1, ky - 1, 4, 4); px(g, P.pietraChiara, kx + 2, ky, 2, 2);
      px(g, k, kx + 6, ky - 1, 2, 1); px(g, k, kx + 6, ky + 2, 2, 1); // pinne coda
    }
    return true;
  }

  if (motivo === 'acqua_termale_ciottoli') {
    fill(g, a); // acqua termale azzurra
    // bordo ciottoli di fiume
    for (let x = 0; x < 32; x += 4) { px(g, b, x, 0, 4, 3); px(g, P.pietraChiara, x + 1, 0, 2, 1); }
    for (let y = 0; y < 32; y += 4) { px(g, b, 0, y, 3, 4); px(g, P.pietraChiara, 0, y + 1, 1, 2); }
    // riflessi e vapore sull'acqua
    for (const [rx, ry] of [[12, 10], [22, 16], [14, 24]] as const) { px(g, P.acquaBassa, rx, ry, 6, 1); px(g, P.pietraChiara, rx + 2, ry, 2, 1); }
    // secchiello di legno
    px(g, k, 24, 24, 6, 5); px(g, P.legnoScuro, 23, 23, 8, 1); px(g, P.pietraScura, 24, 26, 6, 1); // cerchio ferro
    return true;
  }

  if (motivo === 'griglia_contenimento') {
    fill(g, a); // metallo grigio scuro
    // bulloni agli angoli piastra
    for (const [bx, by] of [[2, 2], [29, 2], [2, 29], [29, 29]] as const) { px(g, P.pietraChiara, bx, by, 2, 2); px(g, P.neroCaldo, bx, by); }
    // strisce di pericolo gialle e nere sui bordi
    for (let i = 0; i < 32; i += 4) { px(g, b, i, 0, 2, 2); px(g, P.neroCaldo, i + 2, 0, 2, 2); px(g, b, i, 30, 2, 2); px(g, P.neroCaldo, i + 2, 30, 2, 2); }
    // griglia centrale e bagliore verde radioattivo
    px(g, k, 10, 10, 12, 12);
    for (let y = 10; y < 22; y += 2) px(g, P.neroCaldo, 10, y, 12, 1);
    for (let x = 10; x < 22; x += 2) px(g, P.neroCaldo, x, 10, 1, 12);
    return true;
  }

  if (motivo === 'parquet_rovere_sbiancato') {
    fill(g, b); // rovere sbiancato chiaro
    for (let y = 0; y < 32; y += 8) {
      px(g, k, 0, y, 32, 1); // fuga sottile
      const o = (y / 8) % 2 ? 12 : 28; px(g, k, o, y, 1, 8);
      // venature delicate grigio-beige
      px(g, a, 4, y + 3, 16, 1); px(g, a, 18, y + 5, 10, 1);
    }
    return true;
  }

  if (motivo === 'resina_cemento_spatolato') {
    fill(g, a); // microcemento tortora
    // nuvolature morbide date dalla spatolatura
    for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) {
      const v = (x * 3 + y * 5) % 7;
      if (v === 0) px(g, b, x, y, 6, 3);
      else if (v === 3) px(g, k, x + 1, y + 1, 4, 3);
    }
    return true;
  }

  if (motivo === 'cotto_tradizionale') {
    fill(g, a); // terracotta arancio
    // spina di pesce con fughe grigie
    for (let y = 0; y < 32; y += 8) {
      for (let x = 0; x < 32; x += 16) {
        px(g, b, x, y, 8, 4); px(g, a, x + 8, y + 4, 8, 4);
        px(g, k, x, y + 3, 8, 1); px(g, k, x + 8, y + 7, 8, 1);
        px(g, k, x + 7, y, 1, 4); px(g, k, x + 15, y + 4, 1, 4);
      }
    }
    return true;
  }

  if (motivo === 'marmo_bianco_venato') {
    fill(g, a); // bianco Carrara
    // fughe piastre grandi 16x16
    px(g, b, 0, 0, 32, 1); px(g, b, 0, 16, 32, 1);
    px(g, b, 0, 0, 1, 32); px(g, b, 16, 0, 1, 32);
    // venature diagonali grigie morbide
    for (let d = 2; d < 30; d++) {
      if ((d % 7) < 3) { px(g, b, d, (d + 4) % 32, 2, 1); px(g, k, d + 1, (d + 5) % 32, 1, 1); }
      if ((d % 9) < 2) px(g, b, 31 - d, (d + 10) % 32, 2, 1);
    }
    return true;
  }

  if (motivo === 'moquette_beige_pelo_corto') {
    fill(g, a); // sabbia chiara beige
    // fitta trama tessile puntinata morbida
    for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) {
      const v = (x + y * 3) % 4;
      if (v === 0) px(g, b, x, y);
      else if (v === 2) px(g, k, x + 1, y + 1);
    }
    return true;
  }

  if (motivo === 'cementine_esagonali') {
    fill(g, k); // crema fondo
    // cementine esagonali con motivo floreale e geometrico blu e bordeaux
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      px(g, a, x + 3, y + 3, 10, 10);
      px(g, b, x + 5, y + 5, 6, 6);
      px(g, k, x + 7, y + 7, 2, 2);
      px(g, P.pietraScura, x, y, 16, 1); px(g, P.pietraScura, x, y, 1, 16);
    }
    return true;
  }

  if (motivo === 'tatami_intrecciato') {
    fill(g, a); // paglia oro-verde
    // trama paglia fine
    for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) if ((x + y) % 4 === 0) px(g, P.erba, x, y, 2, 1);
    // fasce di tessuto verde scuro (bordi tatami)
    px(g, b, 0, 0, 32, 3); px(g, b, 0, 16, 32, 3);
    px(g, k, 0, 1, 32, 1); px(g, k, 0, 17, 32, 1);
    for (let x = 0; x < 32; x += 4) { px(g, P.sabbia, x, 1); px(g, P.sabbia, x + 2, 17); }
    return true;
  }

  if (motivo === 'parquet_quadrotte_noce') {
    fill(g, a); // noce scuro
    // quadrotte stile Versailles 16x16
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      px(g, k, x, y, 16, 1); px(g, k, x, y, 1, 16);
      px(g, b, x + 2, y + 2, 12, 12);
      px(g, a, x + 4, y + 4, 8, 8);
      px(g, k, x + 7, y + 2, 2, 12); px(g, k, x + 2, y + 7, 12, 2);
    }
    return true;
  }

  if (motivo === 'mosaico_nido_ape') {
    fill(g, a); // bianco opaco
    // fughe esagonali
    for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) {
      px(g, k, x, y); px(g, k, x + 2, y + 2);
    }
    // fiorellini blu cobalto a intervalli regolari
    for (const [fx, fy] of [[8, 8], [24, 8], [8, 24], [24, 24]] as const) {
      px(g, b, fx, fy - 1); px(g, b, fx, fy + 1); px(g, b, fx - 1, fy); px(g, b, fx + 1, fy);
      px(g, P.giallo, fx, fy); // pistillo
    }
    return true;
  }

  if (motivo === 'lastre_ardesia_naturale') {
    fill(g, a); // ardesia antracite
    // lastre rettangolari e quadrate
    px(g, k, 0, 0, 32, 1); px(g, k, 0, 14, 32, 1); px(g, k, 0, 24, 32, 1);
    px(g, k, 12, 0, 1, 14); px(g, k, 22, 14, 1, 10); px(g, k, 16, 24, 1, 8);
    // texture naturale liscia sfumata
    for (let y = 2; y < 30; y += 3) for (let x = 2; x < 30; x += 5) if ((x * y) % 3 === 0) px(g, b, x, y, 3, 1);
    return true;
  }

  return false;
}
